import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { fetchIntroFromApi, getSkipTimestamps } from "../../src/lib/introdb";
import { serverCache } from "../../src/lib/cache";
import { GET, OPTIONS } from "../../src/app/api/proxy/intro/route";

describe("TheIntroDB Proxy Route & Helper Unit Tests", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    serverCache.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("introdb.ts Helper Functions", () => {
    it("should fetch skip timestamps from external API", async () => {
      const mockPayload = {
        tvdb_id: 121361,
        season: 1,
        episode: 1,
        intro: { start: 12000, end: 45000 },
        recap: null,
        credits: { start: 1400000, end: 1450000 },
      };

      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockPayload), { status: 200 })
      );

      const res = await fetchIntroFromApi(121361, 1, 1);
      expect(res).toEqual(mockPayload);
    });

    it("should return cached timestamps on subsequent calls", async () => {
      const mockPayload = {
        tvdb_id: 121361,
        season: 1,
        episode: 2,
        intro: { start: 5000, end: 30000 },
      };

      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockPayload), { status: 200 })
      );

      const res1 = await getSkipTimestamps(121361, 1, 2);
      expect(res1).toEqual(mockPayload);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second call should hit serverCache and NOT trigger fetch
      const res2 = await getSkipTimestamps(121361, 1, 2);
      expect(res2).toEqual(mockPayload);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("GET /api/proxy/intro Route Handler", () => {
    it("should return 400 when mandatory query parameters are missing", async () => {
      const req1 = new NextRequest("http://localhost:3000/api/proxy/intro");
      const res1 = await GET(req1);
      expect(res1.status).toBe(400);

      const req2 = new NextRequest("http://localhost:3000/api/proxy/intro?tvdb_id=121361&season=1");
      const res2 = await GET(req2);
      expect(res2.status).toBe(400);
    });

    it("should return cached response on hit with X-Cache: HIT", async () => {
      const cacheKey = serverCache.formatIntroKey(121361, 1, 1);
      const mockData = { intro: { start: 1000, end: 20000 } };
      serverCache.set(cacheKey, mockData);

      const req = new NextRequest(
        "http://localhost:3000/api/proxy/intro?tvdb_id=121361&season=1&episode=1"
      );
      const res = await GET(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("X-Cache")).toBe("HIT");

      const data = await res.json();
      expect(data).toEqual(mockData);
    });

    it("should query external API on cache miss and return X-Cache: MISS", async () => {
      const mockData = { intro: { start: 1000, end: 20000 } };
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockData), { status: 200 })
      );

      const req = new NextRequest(
        "http://localhost:3000/api/proxy/intro?tvdb_id=121361&season=1&episode=1"
      );
      const res = await GET(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("X-Cache")).toBe("MISS");

      const data = await res.json();
      expect(data).toEqual(mockData);
    });

    it("should return 404 when TheIntroDB does not have timestamps for media", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Not found" }), { status: 404 })
      );

      const req = new NextRequest(
        "http://localhost:3000/api/proxy/intro?tvdb_id=999999&season=99&episode=99"
      );
      const res = await GET(req);
      expect(res.status).toBe(404);
    });

    it("should respond to OPTIONS request with 200 and CORS headers", async () => {
      const res = await OPTIONS();
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });
});
