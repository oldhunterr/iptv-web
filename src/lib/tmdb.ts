import { serverCache } from "./cache";

export interface TMDBMetadata {
  id?: number | string;
  tmdb_id?: number | string;
  tvdb_id?: number | string;
  title?: string;
  name?: string;
  poster_path?: string;
  cover?: string;
  backdrop_path?: string;
  plot?: string;
  overview?: string;
  cast?: string | string[];
  director?: string | string[];
  rating?: string | number;
  release_date?: string;
  releaseDate?: string;
  genre?: string;
  source: "xtream" | "cache" | "tmdb" | "fallback";
}

export function getTmdbApiKey(): string {
  return process.env.TMDB_API_KEY || "4ef0d7355d9ffb5151e987764708ce96";
}

/**
 * Utility to clean release title string by extracting clean title name and release year.
 */
export function cleanTitle(rawName: string): { title: string; year?: string } {
  if (!rawName) return { title: "" };

  let title = rawName;
  let year: string | undefined = undefined;

  // Remove common IPTV prefixes
  title = title.replace(/^(EN\||UK\||US\||FR\||DE\||AR\||ES\||PT\||IT\||RU\||TR\||IN\||PK\|)\s*/i, "");

  // Extract year if present in parentheses or brackets e.g., (2022), (2022-2026), [2022]
  const yearMatch = title.match(/[\(\[](\d{4})(?:-\d{4})?[\)\]]/);
  if (yearMatch) {
    year = yearMatch[1];
  }

  // Strip all parentheses/brackets and their contents (e.g. metadata, years, language tags)
  title = title.replace(/[\(\[].*?[\)\]]/g, "");

  // Clean trailing hyphens and whitespace
  title = title.trim().replace(/^[-_\s]+|[-_\s]+$/g, "");

  return { title: title || rawName, year };
}

/**
 * Check if the required metadata fields (poster/cover, plot, cast, director, rating, release date)
 * are directly available in Xtream Codes stream/series JSON data.
 */
export function hasRequiredXtreamMetadata(item: any): boolean {
  if (!item || typeof item !== "object") return false;

  const info = item.info || {};

  const cover = item.cover || item.stream_icon || item.poster_path || info.cover_big || info.movie_image;
  const plot = item.plot || item.overview || info.plot;
  const cast = item.cast || info.cast;
  const director = item.director || info.director;
  const rating = item.rating || item.rating_5based || info.rating;
  const releaseDate = item.releaseDate || item.release_date || info.release_date;

  const isNonEmpty = (val: any) => val !== undefined && val !== null && String(val).trim() !== "" && String(val).trim() !== "0";

  return (
    isNonEmpty(cover) &&
    isNonEmpty(plot) &&
    isNonEmpty(cast) &&
    isNonEmpty(director) &&
    isNonEmpty(rating) &&
    isNonEmpty(releaseDate)
  );
}

/**
 * Fetch fresh data directly from TMDB external API using TMDB_API_KEY.
 */
