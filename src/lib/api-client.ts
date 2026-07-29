import {
  Category,
  LiveStream,
  VodStream,
  VodInfo,
  Series,
  SeriesInfo,
  SkipTimestamps,
} from "@/types/iptv";

const BASE_PROXY_URL = "/api/proxy";

export function getStreamUrl(
  type: "live" | "movie" | "series",
  streamId: string | number,
  containerExt: string = "mp4"
): string {
  let ext = containerExt;
  if (type === "live" && (!ext || ext === "mp4")) {
    ext = "m3u8";
  }
  return `${BASE_PROXY_URL}/stream?type=${type}&stream_id=${streamId}&container=${ext}`;
}

export function getThemeAudioUrl(tvdbId: string | number): string {
  return `${BASE_PROXY_URL}/theme?tvdb_id=${tvdbId}`;
}

export async function fetchPlayerApi<T>(
  action: string,
  extraParams: Record<string, string | number> = {},
  force: boolean = false
): Promise<T> {
  const url = new URL(`${BASE_PROXY_URL}/player_api`, typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  url.searchParams.set("action", action);
  if (force) url.searchParams.set("force", "true");

  Object.entries(extraParams).forEach(([key, val]) => {
    url.searchParams.set(key, String(val));
  });

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`API call failed: ${action} (${res.status} ${res.statusText})`);
  }

  return res.json();
}

export async function fetchLiveCategories(force = false): Promise<Category[]> {
  return fetchPlayerApi<Category[]>("get_live_categories", {}, force);
}

export async function fetchLiveStreams(force = false): Promise<LiveStream[]> {
  return fetchPlayerApi<LiveStream[]>("get_live_streams", {}, force);
}

export async function fetchVodCategories(force = false): Promise<Category[]> {
  return fetchPlayerApi<Category[]>("get_vod_categories", {}, force);
}

export async function fetchVodStreams(force = false): Promise<VodStream[]> {
  return fetchPlayerApi<VodStream[]>("get_vod_streams", {}, force);
}

export async function fetchVodInfo(vodId: string | number, force = false): Promise<VodInfo> {
  return fetchPlayerApi<VodInfo>("get_vod_info", { vod_id: vodId }, force);
}

export async function fetchSeriesCategories(force = false): Promise<Category[]> {
  return fetchPlayerApi<Category[]>("get_series_categories", {}, force);
}

export async function fetchSeries(force = false): Promise<Series[]> {
  return fetchPlayerApi<Series[]>("get_series", {}, force);
}

export async function fetchSeriesInfo(seriesId: string | number, force = false): Promise<SeriesInfo> {
  return fetchPlayerApi<SeriesInfo>("get_series_info", { series_id: seriesId }, force);
}

export async function fetchSkipTimestamps(
  id: string | number,
  season: string | number,
  episode: string | number,
  idType: "tvdb" | "tmdb" = "tvdb",
  force = false
): Promise<SkipTimestamps | null> {
  const url = new URL(`${BASE_PROXY_URL}/intro`, typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  if (idType === "tmdb") {
    url.searchParams.set("tmdb_id", String(id));
  } else {
    url.searchParams.set("tvdb_id", String(id));
  }
  url.searchParams.set("season", String(season));
  url.searchParams.set("episode", String(episode));
  if (force) url.searchParams.set("force", "true");

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Intro API error: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.warn("Failed to fetch skip timestamps:", err);
    return null;
  }
}
