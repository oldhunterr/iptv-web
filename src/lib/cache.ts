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

  constructor(maxSize: number = 5000, defaultTtlMs: number = 300_000) {
    this.maxSize = maxSize;
    this.defaultTtlMs = defaultTtlMs;
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

    this.store.set(key, {
      value,
      expiresAt,
      createdAt: now,
      ttlMs: effectiveTtl,
    });
  }

  /**
   * Get value by key. Returns undefined if expired or missing.
   */
  public get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (entry.expiresAt > 0 && Date.now() >= entry.expiresAt) {
      this.store.delete(key);
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
    season?: string | number
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

    if (season !== undefined) {
      params.season = season;
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
