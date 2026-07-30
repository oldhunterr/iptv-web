import { NextRequest, NextResponse } from "next/server";
import { getXtreamConfig } from "@/lib/xtream-client";

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const { host } = getXtreamConfig();
    const formattedHost = host.startsWith("http") ? host : `http://${host}`;
    
    // Construct the upstream URL
    const joinedPath = params.path.join("/");
    const upstreamUrl = `${formattedHost}/hlsr/${joinedPath}`;

    // Range header parsing
    const rangeHeader = request.headers.get("range");
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
        { error: "Failed to stream segment from upstream server" },
        { status: 502, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return NextResponse.json(
        { error: `Upstream returned ${upstreamRes.status}` },
        { status: upstreamRes.status === 404 ? 404 : 502, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const responseHeaders = new Headers();
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, OPTIONS, HEAD");
    responseHeaders.set("Access-Control-Allow-Headers", "*");
    responseHeaders.set("Accept-Ranges", "bytes");

    // Copy Content-Type, Content-Length, Content-Range
    const copyHeaders = ["content-type", "content-length", "content-range"];
    copyHeaders.forEach((h) => {
      const val = upstreamRes.headers.get(h);
      if (val) responseHeaders.set(h, val);
    });

    return new NextResponse(upstreamRes.body, {
      status: upstreamRes.status === 206 ? 206 : 200,
      headers: responseHeaders,
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
      "Access-Control-Allow-Methods": "GET, OPTIONS, HEAD",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
