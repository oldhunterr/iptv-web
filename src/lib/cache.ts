function getServerModule(moduleName: string): any {
  if (typeof window !== "undefined") return null;
  try {
    const req = eval("require");
    return req(moduleName);
  } catch {
    return null;
  }
}

export interface CacheEntry<T = any> {
  value: T;
  expiresAt: number;
  createdAt: number;
  ttlMs: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
  keys: string[];
}

export class CacheEngine {
  private store = new Map<string, CacheEntry>();
  private maxSize: number;
  private defaultTtlMs: number;
  private hits = 0;
  private misses = 0;
  private cacheDir: string | null = null;

  constructor(maxSize: number = 5000, defaultTtlMs: number = 300_000) {
    this.maxSize = maxSize;
    this.defaultTtlMs = defaultTtlMs;
    const path = getServerModule("path");
    const fs = getServerModule("fs");
    if (path && fs) {
      try {
        this.cacheDir = path.join(process.cwd(), ".cache", "iptv_server");
        if (!fs.existsSync(this.cacheDir)) {
          fs.mkdirSync(this.cacheDir, { recursive: true });
        }
      } catch (e) {
        console.error("Failed to create cache directory", e);
      }
    }
  }

  private getFilePath(key: string): string | null {
    if (!this.cacheDir) return null;
    const path = getServerModule("path");
    if (!path) return null;
    try {
      const safeKey = key.replace(/[^a-z0-9_-]/gi, "_");
      return path.join(this.cacheDir, `${safeKey}.json`);
    } catch {
      return null;
    }
  }

  /**
   * Set a key-value pair in cache with an optional TTL in milliseconds.
   */
  public set<T>(key: string, value: T, ttlMs?: number): void {
    const effectiveTtl = ttlMs !== undefined ? ttlMs : this.defaultTtlMs;
    const now = Date.now();
    const expiresAt = effectiveTtl <= 0 ? 0 : now + effectiveTtl;

    // If max size reached and key is new, evict expired or oldest items
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      this.evictOne();
    }

    const entry = {
      value,
      expiresAt,
      createdAt: now,
      ttlMs: effectiveTtl,
    };

    this.store.set(key, entry);

    // Persist to disk
    const filePath = this.getFilePath(key);
    const fs = getServerModule("fs");
    if (filePath && fs) {
      try {
        fs.writeFileSync(filePath, JSON.stringify(entry));
      } catch (e) {
        console.error("Failed to write cache to disk", e);
      }
    }
  }

  /**
   * Get value by key. Returns undefined if expired or missing.
   */
  public get<T>(key: string): T | undefined {
    let entry = this.store.get(key);

    if (!entry) {
      // Try to recover from disk
      const filePath = this.getFilePath(key);
      const fs = getServerModule("fs");
      if (filePath && fs) {
        try {
          if (fs.existsSync(filePath)) {
            const fileData = fs.readFileSync(filePath, "utf8");
            const parsed = JSON.parse(fileData) as CacheEntry;
            if (parsed && parsed.expiresAt) {
              entry = parsed;
              this.store.set(key, entry); // Load back into memory
            }
          }
        } catch (e) {
          // Disk miss or parse error
        }
      }
    }

    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (entry.expiresAt > 0 && Date.now() >= entry.expiresAt) {
      this.delete(key);
      this.misses++;
      return undefined;
    }

    this.hits++;
    return entry.value as T;
  }

  /**
   * Check if non-expired key exists in cache.
   */
  public has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;

    if (entry.expiresAt > 0 && Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete specific key from cache.
   */
  public delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Clear all items in cache and reset statistics.
   */
  public clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;

    if (this.cacheDir) {
      const fs = getServerModule("fs");
      const path = getServerModule("path");
      if (fs && path && fs.existsSync(this.cacheDir)) {
        try {
          const files = fs.readdirSync(this.cacheDir);
          for (const f of files) {
            if (process.env.NODE_ENV === "test" || f.startsWith("tmdb_") || f.startsWith("player_api_") || f.startsWith("intro_")) {
              fs.unlinkSync(path.join(this.cacheDir, f));
            }
          }
        } catch {}
      }
    }
  }

  /**
   * Purge all expired items from cache. Returns count of purged items.
   */
  public purgeExpired(): number {
    const now = Date.now();
    let purgedCount = 0;

    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt > 0 && now >= entry.expiresAt) {
        this.store.delete(key);
        purgedCount++;
      }
    }

    return purgedCount;
  }

  /**
   * Retrieve cache statistics.
   */
  public getStats(): CacheStats {
    // Purge expired before building stats to keep keys list accurate
    this.purgeExpired();
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.store.size,
      maxSize: this.maxSize,
      keys: Array.from(this.store.keys()),
    };
  }

  /**
   * Evict one item when cache exceeds capacity.
   * Evicts expired item first; if none expired, evicts oldest created item.
   */
  private evictOne(): void {
    const purged = this.purgeExpired();
    if (purged > 0) return;

    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.store.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey);
    }
  }

  /**
   * Helper to format deterministic cache keys given a namespace and parameters object/string.
   */
  public buildCacheKey(namespace: string, params: Record<string, any> | string = {}): string {
    if (typeof params === "string") {
      return `${namespace}:${params.toLowerCase().trim()}`;
    }

    const sortedEntries = Object.entries(params)
      .filter(([_, v]) => v !== undefined && v !== null && v !== "")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k.toLowerCase()}=${String(v).toLowerCase().trim()}`);

    return `${namespace}:${sortedEntries.join("&")}`;
  }

  /**
   * Specific key builder for Xtream player API actions.
   */
  public formatPlayerApiKey(action: string, extraParams: Record<string, any> = {}): string {
    return this.buildCacheKey("player_api", { action, ...extraParams });
  }

  /**
   * Specific key builder for TMDB requests.
   */
  public formatTmdbKey(
    type: string,
    queryOrId?: string | number,
    season?: string | number,
    language?: string,
    year?: string | number
  ): string {
    const isNumeric =
      typeof queryOrId === "number" ||
      (typeof queryOrId === "string" && /^\d+$/.test(queryOrId));

    const params: Record<string, any> = { type };

    if (queryOrId !== undefined && queryOrId !== null && queryOrId !== "") {
      if (isNumeric) {
        params.id = queryOrId;
      } else {
        params.query = queryOrId;
      }
    }

    if (season !== undefined && season !== null && season !== "") {
      params.season = season;
    }

    if (year !== undefined && year !== null && year !== "") {
      params.year = year;
    }

    if (language !== undefined && language !== null && language !== "") {
      params.language = language;
    }

    return this.buildCacheKey("tmdb", params);
  }

  /**
   * Specific key builder for TheIntroDB lookups.
   */
  public formatIntroKey(
    tvdbId: string | number,
    season: string | number,
    episode: string | number
  ): string {
    return this.buildCacheKey("intro", {
      tvdb_id: tvdbId,
      season,
      episode,
    });
  }

  /**
   * Specific key builder for Plex theme music lookups.
   */
  public formatThemeKey(tvdbId: string | number): string {
    return this.buildCacheKey("theme", { tvdb_id: tvdbId });
  }
}

// Global server-side cache instance
export const serverCache = new CacheEngine(5000, 300_000);
