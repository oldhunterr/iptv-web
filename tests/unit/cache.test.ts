import { describe, it, expect, beforeEach, vi } from "vitest";
import { CacheEngine, serverCache } from "../../src/lib/cache";

describe("CacheEngine Unit Tests", () => {
  let cache: CacheEngine;

  beforeEach(() => {
    cache = new CacheEngine(5, 1000); // maxSize = 5, defaultTtl = 1000ms
  });

  it("should store and retrieve non-expired items", () => {
    cache.set("key1", { data: "test1" });
    const result = cache.get<{ data: string }>("key1");
    expect(result).toEqual({ data: "test1" });
    expect(cache.has("key1")).toBe(true);
  });

  it("should return undefined and count miss for missing keys", () => {
    const result = cache.get("non_existent_key");
    expect(result).toBeUndefined();
    expect(cache.has("non_existent_key")).toBe(false);

    const stats = cache.getStats();
    expect(stats.misses).toBe(1);
    expect(stats.hits).toBe(0);
  });

  it("should expire items after TTL", async () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    cache.set("short_key", "val1", 500); // 500ms TTL
    expect(cache.get("short_key")).toBe("val1");

    // Advance time by 600ms
    vi.setSystemTime(now + 600);

    expect(cache.get("short_key")).toBeUndefined();
    expect(cache.has("short_key")).toBe(false);

    vi.useRealTimers();
  });

  it("should support purging expired items and tracking stats", () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    cache.set("k1", "v1", 200);
    cache.set("k2", "v2", 1000);
    cache.set("k3", "v3", 200);

    vi.setSystemTime(now + 300);

    const purged = cache.purgeExpired();
    expect(purged).toBe(2);

    const stats = cache.getStats();
    expect(stats.size).toBe(1);
    expect(stats.keys).toEqual(["k2"]);

    vi.useRealTimers();
  });

  it("should evict oldest items when max capacity is reached", () => {
    vi.useFakeTimers();
    let now = Date.now();

    for (let i = 1; i <= 5; i++) {
      vi.setSystemTime(now + i * 10);
      cache.set(`key${i}`, `val${i}`);
    }

    expect(cache.getStats().size).toBe(5);

    // Adding 6th item when max capacity is 5
    vi.setSystemTime(now + 100);
    cache.set("key6", "val6");

    expect(cache.getStats().size).toBe(5);
    expect(cache.has("key1")).toBe(false); // key1 was oldest and evicted
    expect(cache.has("key6")).toBe(true);

    vi.useRealTimers();
  });

  it("should delete specific keys and clear all entries", () => {
    cache.set("a", 1);
    cache.set("b", 2);

    expect(cache.delete("a")).toBe(true);
    expect(cache.has("a")).toBe(false);
    expect(cache.has("b")).toBe(true);

    cache.clear();
    expect(cache.getStats().size).toBe(0);
    expect(cache.getStats().hits).toBe(0);
    expect(cache.getStats().misses).toBe(0);
  });

  it("should format deterministic cache keys for different domains", () => {
    const playerKey = cache.formatPlayerApiKey("get_series", { category_id: "5", page: "1" });
    expect(playerKey).toBe("player_api:action=get_series&category_id=5&page=1");

    const tmdbKey = cache.formatTmdbKey("tv", 1399, 1);
    expect(tmdbKey).toBe("tmdb:id=1399&season=1&type=tv");

    const introKey = cache.formatIntroKey(121361, 1, 5);
    expect(introKey).toBe("intro:episode=5&season=1&tvdb_id=121361");

    const themeKey = cache.formatThemeKey(121361);
    expect(themeKey).toBe("theme:tvdb_id=121361");
  });

  it("should prevent disk cache key collisions for equal-length non-ASCII Arabic titles", () => {
    const key1 = cache.formatTmdbKey("search_tv", "بيارق العربا", undefined, "ar-SA", "2011");
    const key2 = cache.formatTmdbKey("search_tv", "مختار الثقفي", undefined, "ar-SA", "2011");

    expect(key1).not.toEqual(key2);

    cache.set(key1, { title: "بيارق العربا" });
    cache.set(key2, { title: "مختار الثقفي" });

    expect(cache.get(key1)).toEqual({ title: "بيارق العربا" });
    expect(cache.get(key2)).toEqual({ title: "مختار الثقفي" });
  });

  it("should export global serverCache instance", () => {
    expect(serverCache).toBeInstanceOf(CacheEngine);
  });
});
