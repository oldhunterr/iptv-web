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

  // 2. Completed File Streaming Mode (Supports HTTP 206 Range Seeking)
  if (isFile && id) {
    const task = getServerDownloadTask(id);
    if (!task || !task.filePath || !fs.existsSync(task.filePath)) {
      return NextResponse.json({ error: "File not found or not ready" }, { status: 404 });
    }

    const stat = fs.statSync(task.filePath);
    const fileSize = stat.size;
    const range = request.headers.get("range");

    const ext = task.containerExtension || "mp4";
    const contentType = ext === "mkv" ? "video/x-matroska" : ext === "webm" ? "video/webm" : `video/${ext}`;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (isNaN(start) || start >= fileSize) {
        return new Response("Requested range not satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${fileSize}` },
        });
      }

      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(task.filePath, { start, end });

      return new Response(fileStream as any, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunksize),
          "Content-Type": contentType,
          "Cache-Control": "no-cache",
        },
      });
    } else {
      const fileStream = fs.createReadStream(task.filePath);
      return new Response(fileStream as any, {
        status: 200,
        headers: {
          "Content-Length": String(fileSize),
          "Accept-Ranges": "bytes",
          "Content-Type": contentType,
          "Cache-Control": "no-cache",
        },
      });
    }
  }

  // 3. JSON Tasks List Mode
  const tasks = getAllServerDownloadTasks();
  return NextResponse.json({ tasks }, { headers: { "Cache-Control": "no-store" } });
}

// POST /api/download -> Start, Pause, Resume, or Delete a server download
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, streamId, type, title, seriesTitle, seasonNum, episodeNum, containerExtension, poster, id } = body;

    if (action === "start") {
      if (!streamId || !type || !title) {
        return NextResponse.json(
          { error: "Missing required fields: streamId, type, title" },
          { status: 400 }
        );
      }

      const task = await createServerDownloadTask({
        streamId,
        type,
        title,
        seriesTitle,
        seasonNum,
        episodeNum,
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
