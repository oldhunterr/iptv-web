import fs from "fs";
import path from "path";
import http from "http";
import https from "https";
import { Transform } from "stream";
import { pipeline } from "stream/promises";
import { spawn, execSync } from "child_process";
import { buildUpstreamStreamUrl } from "@/lib/xtream-client";

export interface ServerDownloadTask {
  id: string;
  streamId: string | number;
  type: "movie" | "series" | "live";
  title: string;
  seriesTitle?: string;
  seasonNum?: number;
  episodeNum?: number;
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
  engineUsed?: "aria2c" | "native_multi_range";
}

// In-memory registry of server download tasks
const taskMap = new Map<string, ServerDownloadTask>();
const abortControllers = new Map<string, AbortController>();
const activeProcesses = new Map<string, any>();

let cachedAria2cAvailable: boolean | null = null;

function sanitizeFileName(str: string): string {
  return str.replace(/[\\/:*?"<>|]/g, "").trim();
}

function getDownloadDir(): string {
  const dir = path.join(process.cwd(), ".downloads");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function buildStructuredTaskPath(params: {
  type: "movie" | "series" | "live";
  title: string;
  containerExtension: string;
  seriesTitle?: string;
  seasonNum?: number;
  episodeNum?: number;
}): { dir: string; fileName: string; fullPath: string } {
  const baseDir = getDownloadDir();
  const ext = params.containerExtension || "mp4";

  if (params.type === "movie") {
    const movieFolder = sanitizeFileName(params.title);
    const dir = path.join(baseDir, "Movies", movieFolder);
    const fileName = `${movieFolder}.${ext}`;
    return { dir, fileName, fullPath: path.join(dir, fileName) };
  } else if (params.type === "series") {
    const seriesFolder = sanitizeFileName(params.seriesTitle || params.title.split(" — ")[0] || "TV Series");
    const seasonFolder = `Season ${String(params.seasonNum || 1).padStart(2, "0")}`;
    const dir = path.join(baseDir, "TV Shows", seriesFolder, seasonFolder);
    const fileName = `${sanitizeFileName(params.title)}.${ext}`;
    return { dir, fileName, fullPath: path.join(dir, fileName) };
  } else {
    const dir = path.join(baseDir, "Live TV");
    const fileName = `${sanitizeFileName(params.title)}.${ext}`;
    return { dir, fileName, fullPath: path.join(dir, fileName) };
  }
}

function getTasksFilePath(): string {
  return path.join(getDownloadDir(), "tasks.json");
}

function loadTasksFromDisk(): void {
  try {
    const tasksFile = getTasksFilePath();
    if (fs.existsSync(tasksFile)) {
      const raw = fs.readFileSync(tasksFile, "utf-8");
      const tasks: ServerDownloadTask[] = JSON.parse(raw);
      tasks.forEach((task) => {
        if (task.filePath && fs.existsSync(task.filePath)) {
          if (task.status === "downloading") {
            task.status = "paused";
            task.errorReason = "Server restarted";
          }
          taskMap.set(task.id, task);
        } else if (task.status === "completed") {
          task.status = "failed";
          task.errorReason = "File missing from disk";
          taskMap.set(task.id, task);
        } else {
          taskMap.set(task.id, task);
        }
      });
    }
  } catch (e) {
    console.error("[ServerDownloader] Failed to load tasks from disk:", e);
  }
}

export function saveTasksToDisk(): void {
  try {
    const tasksFile = getTasksFilePath();
    const tasks = Array.from(taskMap.values());
    fs.writeFileSync(tasksFile, JSON.stringify(tasks, null, 2), "utf-8");
  } catch (e) {
    console.error("[ServerDownloader] Failed to save tasks to disk:", e);
  }
}

// Initial load of persisted tasks on server start
loadTasksFromDisk();

export function checkAria2cAvailable(): boolean {
  if (cachedAria2cAvailable !== null) return cachedAria2cAvailable;
  try {
    execSync("aria2c --version", { stdio: "ignore" });
    cachedAria2cAvailable = true;
  } catch {
    cachedAria2cAvailable = false;
  }
  return cachedAria2cAvailable;
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
  seriesTitle?: string;
  seasonNum?: number;
  episodeNum?: number;
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
    seriesTitle: params.seriesTitle,
    seasonNum: params.seasonNum,
    episodeNum: params.episodeNum,
    containerExtension: ext,
    poster: params.poster,
    status: "queued",
    bytesDownloaded: 0,
    totalBytes: 0,
    progressPercent: 0,
    downloadSpeedBps: 0,
    etaSeconds: 0,
    downloadedAt: Date.now(),
    engineUsed: checkAria2cAvailable() ? "aria2c" : "native_multi_range",
  };

  taskMap.set(id, task);
  saveTasksToDisk();

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
    super({ highWaterMark: 1024 * 1024 });
    this.taskId = taskId;
    this.initialBytes = initialBytes;
    this.receivedBytes = initialBytes;
    this.startTime = Date.now();
  }

  _transform(chunk: any, encoding: string, callback: (err?: Error | null, data?: any) => void) {
    this.receivedBytes += chunk.length;
    const task = taskMap.get(this.taskId);
    const now = Date.now();

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

/**
 * Executes download using aria2c child process with multi-connection parallelism if available,
 * otherwise falls back to native multi-retry Range streaming engine.
 */
async function executeServerDownload(id: string): Promise<void> {
  const task = taskMap.get(id);
  if (!task) return;

  const upstreamUrl = buildUpstreamStreamUrl(task.type, String(task.streamId), task.containerExtension);
  
  const { dir: downloadDir, fileName, fullPath: filePath } = buildStructuredTaskPath({
    type: task.type,
    title: task.title,
    containerExtension: task.containerExtension,
    seriesTitle: task.seriesTitle,
    seasonNum: task.seasonNum,
    episodeNum: task.episodeNum,
  });

  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  task.filePath = filePath;

  if (checkAria2cAvailable()) {
    task.engineUsed = "aria2c";
    return executeAria2cDownload(id, upstreamUrl, downloadDir, fileName);
  }

  task.engineUsed = "native_multi_range";
  return executeNativeRangeDownload(id, upstreamUrl, filePath);
}

function parseAria2cSize(str: string): number {
  if (!str) return 0;
  const upper = str.trim().toUpperCase();
  const num = parseFloat(upper);
  if (isNaN(num)) return 0;
  if (upper.includes("GIB") || upper.includes("GB")) return Math.round(num * 1024 * 1024 * 1024);
  if (upper.includes("MIB") || upper.includes("MB")) return Math.round(num * 1024 * 1024);
  if (upper.includes("KIB") || upper.includes("KB")) return Math.round(num * 1024);
  return Math.round(num);
}

/**
 * aria2c Multi-Connection Downloader Process Executor
 */
function executeAria2cDownload(
  id: string,
  upstreamUrl: string,
  downloadDir: string,
  fileName: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const task = taskMap.get(id);
    if (!task) return resolve();

    task.status = "downloading";

    const args = [
      "-s", "8",                  // 8 connections per server
      "-x", "8",                  // 8 max connections per task
      "-k", "1M",                 // 1MB min split size
      "--continue=true",          // Auto-resume partial downloads
      "--summary-interval=1",     // Output status every 1s
      "--user-agent=VLC/3.0.18 LibVLC/3.0.18",
      "--dir", downloadDir,
      "--out", fileName,
      upstreamUrl,
    ];

    const child = spawn("aria2c", args);
    activeProcesses.set(id, child);

    child.stdout.on("data", (data: Buffer) => {
      const line = data.toString();
      const match = line.match(/([0-9.]+\s*[KMG]?i?B)\/([0-9.]+\s*[KMG]?i?B)\((\d+)%\).*?DL:([0-9.]+\s*[KMG]?i?B)/i);
      if (match && task) {
        task.bytesDownloaded = parseAria2cSize(match[1]);
        task.totalBytes = parseAria2cSize(match[2]);
        task.progressPercent = parseInt(match[3], 10);
        task.downloadSpeedBps = parseAria2cSize(match[4]);

        const etaMatch = line.match(/ETA:(?:(\d+)m)?(?:(\d+)s)?/i);
        if (etaMatch) {
          const mins = parseInt(etaMatch[1] || "0", 10);
          const secs = parseInt(etaMatch[2] || "0", 10);
          task.etaSeconds = mins * 60 + secs;
        }
      }
    });

    child.on("close", (code) => {
      activeProcesses.delete(id);
      if (code === 0) {
        task.status = "completed";
        task.progressPercent = 100;
        task.downloadSpeedBps = 0;
        task.etaSeconds = 0;
        if (task.filePath && fs.existsSync(task.filePath)) {
          task.bytesDownloaded = fs.statSync(task.filePath).size;
          task.totalBytes = task.bytesDownloaded;
        }
      } else if (task.status === "paused") {
        // Paused
      } else {
        task.status = "failed";
        task.errorReason = `aria2c process exited with code ${code}`;
      }
      saveTasksToDisk();
      resolve();
    });

    child.on("error", (err) => {
      activeProcesses.delete(id);
      console.warn(`[ServerDownloader] aria2c process error: ${err.message}. Falling back to native downloader.`);
      executeNativeRangeDownload(id, upstreamUrl, task.filePath!).then(resolve).catch(reject);
    });
  });
}

/**
 * Native Multi-Retry Range Downloader (Used when aria2c is not installed)
 */
async function executeNativeRangeDownload(id: string, upstreamUrl: string, filePath: string): Promise<void> {
  const task = taskMap.get(id);
  if (!task) return;

  const controller = new AbortController();
  abortControllers.set(id, controller);

  task.status = "downloading";

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
        existingBytes = 0;
      }

      const writeFlags = existingBytes > 0 && res.statusCode === 206 ? "a" : "w";
      const fileStream = fs.createWriteStream(filePath, { flags: writeFlags, highWaterMark: 1024 * 1024 });
      const progressStream = new ProgressTransform(id, existingBytes);

      await pipeline(res, progressStream, fileStream);

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
      break;
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
  const child = activeProcesses.get(id);
  if (child) {
    child.kill("SIGINT");
    activeProcesses.delete(id);
  }

  const controller = abortControllers.get(id);
  if (controller) {
    controller.abort();
    abortControllers.delete(id);
  }

  const task = taskMap.get(id);
  if (task) {
    task.status = "paused";
  }
  saveTasksToDisk();
  return true;
}

export function resumeServerDownload(id: string): boolean {
  const task = taskMap.get(id);
  if (task && (task.status === "paused" || task.status === "failed")) {
    task.status = "queued";
    saveTasksToDisk();
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
  const deleted = taskMap.delete(id);
  saveTasksToDisk();
  return deleted;
}
