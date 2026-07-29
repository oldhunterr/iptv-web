import { CatalogItem, FavoriteItem, WatchHistoryItem } from "@/types/iptv";

const FAVORITES_KEY = "iptv_favorites_v1";
const HISTORY_KEY = "iptv_watch_history_v1";

type StorageChangeListener = () => void;
const listeners: Set<StorageChangeListener> = new Set();

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error("Storage listener error:", e);
    }
  });
}

export function subscribeStorage(listener: StorageChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getItemKey(section: string, id: string | number): string {
  return `${section}_${id}`;
}

function getStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  if (typeof globalThis !== "undefined" && (globalThis as any).localStorage) return (globalThis as any).localStorage;
  if (typeof localStorage !== "undefined") return localStorage;
  return null;
}

export function getFavorites(): FavoriteItem[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to load favorites from localStorage:", e);
    return [];
  }
}

export function isFavorite(section: "live" | "movies" | "series", id: string | number): boolean {
  const favorites = getFavorites();
  const key = getItemKey(section, id);
  return favorites.some((fav) => fav.key === key);
}

export function toggleFavorite(item: CatalogItem): boolean {
  const storage = getStorage();
  if (!storage) return false;
  const favorites = getFavorites();
  const itemId = item.type === "series" ? item.series_id : item.stream_id;
  const key = getItemKey(item.type, itemId!);
  const existingIndex = favorites.findIndex((fav) => fav.key === key);

  let isNowFavorite = false;
  if (existingIndex >= 0) {
    favorites.splice(existingIndex, 1);
    isNowFavorite = false;
  } else {
    let title = "";
    let poster: string | undefined = undefined;
    let rating: string | undefined = undefined;

    if (item.type === "live") {
      title = item.name || item.title;
      poster = item.stream_icon || item.poster;
    } else if (item.type === "movies" || item.type === "vod") {
      title = item.name || item.title;
      poster = item.stream_icon || item.poster;
      rating = String(item.rating || "");
    } else if (item.type === "series") {
      title = item.name || item.title;
      poster = item.cover || item.poster;
      rating = String(item.rating || "");
    }

    favorites.unshift({
      key,
      id: itemId!,
      section: item.type === "vod" ? "movies" : (item.type as "live" | "movies" | "series"),
      title,
      poster,
      rating,
      item,
      addedAt: Date.now(),
    });
    isNowFavorite = true;
  }

  try {
    storage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    notifyListeners();
  } catch (e) {
    console.error("Failed to save favorites to localStorage:", e);
  }

  return isNowFavorite;
}

export function removeFavorite(section: "live" | "movies" | "series", id: string | number): void {
  const storage = getStorage();
  if (!storage) return;
  const favorites = getFavorites();
  const key = getItemKey(section, id);
  const filtered = favorites.filter((fav) => fav.key !== key);
  try {
    storage.setItem(FAVORITES_KEY, JSON.stringify(filtered));
    notifyListeners();
  } catch (e) {
    console.error("Failed to remove favorite from localStorage:", e);
  }
}

export function getWatchHistory(): WatchHistoryItem[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to load history from localStorage:", e);
    return [];
  }
}

export interface SeriesWatchProgress {
  key: string;
  seriesId: string | number;
  episodesCount: number;
  completedCount: number;
  lastPosition: number;
  duration: number;
  percent: number;
  isWatched: boolean;
  updatedAt: number;
  lastEpisode?: WatchHistoryItem;
}

export function getSeriesProgress(seriesId: string | number): SeriesWatchProgress | null {
  if (typeof localStorage === "undefined") return null;
  const history = getWatchHistory();
  const targetId = String(seriesId);

  const seriesItems = history.filter((h) => {
    if (h.section !== "series") return false;
    if (String(h.id) === targetId) return true;
    if (h.key === `series_${targetId}`) return true;
    if (h.key.startsWith(`series_${targetId}_`)) return true;
    return false;
  });

  if (seriesItems.length === 0) return null;

  seriesItems.sort((a, b) => b.updatedAt - a.updatedAt);
  const latest = seriesItems[0];

  const completedCount = seriesItems.filter(
    (h) => h.duration > 0 && h.lastPosition / h.duration >= 0.9
  ).length;

  const percent =
    latest.duration > 0
      ? Math.min(100, Math.floor((latest.lastPosition / latest.duration) * 100))
      : 0;

  const isWatched = percent >= 90 || completedCount > 0;

  return {
    key: `series_${targetId}`,
    seriesId,
    episodesCount: seriesItems.length,
    completedCount,
    lastPosition: latest.lastPosition,
    duration: latest.duration,
    percent,
    isWatched,
    updatedAt: latest.updatedAt,
    lastEpisode: latest,
  };
}

