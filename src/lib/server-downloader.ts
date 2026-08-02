import fs from "fs";
import path from "path";
import { buildUpstreamStreamUrl } from "@/lib/xtream-client";

export interface ServerDownloadTask {
  id: string;
  streamId: string | number;
  type: "movie" | "series" | "live";
  title: string;
  containerExtension: string;
  poster?: string;
  status: "queued" | "downloading" | "paused" | "completed" | "failed";
  bytesDownloaded: number;
  totalBytes: number;
  progressPercent: number;
  downloadSpeedBps: number;
  etaSeconds: number;
  filePath?: string;
  errorReason?: string;
  downloadedAt: number;
}

// In-memory registry of server download tasks
const taskMap = new Map<string, ServerDownloadTask>();
const abortControllers = new Map<string, AbortController>();

function getDownloadDir(): string {
  const dir = path.join(process.cwd(), ".downloads");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getAllServerDownloadTasks(): ServerDownloadTask[] {
  return Array.from(taskMap.values());
}

export function getServerDownloadTask(id: string): ServerDownloadTask | undefined {
  return taskMap.get(id);
}

export async function createServerDownloadTask(params: {
  streamId: string | number;
  type: "movie" | "series" | "live";
  title: string;
  containerExtension?: string;
  poster?: string;
}): Promise<ServerDownloadTask> {
  const id = `srv_dl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const ext = params.containerExtension || "mp4";

  const task: ServerDownloadTask = {
    id,
    streamId: params.streamId,
    type: params.type,
    title: params.title,
    containerExtension: ext,
    poster: params.poster,
    status: "queued",
    bytesDownloaded: 0,
    totalBytes: 0,
    progressPercent: 0,
    downloadSpeedBps: 0,
    etaSeconds: 0,
    downloadedAt: Date.now(),
  };

  taskMap.set(id, task);

  // Start download in background process
  executeServerDownload(id).catch((err) => {
    console.error(`[ServerDownloader] Execution error for ${id}:`, err);
  });

  return task;
}

async function executeServerDownload(id: string): Promise<void> {
  const task = taskMap.get(id);
  if (!task) return;

  const controller = new AbortController();
  abortControllers.set(id, controller);

  task.status = "downloading";

  const upstreamUrl = buildUpstreamStreamUrl(task.type, String(task.streamId), task.containerExtension);
  const downloadDir = getDownloadDir();
  const fileName = `${id}.${task.containerExtension}`;
  const filePath = path.join(downloadDir, fileName);
  task.filePath = filePath;

  const startTime = Date.now();
  let receivedBytes = 0;

  try {
    const response = await fetch(upstreamUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "VLC/3.0.18 LibVLC/3.0.18",
      },
    });

    if (!response.ok || !response.body) {
      throw new Error(`Upstream server returned status ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const json = await response.json().catch(() => null);
      throw new Error(json?.error || "Upstream stream returned JSON error payload");
    }

    const contentLength = response.headers.get("content-length");
    task.totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

    const fileStream = fs.createWriteStream(filePath);

    // Read response body stream using Node/Web stream reader
    const reader = (response.body as any).getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (value) {
        fileStream.write(Buffer.from(value));
        receivedBytes += value.length;

        const elapsedTime = (Date.now() - startTime) / 1000;
        const currentSpeed = elapsedTime > 0 ? Math.round(receivedBytes / elapsedTime) : 0;
        const percent = task.totalBytes > 0 ? Math.min(99, Math.round((receivedBytes / task.totalBytes) * 100)) : 0;
        const remainingBytes = Math.max(0, task.totalBytes - receivedBytes);
        const eta = currentSpeed > 0 ? Math.round(remainingBytes / currentSpeed) : 0;

        task.bytesDownloaded = receivedBytes;
        task.progressPercent = percent;
        task.downloadSpeedBps = currentSpeed;
        task.etaSeconds = eta;
      }
    }

    fileStream.end();

    task.status = "completed";
    task.progressPercent = 100;
    task.downloadSpeedBps = 0;
    task.etaSeconds = 0;
    if (task.totalBytes === 0) {
      task.totalBytes = receivedBytes;
    }
  } catch (err: any) {
    if (controller.signal.aborted) {
      task.status = "paused";
      task.errorReason = "Download paused by user";
    } else {
      task.status = "failed";
      task.errorReason = err.message || "Server download failed";
      console.error(`[ServerDownloader] Task ${id} failed:`, err);
    }
    // Clean up partial file if failed
    if (task.status === "failed" && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {}
    }
  } finally {
    abortControllers.delete(id);
  }
}

export function pauseServerDownload(id: string): boolean {
  const controller = abortControllers.get(id);
  if (controller) {
    controller.abort();
    abortControllers.delete(id);
    const task = taskMap.get(id);
    if (task) {
      task.status = "paused";
    }
    return true;
  }
  return false;
}

export function resumeServerDownload(id: string): boolean {
  const task = taskMap.get(id);
  if (task && (task.status === "paused" || task.status === "failed")) {
    task.status = "queued";
    executeServerDownload(id).catch((err) => {
      console.error(`[ServerDownloader] Resume error for ${id}:`, err);
    });
    return true;
  }
  return false;
}

export function deleteServerDownload(id: string): boolean {
  pauseServerDownload(id);
  const task = taskMap.get(id);
  if (task && task.filePath && fs.existsSync(task.filePath)) {
    try {
      fs.unlinkSync(task.filePath);
    } catch {}
  }
  return taskMap.delete(id);
}
