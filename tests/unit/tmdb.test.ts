import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import {
  cleanTitle,
  hasRequiredXtreamMetadata,
  resolveMetadata,
  fetchTmdbFromApi,
  getTmdbApiKey,
} from "../../src/lib/tmdb";
import { serverCache } from "../../src/lib/cache";
import { GET, OPTIONS } from "../../src/app/api/proxy/tmdb/route";

describe("TMDB & Smart Metadata Resolver Unit Tests", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    serverCache.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("cleanTitle Utility", () => {
    it("should strip country tags, quality tags, and extract release year", () => {
      const res1 = cleanTitle("US: Inception (2010) [1080p]");
      expect(res1.title).toBe("Inception");
      expect(res1.year).toBe("2010");

      const res2 = cleanTitle("UK| Breaking Bad [4K]");
      expect(res2.title).toBe("Breaking Bad");
      expect(res2.year).toBeUndefined();
    });
  });

  describe("hasRequiredXtreamMetadata", () => {
    it("should return true when all 6 metadata fields are present", () => {
      const fullItem = {
        name: "Inception",
        cover: "http://img.jpg",
        plot: "A thief who steals corporate secrets...",
        cast: "Leonardo DiCaprio",
        director: "Christopher Nolan",
        rating: "8.8",
        releaseDate: "2010-07-15",
      };
      expect(hasRequiredXtreamMetadata(fullItem)).toBe(true);
    });

    it("should return false if any required field is missing or empty", () => {
      const missingPlot = {
        name: "Inception",
        cover: "http://img.jpg",
        plot: "",
        cast: "Leonardo DiCaprio",
        director: "Christopher Nolan",
        rating: "8.8",
        releaseDate: "2010-07-15",
      };
      expect(hasRequiredXtreamMetadata(missingPlot)).toBe(false);
    });
  });

  describe("resolveMetadata Smart Resolver (R4 Requirement)", () => {
    it("should return Xtream metadata directly when all fields exist (source: xtream)", async () => {
      const fullItem = {
        series_id: 101,
        name: "Breaking Bad",
        cover: "http://img.jpg",
        plot: "Chemistry teacher...",
        cast: "Bryan Cranston",
        director: "Vince Gilligan",
        rating: "9.5",
        releaseDate: "2008-01-20",
      };

      const result = await resolveMetadata(fullItem, "tv");
      expect(result.source).toBe("xtream");
      expect(result.title).toBe("Breaking Bad");
    });

    it("should return cached metadata if present (source: cache)", async () => {
      const incompleteItem = {
        series_id: 102,
        name: "Game of Thrones",
        tmdb_id: "1399",
      };

      const cachedEntry = {
        title: "Game of Thrones",
        overview: "Seven noble families...",
        source: "tmdb" as const,
      };

      const cacheKey = serverCache.formatTmdbKey("tv", "1399");
      serverCache.set(cacheKey, cachedEntry);

      const result = await resolveMetadata(incompleteItem, "tv");
      expect(result.source).toBe("cache");
      expect(result.title).toBe("Game of Thrones");
    });

    it("should fetch from TMDB API when metadata is missing (source: tmdb)", async () => {
      const incompleteItem = {
        stream_id: 201,
        name: "Inception (2010)",
        tmdb_id: 27205,
      };

      const mockTmdbResponse = {
        id: 27205,
        title: "Inception",
        overview: "A thief who steals corporate secrets...",
        poster_path: "/inception.jpg",
        backdrop_path: "/backdrop.jpg",
        vote_average: 8.4,
        release_date: "2010-07-15",
        credits: {
          cast: [{ name: "Leonardo DiCaprio" }],
          crew: [{ job: "Director", name: "Christopher Nolan" }],
        },
      };

      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockTmdbResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const result = await resolveMetadata(incompleteItem, "movie");
      expect(result.source).toBe("tmdb");
      expect(result.title).toBe("Inception");
      expect(result.cast).toBe("Leonardo DiCaprio");
      expect(result.director).toBe("Christopher Nolan");
    });
  });

  describe("GET /api/proxy/tmdb Route Handler", () => {
    it("should return 400 when type parameter is missing or invalid", async () => {
      const req = new NextRequest("http://localhost:3000/api/proxy/tmdb");
      const res = await GET(req);
      expect(res.status).toBe(400);

      const req2 = new NextRequest("http://localhost:3000/api/proxy/tmdb?type=invalid");
      const res2 = await GET(req2);
      expect(res2.status).toBe(400);
    });

    it("should return cached response on hit with X-Cache: HIT header", async () => {
      const cacheKey = serverCache.formatTmdbKey("movie", "27205");
      const mockData = { id: 27205, title: "Inception" };
      serverCache.set(cacheKey, mockData);

      const req = new NextRequest("http://localhost:3000/api/proxy/tmdb?type=movie&id=27205");
      const res = await GET(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("X-Cache")).toBe("HIT");
      const data = await res.json();
      expect(data.title).toBe("Inception");
    });

    it("should fetch fresh data on cache miss and return X-Cache: MISS header", async () => {
      const mockData = { id: 27205, title: "Inception" };
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockData), { status: 200 })
      );

      const req = new NextRequest("http://localhost:3000/api/proxy/tmdb?type=movie&id=27205");
      const res = await GET(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("X-Cache")).toBe("MISS");
      const data = await res.json();
      expect(data.title).toBe("Inception");
    });

    it("should respond to OPTIONS requests with CORS headers", async () => {
      const res = await OPTIONS();
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });
});
