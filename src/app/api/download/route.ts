import { NextRequest, NextResponse } from "next/server";
import {
  getAllServerDownloadTasks,
  createServerDownloadTask,
  pauseServerDownload,
  resumeServerDownload,
  deleteServerDownload,
} from "@/lib/server-downloader";

export const dynamic = "force-dynamic";

// GET /api/download -> Get real-time status of all server-side downloads
export async function GET() {
  const tasks = getAllServerDownloadTasks();
  return NextResponse.json({ tasks }, { headers: { "Cache-Control": "no-store" } });
}

// POST /api/download -> Start, Pause, Resume, or Delete a server download
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, streamId, type, title, containerExtension, poster, id } = body;

    if (action === "start") {
      if (!streamId || !type || !title) {
        return NextResponse.json(
          { error: "Missing required fields: streamId, type, title" },
          { status: 400 }
        );
      }

      const task = await createServerDownloadTask({
        streamId,
        type: type === "series" ? "series" : type === "live" ? "live" : "movie",
        title,
        containerExtension,
        poster,
      });

      return NextResponse.json({ success: true, task });
    }

    if (action === "pause" && id) {
      const ok = pauseServerDownload(id);
      return NextResponse.json({ success: ok });
    }

    if (action === "resume" && id) {
      const ok = resumeServerDownload(id);
      return NextResponse.json({ success: ok });
    }

    if (action === "delete" && id) {
      const ok = deleteServerDownload(id);
      return NextResponse.json({ success: ok });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process download request" }, { status: 500 });
  }
}
