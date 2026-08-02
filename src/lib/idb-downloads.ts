/**
 * IndexedDB Offline Download & Segment Caching Engine
 */

const DB_NAME = "iptv_offline_storage_v1";
const STORE_NAME = "offline_media_blobs";
const DB_VERSION = 1;

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available in this environment"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = (event: any) => resolve(event.target.result);
    request.onerror = (event: any) => reject(event.target.error);
  });
}

export interface OfflineBlobEntry {
  id: string; // e.g. 'vod_9941'
  streamId: string | number;
  title: string;
  blob: Blob;
  mimeType: string;
  sizeBytes: number;
  downloadedAt: number;
}

export async function saveOfflineMedia(entry: OfflineBlobEntry): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(entry);

    request.onsuccess = () => resolve();
    request.onerror = (e: any) => reject(e.target.error);
  });
}

export async function getOfflineMedia(id: string): Promise<OfflineBlobEntry | null> {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = (e: any) => resolve(e.target.result || null);
      request.onerror = (e: any) => reject(e.target.error);
    });
  } catch {
    return null;
  }
}

export async function deleteOfflineMedia(id: string): Promise<void> {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = (e: any) => reject(e.target.error);
    });
  } catch {}
}

export async function getStorageQuotaEstimate(): Promise<{
  quotaBytes: number;
  usageBytes: number;
  availableBytes: number;
  usedPercent: number;
}> {
  if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const quotaBytes = estimate.quota || 10 * 1024 * 1024 * 1024; // Default 10GB
      const usageBytes = estimate.usage || 0;
      const availableBytes = Math.max(0, quotaBytes - usageBytes);
      const usedPercent = Math.min(100, Math.round((usageBytes / quotaBytes) * 100));

      return { quotaBytes, usageBytes, availableBytes, usedPercent };
    } catch {}
  }

  return {
    quotaBytes: 10 * 1024 * 1024 * 1024,
    usageBytes: 0,
    availableBytes: 10 * 1024 * 1024 * 1024,
    usedPercent: 0,
  };
}

/**
 * Starts a real HTTP fetch background stream worker for an offline download item.
 * Streams response chunks, updates live progress, speed, and saves the final blob into IndexedDB.
 */
export async function startRealDownloadProcess(downloadId: string): Promise<void> {
  const { getDownloadQueueState, saveDownloadQueueState } = await import("@/lib/profile-storage");
  const { getStreamUrl } = await import("@/lib/api-client");

  const queueState = getDownloadQueueState();
  const itemIndex = queueState.items.findIndex((it) => it.id === downloadId);
  if (itemIndex < 0) return;

  const item = queueState.items[itemIndex];
  const streamType = item.section === "series" ? "series" : "movie";
  const targetUrl = getStreamUrl(streamType, item.streamId, item.containerExtension);

  // Update item status to downloading
  item.status = "downloading";
  item.downloadSpeedBps = 0;
  item.progressPercent = 0;
  queueState.activeDownloadId = item.id;
  queueState.isDownloading = true;
  saveDownloadQueueState(queueState);

  const startTime = Date.now();
  let receivedBytes = 0;
  const chunks: BlobPart[] = [];

  try {
    const res = await fetch(targetUrl);
    if (!res.ok || !res.body) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.error || `HTTP stream fetch failed (${res.status} ${res.statusText})`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.error || "Upstream server returned error payload instead of video stream");
    }

    const contentLengthHeader = res.headers.get("content-length");
    const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : item.totalBytes || 100_000_000;
    item.totalBytes = totalBytes;

    const reader = res.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (value) {
        chunks.push(value);
        receivedBytes += value.byteLength;

        const elapsedTime = (Date.now() - startTime) / 1000;
        const currentSpeedBps = elapsedTime > 0 ? Math.round(receivedBytes / elapsedTime) : 0;
        const percent = Math.min(99, Math.round((receivedBytes / totalBytes) * 100));
        const remainingBytes = Math.max(0, totalBytes - receivedBytes);
        const etaSeconds = currentSpeedBps > 0 ? Math.round(remainingBytes / currentSpeedBps) : 0;

        item.bytesDownloaded = receivedBytes;
        item.progressPercent = percent;
        item.downloadSpeedBps = currentSpeedBps;
        item.etaSeconds = etaSeconds;

        const latestState = getDownloadQueueState();
        const idx = latestState.items.findIndex((it) => it.id === downloadId);
        if (idx >= 0) {
          latestState.items[idx] = { ...item };
          latestState.globalSpeedBps = currentSpeedBps;
          saveDownloadQueueState(latestState);
        }
      }
    }

    // Combine chunks into single Blob and persist in IndexedDB
    const blob = new Blob(chunks, { type: `video/${item.containerExtension || "mp4"}` });
    await saveOfflineMedia({
      id: String(item.streamId),
      streamId: item.streamId,
      title: item.title,
      blob,
      mimeType: `video/${item.containerExtension || "mp4"}`,
      sizeBytes: blob.size,
      downloadedAt: Date.now(),
    });

    // Mark as completed
    const finalState = getDownloadQueueState();
    const finalIdx = finalState.items.findIndex((it) => it.id === downloadId);
    if (finalIdx >= 0) {
      finalState.items[finalIdx].status = "completed";
      finalState.items[finalIdx].bytesDownloaded = blob.size;
      finalState.items[finalIdx].totalBytes = blob.size;
      finalState.items[finalIdx].progressPercent = 100;
      finalState.items[finalIdx].downloadSpeedBps = 0;
      finalState.items[finalIdx].etaSeconds = 0;
      finalState.activeDownloadId = null;
      finalState.isDownloading = false;
      finalState.globalSpeedBps = 0;
      saveDownloadQueueState(finalState);
    }
  } catch (err: any) {
    console.error("Real download failed:", err);
    const errState = getDownloadQueueState();
    const errIdx = errState.items.findIndex((it) => it.id === downloadId);
    if (errIdx >= 0) {
      errState.items[errIdx].status = "failed";
      errState.items[errIdx].errorReason = err.message || "Network error during download";
      errState.activeDownloadId = null;
      errState.isDownloading = false;
      errState.globalSpeedBps = 0;
      saveDownloadQueueState(errState);
    }
  }
}
