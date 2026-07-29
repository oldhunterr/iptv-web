import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getFavorites,
  isFavorite,
  toggleFavorite,
  removeFavorite,
  getWatchHistory,
  getWatchProgress,
  saveWatchProgress,
  removeFromHistory,
  clearWatchHistory,
  subscribeStorage,
} from "../../src/lib/storage";
import { CatalogItem } from "../../src/types/iptv";

// Mock localStorage for Vitest Node environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, "localStorage", {
  value: localStorageMock,
});

describe("Storage State Manager Unit Tests", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("should toggle favorites and manage state accurately", () => {
    const movieItem: CatalogItem = {
      type: "movies",
      stream_id: 101,
      name: "Inception",
      category_id: "5",
      rating: "8.8",
      stream_icon: "http://example.com/inception.jpg",
    };

    expect(isFavorite("movies", 101)).toBe(false);

    // Add to favorites
    const added = toggleFavorite(movieItem);
    expect(added).toBe(true);
    expect(isFavorite("movies", 101)).toBe(true);

    const favs = getFavorites();
    expect(favs).toHaveLength(1);
    expect(favs[0].title).toBe("Inception");

    // Remove via toggle
    const removed = toggleFavorite(movieItem);
    expect(removed).toBe(false);
    expect(isFavorite("movies", 101)).toBe(false);
    expect(getFavorites()).toHaveLength(0);
  });

  it("should remove specific favorite items directly", () => {
    const liveItem: CatalogItem = {
      type: "live",
      stream_id: 202,
      name: "CNN HD",
      category_id: "1",
    };

    toggleFavorite(liveItem);
    expect(isFavorite("live", 202)).toBe(true);

    removeFavorite("live", 202);
    expect(isFavorite("live", 202)).toBe(false);
  });

  it("should save and retrieve watch progress", () => {
    saveWatchProgress({
      key: "movies_101",
      id: 101,
      section: "movies",
      title: "Inception",
      poster: "http://example.com/inception.jpg",
      lastPosition: 1420,
      duration: 8880,
    });

    const progress = getWatchProgress("movies_101");
    expect(progress).not.toBeNull();
    expect(progress?.lastPosition).toBe(1420);
    expect(progress?.duration).toBe(8880);

    const history = getWatchHistory();
    expect(history).toHaveLength(1);
    expect(history[0].key).toBe("movies_101");
  });

  it("should remove individual items from watch history and clear all history", () => {
    saveWatchProgress({
      key: "series_10_s1e1_1",
      id: 1,
      section: "series",
      title: "Breaking Bad S01E01",
      lastPosition: 500,
      duration: 3000,
    });
    saveWatchProgress({
      key: "series_10_s1e2_2",
      id: 2,
      section: "series",
      title: "Breaking Bad S01E02",
      lastPosition: 1200,
      duration: 3000,
    });

    expect(getWatchHistory()).toHaveLength(2);

    removeFromHistory("series_10_s1e1_1");
    expect(getWatchHistory()).toHaveLength(1);
    expect(getWatchProgress("series_10_s1e1_1")).toBeNull();

    clearWatchHistory();
    expect(getWatchHistory()).toHaveLength(0);
  });

  it("should trigger subscription listeners on state changes", () => {
    const callback = vi.fn();
    const unsubscribe = subscribeStorage(callback);

    toggleFavorite({
      type: "live",
      stream_id: 303,
      name: "BBC News",
      category_id: "1",
    });

    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();

    toggleFavorite({
      type: "live",
      stream_id: 303,
      name: "BBC News",
      category_id: "1",
    });

    expect(callback).toHaveBeenCalledTimes(1); // Not called again after unsubscribe
  });
});
