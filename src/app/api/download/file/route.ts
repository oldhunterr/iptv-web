import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { getServerDownloadTask } from "@/lib/server-downloader";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing task id" }, { status: 400 });
  }

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