export async function fetchTmdbFromApi(
  type: string,
  query?: string,
  id?: string | number,
  season?: string | number
): Promise<any> {
  const apiKey = getTmdbApiKey();
  let url = "";

  if (type === "search" || type === "search_tv") {
    if (!query) throw new Error("Query parameter required for search");
    const { title, year } = cleanTitle(query);
    const searchUrl = new URL(type === "search_tv" ? "https://api.themoviedb.org/3/search/tv" : "https://api.themoviedb.org/3/search/multi");
    searchUrl.searchParams.set("api_key", apiKey);
    searchUrl.searchParams.set("query", title);
    if (year) searchUrl.searchParams.set("year", year);
    url = searchUrl.toString();
  } else if (type === "tv" || type === "movie") {
    if (!id) throw new Error(`ID parameter required for ${type}`);
    if (season !== undefined && season !== null && season !== "" && type === "tv") {
      url = `https://api.themoviedb.org/3/tv/${id}/season/${season}?api_key=${apiKey}`;
    } else {
      url = `https://api.themoviedb.org/3/${type}/${id}?api_key=${apiKey}&append_to_response=external_ids,credits,images`;
    }
  } else {
    throw new Error(`Invalid TMDB request type: ${type}`);
  }

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`TMDB API returned HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Smart Fallback Metadata Resolver (R4 Requirement):
 * 1. Check if required details exist directly in Xtream Codes stream/series JSON data.
 * 2. Check server-side cache.
 * 3. Only query external TMDB API if information is missing or explicitly requested.
 */
export async function resolveMetadata(
  item: any,
  type: "movie" | "tv" = "movie",
  forceExternal: boolean = false
): Promise<TMDBMetadata> {
  if (!item) {
    return { source: "fallback" };
  }

  // Step 1: Check if required metadata is fully present in Xtream Codes data
  if (!forceExternal && hasRequiredXtreamMetadata(item)) {
    const info = item.info || {};
    return {
      id: item.stream_id || item.series_id || item.id,
      tmdb_id: item.tmdb_id || info.tmdb_id,
      title: item.name || info.name,
      name: item.name || info.name,
      poster_path: item.cover || item.stream_icon || info.cover_big || info.movie_image,
      cover: item.cover || item.stream_icon || info.cover_big || info.movie_image,
      backdrop_path: item.backdrop_path || info.backdrop_path,
      plot: item.plot || info.plot,
      overview: item.plot || info.plot,
      cast: item.cast || info.cast,
      director: item.director || info.director,
      rating: item.rating || item.rating_5based || info.rating,
      release_date: item.releaseDate || item.release_date || info.release_date,
      releaseDate: item.releaseDate || item.release_date || info.release_date,
      genre: item.genre || info.genre,
      source: "xtream",
    };
  }

  const rawName = item.name || item.info?.name || "";
  const tmdbId = item.tmdb_id || item.info?.tmdb_id;
  const cacheKey = serverCache.formatTmdbKey(type, tmdbId || rawName);

  // Step 2: Check Server Cache
  if (!forceExternal) {
    const cached = serverCache.get<TMDBMetadata>(cacheKey);
    if (cached) {
      return { ...cached, source: "cache" };
    }
  }

  // Step 3: Fetch from TMDB External API
  try {
    let apiResult: any = null;

    if (tmdbId) {
      apiResult = await fetchTmdbFromApi(type, undefined, tmdbId);
    } else if (rawName) {
      const searchRes = await fetchTmdbFromApi("search", rawName);
      if (searchRes && searchRes.results && searchRes.results.length > 0) {
        const match = searchRes.results.find((r: any) => r.media_type === type) || searchRes.results[0];
        const matchType = match.media_type || type;
        if (match.id) {
          apiResult = await fetchTmdbFromApi(matchType, undefined, match.id);
        }
      }
    }

    if (apiResult) {
      const poster = apiResult.poster_path
        ? `https://image.tmdb.org/t/p/w500${apiResult.poster_path}`
        : item.cover || item.stream_icon;
      const backdrop = apiResult.backdrop_path
        ? `https://image.tmdb.org/t/p/original${apiResult.backdrop_path}`
        : item.backdrop_path;

      const credits = apiResult.credits || {};
      const castList = credits.cast ? credits.cast.slice(0, 5).map((c: any) => c.name).join(", ") : item.cast;
      const directorObj = credits.crew ? credits.crew.find((c: any) => c.job === "Director") : null;
      const directorName = directorObj ? directorObj.name : item.director;

      const resolved: TMDBMetadata = {
        id: item.stream_id || item.series_id || item.id,
        tmdb_id: apiResult.id || tmdbId,
        tvdb_id: apiResult.external_ids?.tvdb_id,
        title: apiResult.title || apiResult.name || rawName,
        name: apiResult.name || apiResult.title || rawName,
        poster_path: poster,
        cover: poster,
        backdrop_path: backdrop,
        plot: apiResult.overview || item.plot,
        overview: apiResult.overview || item.plot,
        cast: castList || item.cast,
        director: directorName || item.director,
        rating: apiResult.vote_average || item.rating,
        release_date: apiResult.release_date || apiResult.first_air_date || item.releaseDate || item.release_date,
        releaseDate: apiResult.release_date || apiResult.first_air_date || item.releaseDate || item.release_date,
        genre: apiResult.genres ? apiResult.genres.map((g: any) => g.name).join(", ") : item.genre,
        source: "tmdb",
      };

      // Cache for 24 hours (86400 seconds)
      serverCache.set(cacheKey, resolved, 86400_000);
      return resolved;
    }
  } catch (err) {
    // External fetch failed, will fall through to fallback
  }

  // Step 4: Fallback to available Xtream Codes fields
  const info = item.info || {};
  return {
    id: item.stream_id || item.series_id || item.id,
    tmdb_id: tmdbId,
    title: item.name || info.name,
    name: item.name || info.name,
    poster_path: item.cover || item.stream_icon || info.cover_big,
    cover: item.cover || item.stream_icon || info.cover_big,
    backdrop_path: item.backdrop_path || info.backdrop_path,
    plot: item.plot || info.plot,
    overview: item.plot || info.plot,
    cast: item.cast || info.cast,
    director: item.director || info.director,
    rating: item.rating || item.rating_5based || info.rating,
    release_date: item.releaseDate || item.release_date || info.release_date,
    releaseDate: item.releaseDate || item.release_date || info.release_date,
    genre: item.genre || info.genre,
    source: "fallback",
  };
}
