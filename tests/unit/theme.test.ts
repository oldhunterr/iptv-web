import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { serverCache } from "../../src/lib/cache";
import { GET, OPTIONS } from "../../src/app/api/proxy/theme/route";

describe("Plex Theme Music Proxy Route Unit Tests", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    serverCache.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should return 400 when tvdb_id query parameter is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/proxy/theme");
    const res = await GET(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("tvdb_id");
  });

  it("should fetch theme audio from Plex server on cache miss and return MP3 stream", async () => {
    const mockAudioBytes = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00]); // Fake ID3 header
    let capturedUrl = "";

    global.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve(
        new Response(mockAudioBytes, {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        })
      );
    });

    const req = new NextRequest("http://localhost:3000/api/proxy/theme?tvdb_id=121361");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(res.headers.get("X-Cache")).toBe("MISS");
    expect(capturedUrl).toBe("http://tvthemes.plexapp.com/121361.mp3");

    const arrayBuffer = await res.arrayBuffer();
    const resultBytes = new Uint8Array(arrayBuffer);
    expect(resultBytes).toEqual(mockAudioBytes);
  });

  it("should return cached audio bytes on cache hit with X-Cache: HIT", async () => {
    const mockAudioBytes = new Uint8Array([1, 2, 3, 4, 5]);
    const cacheKey = serverCache.formatThemeKey(121361);
    serverCache.set(cacheKey, mockAudioBytes);

    const req = new NextRequest("http://localhost:3000/api/proxy/theme?tvdb_id=121361");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Cache")).toBe("HIT");
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");

    const arrayBuffer = await res.arrayBuffer();
    const resultBytes = new Uint8Array(arrayBuffer);
    expect(resultBytes).toEqual(mockAudioBytes);
  });

  it("should return 404 when Plex theme music does not exist for TVDB ID", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(null, { status: 404, statusText: "Not Found" })
    );

    const req = new NextRequest("http://localhost:3000/api/proxy/theme?tvdb_id=00000");
    const res = await GET(req);
    expect(res.status).toBe(404);

    const data = await res.json();
    expect(data.error).toContain("Plex theme music not found");
  });

  it("should respond to OPTIONS request with 200 and CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
