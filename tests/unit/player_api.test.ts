import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, OPTIONS } from "../../src/app/api/proxy/player_api/route";
import { serverCache } from "../../src/lib/cache";

describe("Player API Proxy Route Unit Tests", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    serverCache.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should return 400 when action parameter is missing or invalid", async () => {
    const req1 = new NextRequest("http://localhost:3000/api/proxy/player_api");
    const res1 = await GET(req1);
    expect(res1.status).toBe(400);
    const data1 = await res1.json();
    expect(data1.error).toContain("Invalid or missing action");

    const req2 = new NextRequest("http://localhost:3000/api/proxy/player_api?action=invalid_action");
    const res2 = await GET(req2);
    expect(res2.status).toBe(400);
  });

  it("should return 400 when get_series_info action is missing series_id", async () => {
    const req = new NextRequest("http://localhost:3000/api/proxy/player_api?action=get_series_info");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("series_id");
  });

  it("should return 400 when get_vod_info action is missing vod_id", async () => {
    const req = new NextRequest("http://localhost:3000/api/proxy/player_api?action=get_vod_info");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("vod_id");
  });

  it("should forward valid player_api action to upstream with VLC User-Agent and server credentials", async () => {
    const mockCategories = [{ category_id: "1", category_name: "USA News", parent_id: 0 }];
    
    let capturedUrl = "";
    let capturedUserAgent = "";

    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedUserAgent = (init?.headers as Record<string, string>)?.[ "User-Agent" ] || "";
      return Promise.resolve(
        new Response(JSON.stringify(mockCategories), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    const req = new NextRequest(
      "http://localhost:3000/api/proxy/player_api?action=get_live_categories&username=attacker&password=stolen"
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Cache")).toBe("MISS");

    const data = await res.json();
    expect(data).toEqual(mockCategories);
    expect(capturedUserAgent).toBe("VLC/3.0.18 LibVLC/3.0.18");

    const parsedUrl = new URL(capturedUrl);
    expect(parsedUrl.searchParams.get("action")).toBe("get_live_categories");
    expect(parsedUrl.searchParams.get("username")).toBe("66764023");
    expect(parsedUrl.searchParams.get("password")).toBe("13715132950979");
  });

  it("should cache player_api response and return X-Cache: HIT on subsequent requests", async () => {
    const mockStreams = [{ stream_id: 1, name: "Channel 1" }];
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockStreams), { status: 200 })
    );

    const req1 = new NextRequest("http://localhost:3000/api/proxy/player_api?action=get_live_streams");
    const res1 = await GET(req1);
    expect(res1.status).toBe(200);
    expect(res1.headers.get("X-Cache")).toBe("MISS");
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Second request should hit cache and NOT call fetch
    const req2 = new NextRequest("http://localhost:3000/api/proxy/player_api?action=get_live_streams");
    const res2 = await GET(req2);
    expect(res2.status).toBe(200);
    expect(res2.headers.get("X-Cache")).toBe("HIT");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const data2 = await res2.json();
    expect(data2).toEqual(mockStreams);
  });

  it("should bypass cache when force=true is supplied", async () => {
    const mockStreams = [{ stream_id: 1, name: "Channel 1" }];
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(mockStreams), { status: 200 }))
    );

    const req1 = new NextRequest("http://localhost:3000/api/proxy/player_api?action=get_live_streams");
    await GET(req1);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Request with force=true should bypass cache
    const req2 = new NextRequest("http://localhost:3000/api/proxy/player_api?action=get_live_streams&force=true");
    const res2 = await GET(req2);
    expect(res2.status).toBe(200);
    expect(res2.headers.get("X-Cache")).toBe("MISS");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("should handle corrupted upstream JSON payload cleanly with 500 status", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response("Invalid JSON string payload", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      })
    );

    const req = new NextRequest("http://localhost:3000/api/proxy/player_api?action=get_live_streams");
    const res = await GET(req);
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data.error).toContain("Corrupted upstream JSON");
  });

  it("should respond to OPTIONS request with 200 and CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });
});
