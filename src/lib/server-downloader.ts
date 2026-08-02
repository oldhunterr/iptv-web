import fs from "fs";
import path from "path";
import http from "http";
import https from "https";
import { Transform } from "stream";
import { pipeline } from "stream/promises";
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

class ProgressTransform extends Transform {
  private taskId: string;
  private startTime: number;
  private initialBytes: number;
  private receivedBytes: number;
  private lastUpdate = 0;

  constructor(taskId: string, initialBytes = 0) {
    super({ highWaterMark: 1024 * 1024 }); // 1MB highWaterMark buffer for maximum streaming speed
    this.taskId = taskId;
    this.initialBytes = initialBytes;
    this.receivedBytes = initialBytes;
    this.startTime = Date.now();
  }

  _transform(chunk: any, encoding: string, callback: (err?: Error | null, data?: any) => void) {
    this.receivedBytes += chunk.length;
    const task = taskMap.get(this.taskId);
    const now = Date.now();

    // Throttle UI task metadata updates to every 250ms for maximum efficiency
    if (task && now - this.lastUpdate > 250) {
      this.lastUpdate = now;
      const elapsedTime = (now - this.startTime) / 1000;
      const currentSpeed = elapsedTime > 0 ? Math.round((this.receivedBytes - this.initialBytes) / elapsedTime) : 0;
      const percent = task.totalBytes > 0 ? Math.min(99, Math.round((this.receivedBytes / task.totalBytes) * 100)) : 0;
      const remainingBytes = Math.max(0, task.totalBytes - this.receivedBytes);
      const eta = currentSpeed > 0 ? Math.round(remainingBytes / currentSpeed) : 0;

      task.bytesDownloaded = this.receivedBytes;
      task.progressPercent = percent;
      task.downloadSpeedBps = currentSpeed;
      task.etaSeconds = eta;
    }

    callback(null, chunk);
  }
}

function fetchStreamWithRedirects(
  targetUrl: string,
  headers: Record<string, string>,
  abortSignal: AbortSignal,
  maxRedirects = 5
): Promise<{ res: http.IncomingMessage; finalUrl: string }> {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      reject(new Error("Too many HTTP redirects from IPTV upstream server"));
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch (e: any) {
      reject(new Error(`Invalid redirect URL '${targetUrl}': ${e.message}`));
      return;
    }

    const httpModule = parsedUrl.protocol === "https:" ? https : http;

    const req = httpModule.get(
      targetUrl,
      { headers },
      (res) => {
        // Handle HTTP 301, 302, 303, 307, 308 Redirects
        if (
          res.statusCode &&
          [301, 302, 303, 307, 308].includes(res.statusCode) &&
          res.headers.location
        ) {
          const redirectTarget = new URL(res.headers.location, targetUrl).toString();
          fetchStreamWithRedirects(redirectTarget, headers, abortSignal, maxRedirects - 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        resolve({ res, finalUrl: targetUrl });
      }
    );

    abortSignal.addEventListener("abort", () => {
      req.destroy();
      reject(new Error("Download paused by user"));
    });

    req.on("error", (err) => reject(err));
  });
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

  const maxRetries = 10;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    if (controller.signal.aborted) {
      task.status = "paused";
      task.errorReason = "Download paused by user";
      abortControllers.delete(id);
      return;
    }

    let existingBytes = 0;
    if (fs.existsSync(filePath)) {
      try {
        existingBytes = fs.statSync(filePath).size;
      } catch {}
    }

    const headers: Record<string, string> = {
      "User-Agent": "VLC/3.0.18 LibVLC/3.0.18",
    };

    if (existingBytes > 0) {
      headers["Range"] = `bytes=${existingBytes}-`;
    }

    try {
      const { res } = await fetchStreamWithRedirects(upstreamUrl, headers, controller.signal);

      if (res.statusCode && res.statusCode !== 200 && res.statusCode !== 206) {
        throw new Error(`Upstream server returned HTTP status ${res.statusCode}`);
      }

      const contentType = res.headers["content-type"] || "";
      if (contentType.includes("application/json")) {
        throw new Error("Upstream stream returned JSON error response instead of video stream");
      }

      const contentLengthHeader = res.headers["content-length"];
      const streamContentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

      if (res.statusCode === 206 && streamContentLength > 0) {
        task.totalBytes = existingBytes + streamContentLength;
      } else if (res.statusCode === 200 && streamContentLength > 0) {
        task.totalBytes = streamContentLength;
        existingBytes = 0; // Upstream doesn't support Range, start fresh
      }

      const writeFlags = existingBytes > 0 && res.statusCode === 206 ? "a" : "w";
      const fileStream = fs.createWriteStream(filePath, { flags: writeFlags, highWaterMark: 1024 * 1024 });
      const progressStream = new ProgressTransform(id, existingBytes);

      await pipeline(res, progressStream, fileStream);

      // Verify file size after stream chunk completion
      const currentSize = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
      task.bytesDownloaded = currentSize;

      if (task.totalBytes > 0 && currentSize < task.totalBytes && attempt < maxRetries) {
        console.warn(`[ServerDownloader] Stream ended early (${currentSize}/${task.totalBytes} bytes). Retrying attempt ${attempt + 1}...`);
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      task.status = "completed";
      task.progressPercent = 100;
      task.downloadSpeedBps = 0;
      task.etaSeconds = 0;
      if (task.totalBytes === 0 && currentSize > 0) {
        task.totalBytes = currentSize;
      }
      break; // Download complete!
    } catch (err: any) {
      if (controller.signal.aborted) {
        task.status = "paused";
        task.errorReason = "Download paused by user";
        break;
      }

      console.warn(`[ServerDownloader] Task ${id} attempt ${attempt} error: ${err.message}`);
      if (attempt < maxRetries) {
        const backoffMs = Math.min(10000, attempt * 1500);
        await new Promise((r) => setTimeout(r, backoffMs));
      } else {
        task.status = "failed";
        task.errorReason = err.message || "Server download failed after multiple retries";
      }
    }
  }

  abortControllers.delete(id);
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
