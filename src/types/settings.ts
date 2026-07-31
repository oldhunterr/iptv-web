export type ThemePresetId = "dark-glass" | "oled-black" | "neon-cyber" | "classic-tivimate";

export interface CustomAccentColor {
  name: string;
  primary: string;
  hover: string;
  light: string;
  glow: string;
}

export const ACCENT_SWATCHES: Record<string, CustomAccentColor> = {
  cyan: {
    name: "Cyan",
    primary: "#06b6d4",
    hover: "#0891b2",
    light: "#22d3ee",
    glow: "rgba(6, 182, 212, 0.35)",
  },
  amber: {
    name: "Amber Gold",
    primary: "#f59e0b",
    hover: "#d97706",
    light: "#fbbf24",
    glow: "rgba(245, 158, 11, 0.35)",
  },
  emerald: {
    name: "Emerald Green",
    primary: "#10b981",
    hover: "#059669",
    light: "#34d399",
    glow: "rgba(16, 185, 129, 0.35)",
  },
  purple: {
    name: "Royal Purple",
    primary: "#8b5cf6",
    hover: "#7c3aed",
    light: "#a78bfa",
    glow: "rgba(139, 92, 246, 0.35)",
  },
  pink: {
    name: "Electric Pink",
    primary: "#ec4899",
    hover: "#db2777",
    light: "#f472b6",
    glow: "rgba(236, 72, 153, 0.35)",
  },
  crimson: {
    name: "Crimson Red",
    primary: "#ef4444",
    hover: "#dc2626",
    light: "#f87171",
    glow: "rgba(239, 68, 68, 0.35)",
  },
};

export interface ThemeSettings {
  themeId: ThemePresetId;
  accentColor: string; // Swatch key (e.g. 'cyan') or hex color code
  glassmorphismEnabled: boolean;
  glassBlurIntensity: "none" | "sm" | "md" | "lg";
  customCSS?: string;
}

export type MPAARating = "G" | "PG" | "PG-13" | "R" | "NC-17" | "UNRATED";
export type TVRating = "TV-Y" | "TV-Y7" | "TV-G" | "TV-PG" | "TV-14" | "TV-MA";
export type ContentRating = MPAARating | TVRating;

export const RATING_WEIGHTS: Record<string, number> = {
  "G": 10,
  "TV-Y": 10,
  "TV-Y7": 15,
  "TV-G": 20,
  "PG": 30,
  "TV-PG": 35,
  "PG-13": 50,
  "TV-14": 60,
  "UNRATED": 70,
  "R": 80,
  "NC-17": 90,
  "TV-MA": 100,
};

export interface ParentalControlSettings {
  enabled: boolean;
  maxRatingLimit: ContentRating;
  blockUnrated: boolean;
  pinHash?: string;
  hideRestrictedContent: boolean;
  lockAdultCategories?: boolean;
  adultCategoryPattern?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  avatar: string; // e.g. 'user' | 'baby' | 'sparkles' | 'film' | 'tv' | 'shield'
  isMaster: boolean;
  isKids: boolean;
  pin?: string;
  pinHash?: string;
  parentalControls: ParentalControlSettings;
  themeSettings: ThemeSettings;
  createdAt: number;
  updatedAt: number;
}

export type DownloadStatus =
  | "queued"
  | "downloading"
  | "paused"
  | "completed"
  | "failed"
  | "expired";

export type DownloadQuality = "1080p" | "720p" | "480p" | "original";

export interface IDBDownloadItem {
  id: string;
  streamId: string | number;
  section: "vod" | "series" | "movies";
  title: string;
  poster?: string;
  backdrop?: string;
  category_id?: string;
  containerExtension: string;
  status: DownloadStatus;
  bytesDownloaded: number;
  totalBytes: number;
  progressPercent: number;
  downloadSpeedBps: number;
  etaSeconds: number;
  totalSegments?: number;
  downloadedSegments?: number;
  downloadedAt: number;
  expiresAt: number;
  xtreamCredentialsHash: string;
  drmKeyId?: string;
  errorReason?: string;
  retryCount: number;
}

export interface StorageQuotaInfo {
  quotaBytes: number;
  usageBytes: number;
  availableBytes: number;
  usedPercent: number;
  isPersisted: boolean;
}

export interface DownloadQueueState {
  items: IDBDownloadItem[];
  activeDownloadId: string | null;
  isDownloading: boolean;
  globalSpeedBps: number;
  autoDeleteWatched: boolean;
  ttlDays: number;
  qualityPreference: DownloadQuality;
}

export type WatchedFilterStatus = "all" | "unwatched" | "in-progress" | "watched";

export type SortField =
  | "default"
  | "name_asc"
  | "name_desc"
  | "rating_desc"
  | "year_desc"
  | "added_desc"
  | "progress_desc";

export interface ContentFilterOptions {
  searchQuery: string;
  selectedCategory?: string;
  selectedGenres: string[];
  yearRange: [number, number];
  minRating: number;
  watchedStatus: WatchedFilterStatus;
  streamType?: "all" | "live" | "movies" | "series";
  resolution?: "all" | "4K" | "1080p" | "720p";
  hasEpg?: boolean;
  onlyDownloaded: boolean;
  sortBy: SortField;
}

export interface GeneralSettings {
  autoPlayNextEpisode: boolean;
  bufferSizeSeconds: number;
  hardwareAcceleration: boolean;
  defaultStreamFormat: "hls" | "ts" | "mp4";
  showUnratedBadge: boolean;
}

export function isRatingAllowed(
  itemRating: string | number | undefined,
  maxAllowedRating: ContentRating,
  blockUnrated = false
): boolean {
  if (!itemRating) {
    return !blockUnrated;
  }
  const norm = String(itemRating).toUpperCase().trim();
  if (norm === "UNRATED" && blockUnrated) return false;
  const itemWeight = RATING_WEIGHTS[norm] ?? RATING_WEIGHTS["UNRATED"];
  const maxWeight = RATING_WEIGHTS[maxAllowedRating.toUpperCase()] ?? RATING_WEIGHTS["NC-17"];
  return itemWeight <= maxWeight;
}
