import { NextRequest, NextResponse } from "next/server";
import { serverCache } from "@/lib/cache";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tvdbId = searchParams.get("tvdb_id") || searchParams.get("id");
    const force = searchParams.get("force") === "true";

    if (!tvdbId) {
      return NextResponse.json(
        { error: "Missing required parameter 'tvdb_id'" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const cacheKey = serverCache.formatThemeKey(tvdbId);

    // 1. Check Server Cache
    if (!force) {
      const cachedBuffer = serverCache.get<Uint8Array>(cacheKey);
      if (cachedBuffer) {
        return new NextResponse(cachedBuffer as any, {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "Content-Length": String(cachedBuffer.byteLength),
            "Accept-Ranges": "bytes",
            "Access-Control-Allow-Origin": "*",
            "X-Cache": "HIT",
            "Cache-Control": "public, max-age=604800",
          },
        });
      }
    }

    // 2. Fetch fresh theme audio from Plex TV Themes server
    const targetUrl = `http://tvthemes.plexapp.com/${tvdbId}.mp3`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let upstreamRes: Response;
    try {
      upstreamRes = await fetch(targetUrl, {
        headers: {
          "User-Agent": "VLC/3.0.18 LibVLC/3.0.18",
        },
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        return NextResponse.json(
          { error: "Plex theme music request timed out" },
          { status: 504, headers: { "Access-Control-Allow-Origin": "*" } }
        );
      }
      return NextResponse.json(
        { error: "Failed to connect to Plex theme music server" },
        { status: 502, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!upstreamRes.ok) {
      if (upstreamRes.status === 404) {
        return NextResponse.json(
          { error: "Plex theme music not found for this TVDB ID" },
          { status: 404, headers: { "Access-Control-Allow-Origin": "*" } }
        );
      }
      return NextResponse.json(
        { error: `Plex theme server error: HTTP ${upstreamRes.status}` },
        { status: 502, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const arrayBuffer = await upstreamRes.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // 3. Cache binary MP3 buffer for 7 days (604,800 seconds)
    serverCache.set(cacheKey, uint8Array, 604800_000);

    return new NextResponse(uint8Array as any, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(uint8Array.byteLength),
        "Accept-Ranges": "bytes",
        "Access-Control-Allow-Origin": "*",
        "X-Cache": "MISS",
        "Cache-Control": "public, max-age=604800",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
