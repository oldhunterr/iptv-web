import { NextRequest, NextResponse } from "next/server";
import { buildUpstreamPlayerUrl } from "@/lib/xtream-client";
import { serverCache } from "@/lib/cache";

const ALLOWED_ACTIONS = new Set([
  "get_live_categories",
  "get_live_streams",
  "get_vod_categories",
  "get_vod_streams",
  "get_series_categories",
  "get_series",
  "get_series_info",
  "get_vod_info",
  "get_simple_data_table",
]);

// Configurable TTLs in milliseconds per action
const ACTION_TTLS: Record<string, number> = {
  get_live_categories: 3600_000,   // 1 hour
  get_vod_categories: 3600_000,    // 1 hour
  get_series_categories: 3600_000, // 1 hour
  get_live_streams: 600_000,       // 10 minutes
  get_vod_streams: 600_000,        // 10 minutes
  get_series: 600_000,             // 10 minutes
  get_series_info: 1800_000,       // 30 minutes
  get_vod_info: 1800_000,          // 30 minutes
  get_simple_data_table: 1800_000, // 30 minutes
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const force = searchParams.get("force") === "true" || searchParams.get("refresh") === "1";

    if (!action || !ALLOWED_ACTIONS.has(action)) {
      return NextResponse.json(
        { error: "Invalid or missing action parameter" },
        {
          status: 400,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    if (action === "get_series_info" && !searchParams.get("series_id")) {
      return NextResponse.json(
        { error: "Missing mandatory parameter: series_id" },
        {
          status: 400,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    if (action === "get_vod_info" && !searchParams.get("vod_id")) {
      return NextResponse.json(
        { error: "Missing mandatory parameter: vod_id" },
        {
          status: 400,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    // Collect extra search parameters (excluding security/control parameters)
    const extraParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      const k = key.toLowerCase();
      if (k !== "action" && k !== "username" && k !== "password" && k !== "force" && k !== "refresh") {
        extraParams[key] = value;
      }
    });

    const cacheKey = serverCache.formatPlayerApiKey(action, extraParams);

    // 1. Check Server Cache
    if (!force) {
      const cachedData = serverCache.get(cacheKey);
      if (cachedData !== undefined) {
        return NextResponse.json(cachedData, {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "X-Cache": "HIT",
            "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
          },
        });
      }
    }

    // 2. Fetch fresh data from upstream Xtream API
    const upstreamUrl = buildUpstreamPlayerUrl(action, extraParams);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let upstreamRes: Response;
    try {
      upstreamRes = await fetch(upstreamUrl, {
        headers: {
          "User-Agent": "VLC/3.0.18 LibVLC/3.0.18",
          Accept: "application/json, text/plain, */*",
        },
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        return NextResponse.json(
          { error: "Upstream gateway timeout" },
          {
            status: 504,
            headers: { "Access-Control-Allow-Origin": "*" },
          }
        );
      }
      return NextResponse.json(
        { error: "Failed to connect to upstream Xtream API server" },
        {
          status: 502,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!upstreamRes.ok) {
      return NextResponse.json(
        { error: `Upstream Xtream API error: ${upstreamRes.statusText}` },
        {
          status: upstreamRes.status === 404 ? 404 : 502,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    let data: any;
    try {
      data = await upstreamRes.json();
    } catch (parseErr) {
      return NextResponse.json(
        { error: "Corrupted upstream JSON payload" },
        {
          status: 500,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    // 3. Cache valid JSON response with action-specific TTL
    const ttlMs = ACTION_TTLS[action] || 600_000;
    serverCache.set(cacheKey, data, ttlMs);

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "X-Cache": "MISS",
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
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
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
