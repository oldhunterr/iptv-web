import { serverCache } from "./cache";

export interface SkipTimestampSegment {
  start: number;
  end: number;
}

export interface IntroDBMediaResponse {
  tvdb_id?: number | string;
  season?: number | string;
  episode?: number | string;
  intro?: SkipTimestampSegment | null;
  recap?: SkipTimestampSegment | null;
  credits?: SkipTimestampSegment | null;
  [key: string]: any;
}

export async function fetchIntroFromApi(
  id: string | number,
  season: string | number,
  episode: string | number,
  idType: "tvdb" | "tmdb" = "tvdb"
): Promise<IntroDBMediaResponse | null> {
  const url = new URL("https://api.theintrodb.org/v3/media");
  if (idType === "tmdb") {
    url.searchParams.set("tmdb_id", String(id));
  } else {
    url.searchParams.set("tvdb_id", String(id));
  }
  url.searchParams.set("season", String(season));
  url.searchParams.set("episode", String(episode));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`TheIntroDB API error: HTTP ${res.status}`);
    }

    return await res.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("TheIntroDB request timed out");
    }
    throw err;
  }
}

export async function getSkipTimestamps(
  id: string | number,
  season: string | number,
  episode: string | number,
  idType: "tvdb" | "tmdb" = "tvdb",
  force: boolean = false
): Promise<IntroDBMediaResponse | null> {
  const cacheKey = serverCache.formatIntroKey(idType === "tmdb" ? `tmdb_${id}` : id, season, episode);

  if (!force) {
    const cached = serverCache.get<IntroDBMediaResponse>(cacheKey);
    if (cached) return cached;
  }

  const result = await fetchIntroFromApi(id, season, episode, idType);
  if (result) {
    // Cache skip timestamps for 24 hours
    serverCache.set(cacheKey, result, 86400_000);
  }

  return result;
}
