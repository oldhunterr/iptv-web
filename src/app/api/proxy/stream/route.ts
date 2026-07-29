import { NextRequest, NextResponse } from "next/server";
import { buildUpstreamStreamUrl } from "@/lib/xtream-client";

const VALID_TYPES = new Set(["live", "movie", "series"]);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const streamId = searchParams.get("stream_id") || searchParams.get("filename");
    const container = searchParams.get("container") || undefined;

    if (!type || !VALID_TYPES.has(type)) {
      return NextResponse.json(
        { error: "Invalid or missing 'type' parameter (must be live, movie, or series)" },
        {
          status: 400,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    if (!streamId) {
      return NextResponse.json(
        { error: "Missing 'stream_id' or 'filename' parameter" },
        {
          status: 400,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    // Range header parsing & validation
    const rangeHeader = request.headers.get("range");
    if (rangeHeader) {
      const match = rangeHeader.match(/^bytes=(\d+)-(\d+)?$/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : undefined;
        if (end !== undefined && start > end) {
          return new NextResponse(null, {
            status: 416,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Content-Range": "bytes */*",
            },
          });
        }
      }
    }

    const upstreamUrl = buildUpstreamStreamUrl(type, streamId, container);

    const upstreamHeaders: Record<string, string> = {
      "User-Agent": "VLC/3.0.18 LibVLC/3.0.18",
    };

    if (rangeHeader) {
      upstreamHeaders["Range"] = rangeHeader;
    }

    let upstreamRes: Response;
    try {
      upstreamRes = await fetch(upstreamUrl, {
        headers: upstreamHeaders,
        redirect: "follow",
      });
    } catch (err: any) {
      return NextResponse.json(
        { error: "Failed to stream media from upstream server" },
        {
          status: 502,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return NextResponse.json(
        { error: `Upstream media server returned error ${upstreamRes.status}` },
        {
          status: upstreamRes.status === 404 ? 404 : 502,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    const responseHeaders = new Headers();
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, OPTIONS, HEAD");
    responseHeaders.set("Access-Control-Allow-Headers", "*");
    responseHeaders.set("Accept-Ranges", "bytes");

    const contentType = upstreamRes.headers.get("content-type");
    if (contentType) {
      responseHeaders.set("Content-Type", contentType);
    } else {
      const ext = container || (streamId.includes(".") ? streamId.split(".").pop() : "ts");
      if (ext === "ts") responseHeaders.set("Content-Type", "video/mp2t");
      else if (ext === "mp4") responseHeaders.set("Content-Type", "video/mp4");
      else if (ext === "mkv") responseHeaders.set("Content-Type", "video/x-matroska");
      else if (ext === "m3u8") responseHeaders.set("Content-Type", "application/x-mpegURL");
      else responseHeaders.set("Content-Type", "application/octet-stream");
    }

    const contentLength = upstreamRes.headers.get("content-length");
    if (contentLength) {
      responseHeaders.set("Content-Length", contentLength);
    }

    const contentRange = upstreamRes.headers.get("content-range");
    if (contentRange) {
      responseHeaders.set("Content-Range", contentRange);
    }

    const responseStatus = upstreamRes.status === 206 ? 206 : 200;

    return new NextResponse(upstreamRes.body, {
      status: responseStatus,
      headers: responseHeaders,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server stream error" },
      {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS, HEAD",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