export function getWatchProgress(key: string): WatchHistoryItem | null {
  const history = getWatchHistory();
  const direct = history.find((h) => h.key === key);
  if (direct) return direct;

  if (key.startsWith("series_")) {
    const seriesId = key.replace("series_", "");
    const seriesProg = getSeriesProgress(seriesId);
    if (seriesProg && seriesProg.lastEpisode) {
      return {
        key,
        id: seriesId,
        section: "series",
        title: seriesProg.lastEpisode.title,
        poster: seriesProg.lastEpisode.poster,
        lastPosition: seriesProg.lastPosition,
        duration: seriesProg.duration,
        updatedAt: seriesProg.updatedAt,
      };
    }
  }

  return null;
}

export function saveWatchProgress(progress: Omit<WatchHistoryItem, "updatedAt">): void;
export function saveWatchProgress(
  key: string,
  currentTime: number,
  duration: number,
  isWatched?: boolean,
  metadata?: { id?: string | number; section?: "live" | "movies" | "series"; title?: string; poster?: string }
): void;
export function saveWatchProgress(
  keyOrProgress: string | Omit<WatchHistoryItem, "updatedAt">,
  currentTime?: number,
  duration?: number,
  isWatched?: boolean,
  metadata?: { id?: string | number; section?: "live" | "movies" | "series"; title?: string; poster?: string }
): void {
  if (typeof localStorage === "undefined") return;
  const history = getWatchHistory();

  let itemToSave: Omit<WatchHistoryItem, "updatedAt">;

  if (typeof keyOrProgress === "object") {
    itemToSave = keyOrProgress;
  } else {
    const key = keyOrProgress;
    const existing = history.find((h) => h.key === key);
    const dur = duration ?? existing?.duration ?? 0;
    const pos = isWatched ? dur : (currentTime ?? existing?.lastPosition ?? 0);

    let section: "live" | "movies" | "series" = metadata?.section || existing?.section || "movies";
    if (key.startsWith("series_")) {
      section = "series";
    } else if (key.startsWith("movies_") || key.startsWith("vod_")) {
      section = "movies";
    } else if (key.startsWith("live_")) {
      section = "live";
    }

    let id: string | number = metadata?.id || existing?.id || key;

    itemToSave = {
      key,
      id,
      section,
      title: metadata?.title || existing?.title || key,
      poster: metadata?.poster || existing?.poster,
      lastPosition: pos,
      duration: dur,
    };
  }

  const storage = getStorage();
  if (!storage) return;

  const existingIndex = history.findIndex((h) => h.key === itemToSave.key);
  const updatedItem: WatchHistoryItem = {
    ...itemToSave,
    updatedAt: Date.now(),
  };

  if (existingIndex >= 0) {
    history[existingIndex] = updatedItem;
  } else {
    history.unshift(updatedItem);
  }

  try {
    storage.setItem(HISTORY_KEY, JSON.stringify(history));
    notifyListeners();
  } catch (e) {
    console.error("Failed to save watch history to localStorage:", e);
  }
}

export function removeFromHistory(key: string): void {
  const storage = getStorage();
  if (!storage) return;
  const history = getWatchHistory();
  const filtered = history.filter((h) => h.key !== key);
  try {
    storage.setItem(HISTORY_KEY, JSON.stringify(filtered));
    notifyListeners();
  } catch (e) {
    console.error("Failed to remove watch history item:", e);
  }
}

export function clearWatchHistory(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(HISTORY_KEY);
    notifyListeners();
  } catch (e) {
    console.error("Failed to clear watch history:", e);
  }
}
