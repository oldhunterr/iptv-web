import { NextRequest, NextResponse } from "next/server";
import { serverCache } from "@/lib/cache";
import { fetchIntroFromApi } from "@/lib/introdb";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tmdbId = searchParams.get("tmdb_id");
    const tvdbId = searchParams.get("tvdb_id") || searchParams.get("id");
    const season = searchParams.get("season");
    const episode = searchParams.get("episode");
    const force = searchParams.get("force") === "true";

    if ((!tvdbId && !tmdbId) || season === null || season === undefined || episode === null || episode === undefined) {
      return NextResponse.json(
        { error: "Missing required parameters. 'tvdb_id' or 'tmdb_id', 'season', and 'episode' are required." },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const id = tmdbId || tvdbId!;
    const idType = tmdbId ? "tmdb" : "tvdb";
    const cacheKey = serverCache.formatIntroKey(tmdbId ? `tmdb_${tmdbId}` : tvdbId!, season, episode);

    // 1. Check Server Cache
    if (!force) {
      const cached = serverCache.get(cacheKey);
      if (cached) {
        return NextResponse.json(cached, {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "X-Cache": "HIT",
            "Cache-Control": "public, max-age=86400",
          },
        });
      }
    }

    // 2. Query external TheIntroDB API
    let introData: any = null;
    try {
      introData = await fetchIntroFromApi(id, season, episode, idType);
    } catch (err: any) {
      return NextResponse.json(
        { error: err.message || "Failed to fetch from TheIntroDB" },
        { status: 502, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    if (!introData) {
      return NextResponse.json(
        { error: "Skip timestamps not found for specified media" },
        { status: 404, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // 3. Cache result for 24 hours
    serverCache.set(cacheKey, introData, 86400_000);

    return NextResponse.json(introData, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "X-Cache": "MISS",
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
