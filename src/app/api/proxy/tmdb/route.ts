import { NextRequest, NextResponse } from "next/server";
import { serverCache } from "@/lib/cache";
import { fetchTmdbFromApi } from "@/lib/tmdb";
import { cleanTitle } from "@/lib/formatters";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const query = searchParams.get("query") || searchParams.get("q") || undefined;
    const id = searchParams.get("id") || searchParams.get("tmdb_id") || undefined;
    const season = searchParams.get("season") || undefined;
    const year = searchParams.get("year") || searchParams.get("first_air_date_year") || searchParams.get("primary_release_year") || undefined;
    const force = searchParams.get("force") === "true";
    const language = searchParams.get("language") || "en-US";

    if (!type || !["search", "search_tv", "tv", "movie"].includes(type)) {
      return NextResponse.json(
        { error: "Missing or invalid type parameter. Must be 'search', 'search_tv', 'tv', or 'movie'." },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    if ((type === "search" || type === "search_tv") && !query) {
      return NextResponse.json(
        { error: "Missing required parameter 'query' for TMDB search." },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    if ((type === "tv" || type === "movie") && !id) {
      return NextResponse.json(
        { error: `Missing required parameter 'id' for TMDB ${type}.` },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // For search operations, normalize the query with cleanTitle to match
    // what fetchTmdbFromApi will actually send to TMDB, preventing cache key
    // mismatches between different raw queries that clean to the same title
    const cacheQueryOrId = (type === "search" || type === "search_tv") && query
      ? cleanTitle(query).title
      : (id || query);

    const cacheKey = serverCache.formatTmdbKey(type, cacheQueryOrId, season, language, year);

    // Build upstream TMDB API URL string for diagnostics
    let upstreamUrl = "";
    if (type === "search" || type === "search_tv") {
      const { title } = cleanTitle(query || "");
      const endpoint = type === "search_tv" ? "https://api.themoviedb.org/3/search/tv" : "https://api.themoviedb.org/3/search/movie";
      upstreamUrl = `${endpoint}?query=${encodeURIComponent(title)}&language=${language}`;
      if (year) {
        upstreamUrl += type === "search_tv" ? `&first_air_date_year=${year}` : `&primary_release_year=${year}`;
      }
    } else if (type === "tv" || type === "movie") {
      if (season !== undefined && season !== null && season !== "" && type === "tv") {
        upstreamUrl = `https://api.themoviedb.org/3/tv/${id}/season/${season}?language=${language}`;
      } else {
        upstreamUrl = `https://api.themoviedb.org/3/${type}/${id}?append_to_response=external_ids,credits,images&language=${language}`;
      }
    }

    // 1. Check Server Cache
    if (!force) {
      const cachedData = serverCache.get(cacheKey);
      if (cachedData) {
        return NextResponse.json(cachedData, {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "X-Cache, X-Cache-Key, X-Upstream-Url",
            "X-Cache": "HIT",
            "X-Cache-Key": cacheKey,
            "X-Upstream-Url": upstreamUrl,
            "Cache-Control": "public, max-age=86400",
          },
        });
      }
    }

    // 2. Fetch fresh data from TMDB API
    let freshData: any;
    try {
      freshData = await fetchTmdbFromApi(type, query, id, season, language);
    } catch (err: any) {
      return NextResponse.json(
        { error: err.message || "Failed to fetch data from TMDB API" },
        { status: 502, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    if (!freshData) {
      return NextResponse.json(
        { error: "TMDB media resource not found" },
        { status: 404, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // 3. Cache result for 24 hours (86,400 seconds)
    serverCache.set(cacheKey, freshData, 86400_000);

    return NextResponse.json(freshData, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "X-Cache, X-Cache-Key, X-Upstream-Url",
        "X-Cache": "MISS",
        "X-Cache-Key": cacheKey,
        "X-Upstream-Url": upstreamUrl,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
