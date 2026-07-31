import { serverCache } from "./cache";
import { cleanTitle } from "./formatters";

export { cleanTitle };

export interface TMDBMetadata {
  id?: number | string;
  tmdb_id?: number | string;
  imdb_id?: string;
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
 * Smart matching algorithm to pick the best TMDB search result based on title similarity and release year.
 */
export function findBestMatch(
  results: any[],
  query: string,
  year?: string,
  targetType: "tv" | "movie" = "tv"
): any | null {
  if (!results || results.length === 0) return null;

  const targetTitle = query.toLowerCase().trim();
  let bestItem: any = null;
  let maxScore = -1;

  for (const item of results) {
    const itemType = item.media_type || targetType;
    if (itemType !== targetType && results.length > 1) continue;

    let score = 0;
    const names = [
      item.name,
      item.title,
      item.original_name,
      item.original_title,
    ]
      .filter((n): n is string => Boolean(n) && typeof n === "string")
      .map((n) => n.toLowerCase().trim());

    if (names.some((n) => n === targetTitle)) {
      score += 100;
    } else if (names.some((n) => n.includes(targetTitle) || targetTitle.includes(n))) {
      score += 50;
    } else {
      const targetWords = targetTitle.split(/\s+/).filter((w) => w.length > 1);
      let wordMatches = 0;
      names.forEach((n) => {
        targetWords.forEach((w) => {
          if (n.includes(w)) wordMatches++;
        });
      });
      score += wordMatches * 10;
    }

    const dateStr = item.first_air_date || item.release_date || "";
    if (year && dateStr.startsWith(year)) {
      score += 40;
    }

    if (item.popularity && typeof item.popularity === "number") {
      score += Math.min(10, item.popularity / 10);
    }

    if (score > maxScore) {
      maxScore = score;
      bestItem = item;
    }
  }

  return bestItem || results[0];
}

/**
 * Fetch fresh data directly from TMDB external API using TMDB_API_KEY.
 */
export async function fetchTmdbFromApi(
  type: string,
  query?: string,
  id?: string | number,
  season?: string | number,
  language?: string
): Promise<any> {
  const apiKey = getTmdbApiKey();
  const lang = language || "en-US";
  let url = "";

  if (type === "search" || type === "search_tv") {
    if (!query) throw new Error("Query parameter required for search");
    const { title, year } = cleanTitle(query);
    const searchEndpoint = type === "search_tv" ? "https://api.themoviedb.org/3/search/tv" : "https://api.themoviedb.org/3/search/movie";
    const searchUrl = new URL(searchEndpoint);
    searchUrl.searchParams.set("api_key", apiKey);
    searchUrl.searchParams.set("query", title);
    searchUrl.searchParams.set("language", lang);
    if (year) {
      if (type === "search_tv") {
        searchUrl.searchParams.set("first_air_date_year", year);
      } else {
        searchUrl.searchParams.set("primary_release_year", year);
      }
    }
    url = searchUrl.toString();
  } else if (type === "tv" || type === "movie") {
    if (!id) throw new Error(`ID parameter required for ${type}`);
    if (season !== undefined && season !== null && season !== "" && type === "tv") {
      url = `https://api.themoviedb.org/3/tv/${id}/season/${season}?api_key=${apiKey}&language=${lang}`;
    } else {
      url = `https://api.themoviedb.org/3/${type}/${id}?api_key=${apiKey}&append_to_response=external_ids,credits,images&language=${lang}`;
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
  forceExternal: boolean = false,
  language?: string
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
  const cacheKey = serverCache.formatTmdbKey(type, tmdbId || rawName, undefined, language);

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
      apiResult = await fetchTmdbFromApi(type, undefined, tmdbId, undefined, language);
    } else if (rawName) {
      const searchType = type === "tv" ? "search_tv" : "search";
      const { title, year } = cleanTitle(rawName);
      const searchRes = await fetchTmdbFromApi(searchType, rawName, undefined, undefined, language);
      if (searchRes && searchRes.results && searchRes.results.length > 0) {
        const match = findBestMatch(searchRes.results, title, year, type);
        if (match && match.id) {
          apiResult = await fetchTmdbFromApi(type, undefined, match.id, undefined, language);
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
        imdb_id: apiResult.imdb_id || apiResult.external_ids?.imdb_id || undefined,
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
