import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import {
  getAllServerDownloadTasks,
  getServerDownloadTask,
  createServerDownloadTask,
  pauseServerDownload,
  resumeServerDownload,
  deleteServerDownload,
} from "@/lib/server-downloader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const isEvents = searchParams.get("events") === "true";
  const isFile = searchParams.get("file") === "true";
  const id = searchParams.get("id");

  // 1. SSE Stream Mode (Single Persistent Connection)
  if (isEvents) {
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        const sendUpdate = () => {
          try {
            const tasks = getAllServerDownloadTasks();
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ tasks })}\n\n`));
          } catch {
            // Controller might be closed
          }
        };

        sendUpdate();
        const interval = setInterval(sendUpdate, 1000);

        request.signal.addEventListener("abort", () => {
          clearInterval(interval);
          try {
            controller.close();
          } catch {}
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // 2. Completed File Streaming Mode
  if (isFile && id) {
    const task = getServerDownloadTask(id);
    if (!task || !task.filePath || !fs.existsSync(task.filePath)) {
      return NextResponse.json({ error: "File not found or not ready" }, { status: 404 });
    }

    const stat = fs.statSync(task.filePath);
    const fileStream = fs.createReadStream(task.filePath);

    return new NextResponse(fileStream as any, {
      headers: {
        "Content-Type": `video/${task.containerExtension || "mp4"}`,
        "Content-Length": String(stat.size),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(task.title)}.${task.containerExtension}"`,
      },
    });
  }

  // 3. JSON Tasks List Mode
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
