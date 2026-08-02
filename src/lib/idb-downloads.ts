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
