import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, OPTIONS } from "../../src/app/api/proxy/stream/route";

describe("Stream Proxy API Route Unit Tests", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should return 400 when type or stream_id is missing or invalid", async () => {
    const req1 = new NextRequest("http://localhost:3000/api/proxy/stream");
    const res1 = await GET(req1);
    expect(res1.status).toBe(400);

    const req2 = new NextRequest("http://localhost:3000/api/proxy/stream?type=invalid_type&stream_id=123");
    const res2 = await GET(req2);
    expect(res2.status).toBe(400);

    const req3 = new NextRequest("http://localhost:3000/api/proxy/stream?type=movie");
    const res3 = await GET(req3);
    expect(res3.status).toBe(400);
  });

  it("should return 416 Range Not Satisfiable when range header is inverted", async () => {
    const req = new NextRequest("http://localhost:3000/api/proxy/stream?type=movie&stream_id=45012&container=mp4", {
      headers: {
        Range: "bytes=500-200",
      },
    });
    const res = await GET(req);
    expect(res.status).toBe(416);
    expect(res.headers.get("Content-Range")).toBe("bytes */*");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("should forward Range header and VLC User-Agent to upstream server for 206 Partial Content", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};

    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      return Promise.resolve(
        new Response("mock chunk data", {
          status: 206,
          headers: {
            "Content-Type": "video/mp4",
            "Content-Length": "131072",
            "Content-Range": "bytes 0-131071/10485760",
          },
        })
      );
    });

    const req = new NextRequest("http://localhost:3000/api/proxy/stream?type=movie&stream_id=45012&container=mp4", {
      headers: {
        Range: "bytes=0-131071",
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(206);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Accept-Ranges")).toBe("bytes");
    expect(res.headers.get("Content-Type")).toBe("video/mp4");
    expect(res.headers.get("Content-Range")).toBe("bytes 0-131071/10485760");

    expect(capturedUserAgent(capturedHeaders)).toBe("VLC/3.0.18 LibVLC/3.0.18");
    expect(capturedHeaders["Range"]).toBe("bytes=0-131071");
    expect(capturedUrl).toContain("/movie/66764023/13715132950979/45012.mp4");
  });

  it("should handle upstream stream network failure with status 502", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network connection error"));

    const req = new NextRequest("http://localhost:3000/api/proxy/stream?type=live&stream_id=10045");
    const res = await GET(req);
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toContain("Failed to stream");
  });

  it("should respond to OPTIONS request with 200 and CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });

  function capturedUserAgent(headers: Record<string, string>): string {
    return headers["User-Agent"] || headers["user-agent"] || "";
  }
});
