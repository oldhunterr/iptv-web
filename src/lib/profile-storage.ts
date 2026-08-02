import {
  UserProfile,
  ThemeSettings,
  ContentFilterOptions,
  GeneralSettings,
  DownloadQueueState,
  ContentRating,
} from "@/types/settings";

const PROFILES_KEY = "iptv_profiles_v2";
const ACTIVE_PROFILE_ID_KEY = "iptv_active_profile_id_v2";
const GENERAL_SETTINGS_KEY = "iptv_general_settings_v2";
const DOWNLOADS_QUEUE_KEY = "iptv_downloads_queue_v2";
const FILTERS_DEFAULT_KEY = "iptv_filters_default_v2";
const MIGRATION_DONE_KEY = "iptv_migration_v2_done";

// PIN Rate Limiting State
let failedPinAttempts = 0;
let lockoutUntilTimestamp = 0;

export const DEFAULT_MASTER_PROFILE: UserProfile = {
  id: "prof_admin",
  name: "Master Profile",
  avatar: "user",
  isMaster: true,
  isKids: false,
  parentalControls: {
    enabled: false,
    maxRatingLimit: "NC-17",
    blockUnrated: false,
    hideRestrictedContent: false,
  },
  themeSettings: {
    themeId: "dark-glass",
    accentColor: "cyan",
    glassmorphismEnabled: true,
    glassBlurIntensity: "md",
  },
  language: "en-US",
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export const DEFAULT_KIDS_PROFILE: UserProfile = {
  id: "prof_kids",
  name: "Kids Zone",
  avatar: "baby",
  isMaster: false,
  isKids: true,
  parentalControls: {
    enabled: true,
    maxRatingLimit: "PG",
    blockUnrated: true,
    hideRestrictedContent: true,
  },
  themeSettings: {
    themeId: "neon-cyber",
    accentColor: "pink",
    glassmorphismEnabled: true,
    glassBlurIntensity: "md",
  },
  language: "en-US",
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  autoPlayNextEpisode: true,
  bufferSizeSeconds: 15,
  hardwareAcceleration: true,
  defaultStreamFormat: "hls",
  showUnratedBadge: true,
  language: "en-US",
};

export const DEFAULT_FILTER_OPTIONS: ContentFilterOptions = {
  searchQuery: "",
  selectedCategory: "ALL",
  selectedGenres: [],
  yearRange: [1980, 2026],
  minRating: 0,
  watchedStatus: "all",
  streamType: "all",
  resolution: "all",
  audioLanguage: "all",
  hasEpg: false,
  onlyDownloaded: false,
  sortBy: "default",
};

export const DEFAULT_DOWNLOAD_QUEUE: DownloadQueueState = {
  items: [],
  activeDownloadId: null,
  isDownloading: false,
  globalSpeedBps: 0,
  autoDeleteWatched: false,
  ttlDays: 30,
  qualityPreference: "1080p",
};

type StorageListener = () => void;
const listeners: Set<StorageListener> = new Set();

export function subscribeProfileStorage(listener: StorageListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyProfileListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error("Error in profile storage listener:", e);
    }
  });
}

// Memory fallback if window is undefined (SSR)
let memoryStore: Record<string, string> = {};

function getItem(key: string): string | null {
  if (typeof window === "undefined") return memoryStore[key] || null;
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return memoryStore[key] || null;
  }
}

function setItem(key: string, value: string): void {
  if (typeof window === "undefined") {
    memoryStore[key] = value;
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    memoryStore[key] = value;
  }
}

// Initializer & Auto creation
export function initializeProfileStorage(): { profiles: UserProfile[]; activeId: string } {
  let rawProfiles = getItem(PROFILES_KEY);
  let profiles: UserProfile[] = [];

  if (rawProfiles) {
    try {
      profiles = JSON.parse(rawProfiles);
    } catch (e) {
      profiles = [];
    }
  }

  if (!profiles || profiles.length === 0) {
    profiles = [DEFAULT_MASTER_PROFILE, DEFAULT_KIDS_PROFILE];
    setItem(PROFILES_KEY, JSON.stringify(profiles));
  }

  let activeId = getItem(ACTIVE_PROFILE_ID_KEY);
  if (!activeId || !profiles.some((p) => p.id === activeId)) {
    activeId = profiles[0].id;
    setItem(ACTIVE_PROFILE_ID_KEY, activeId);
  }

  // Check legacy migration
  migrateLegacyStorageIfNeeded(activeId);

  return { profiles, activeId };
}

function migrateLegacyStorageIfNeeded(targetProfileId: string) {
  if (getItem(MIGRATION_DONE_KEY)) return;
  try {
    const legacyFavs = getItem("iptv_favorites_v1");
    if (legacyFavs) {
      const destKey = `iptv_profile_${targetProfileId}_favorites`;
      if (!getItem(destKey)) {
        setItem(destKey, legacyFavs);
      }
    }
    const legacyHist = getItem("iptv_watch_history_v1");
    if (legacyHist) {
      const destKey = `iptv_profile_${targetProfileId}_watch_history`;
      if (!getItem(destKey)) {
        setItem(destKey, legacyHist);
      }
    }
    setItem(MIGRATION_DONE_KEY, "true");
  } catch (e) {
    console.error("Migration error:", e);
  }
}

export function getProfiles(): UserProfile[] {
  const { profiles } = initializeProfileStorage();
  return profiles;
}

export function getActiveProfileId(): string {
  const { activeId } = initializeProfileStorage();
  return activeId;
}

export function getActiveProfile(): UserProfile {
  const profiles = getProfiles();
  const activeId = getActiveProfileId();
  return profiles.find((p) => p.id === activeId) || profiles[0] || DEFAULT_MASTER_PROFILE;
}

export function setActiveProfileId(profileId: string): void {
  const profiles = getProfiles();
  if (profiles.some((p) => p.id === profileId)) {
    setItem(ACTIVE_PROFILE_ID_KEY, profileId);
    notifyProfileListeners();
  }
}

export function saveProfile(profile: UserProfile): void {
  const profiles = getProfiles();
  const index = profiles.findIndex((p) => p.id === profile.id);
  const updated = { ...profile, updatedAt: Date.now() };

  if (index >= 0) {
    profiles[index] = updated;
  } else {
    profiles.push(updated);
  }

  setItem(PROFILES_KEY, JSON.stringify(profiles));
  notifyProfileListeners();
}

export function deleteProfile(profileId: string): boolean {
  let profiles = getProfiles();
  const target = profiles.find((p) => p.id === profileId);
  if (!target || target.isMaster) {
    return false; // Cannot delete master profile
  }

  profiles = profiles.filter((p) => p.id !== profileId);
  setItem(PROFILES_KEY, JSON.stringify(profiles));

  if (getActiveProfileId() === profileId) {
    setActiveProfileId(profiles[0].id);
  } else {
    notifyProfileListeners();
  }

  return true;
}

// PIN Security & Rate Limiting
export async function hashPin(pin: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const msgBuffer = new TextEncoder().encode(`salt_iptv_${pin}`);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Simple fallback hash if crypto API is absent
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    hash = (hash << 5) - hash + pin.charCodeAt(i);
    hash |= 0;
  }
  return `hash_${hash}`;
}

export function checkPinRateLimit(): { isLocked: boolean; remainingSeconds: number } {
  const now = Date.now();
  if (now < lockoutUntilTimestamp) {
    const remainingSeconds = Math.ceil((lockoutUntilTimestamp - now) / 1000);
    return { isLocked: true, remainingSeconds };
  }
  return { isLocked: false, remainingSeconds: 0 };
}

export function recordFailedPinAttempt(): { isLocked: boolean; remainingSeconds: number } {
  failedPinAttempts += 1;
  if (failedPinAttempts >= 3) {
    lockoutUntilTimestamp = Date.now() + 30000; // 30s lockout
    return { isLocked: true, remainingSeconds: 30 };
  }
  return { isLocked: false, remainingSeconds: 0 };
}

export function resetPinAttempts(): void {
  failedPinAttempts = 0;
  lockoutUntilTimestamp = 0;
}

export async function verifyProfilePin(profile: UserProfile, pinInput: string): Promise<boolean> {
  const status = checkPinRateLimit();
  if (status.isLocked) return false;

  if (profile.pin) {
    if (profile.pin === pinInput) {
      resetPinAttempts();
      return true;
    }
  }

  if (profile.pinHash) {
    const hashed = await hashPin(pinInput);
    if (hashed === profile.pinHash) {
      resetPinAttempts();
      return true;
    }
  }

  recordFailedPinAttempt();
  return false;
}

// General & Feature Settings Accessors
export function getGeneralSettings(): GeneralSettings {
  const raw = getItem(GENERAL_SETTINGS_KEY);
  if (!raw) return DEFAULT_GENERAL_SETTINGS;
  try {
    return { ...DEFAULT_GENERAL_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    return DEFAULT_GENERAL_SETTINGS;
  }
}

export function saveGeneralSettings(settings: GeneralSettings): void {
  setItem(GENERAL_SETTINGS_KEY, JSON.stringify(settings));
  notifyProfileListeners();
}

export function getDownloadQueueState(): DownloadQueueState {
  const raw = getItem(DOWNLOADS_QUEUE_KEY);
  if (!raw) return DEFAULT_DOWNLOAD_QUEUE;
  try {
    return { ...DEFAULT_DOWNLOAD_QUEUE, ...JSON.parse(raw) };
  } catch (e) {
    return DEFAULT_DOWNLOAD_QUEUE;
  }
}

export function saveDownloadQueueState(state: DownloadQueueState): void {
  setItem(DOWNLOADS_QUEUE_KEY, JSON.stringify(state));
  notifyProfileListeners();
}

export function getDefaultFilterOptions(): ContentFilterOptions {
  const raw = getItem(FILTERS_DEFAULT_KEY);
  if (!raw) return DEFAULT_FILTER_OPTIONS;
  try {
    return { ...DEFAULT_FILTER_OPTIONS, ...JSON.parse(raw) };
  } catch (e) {
    return DEFAULT_FILTER_OPTIONS;
  }
}

export function saveDefaultFilterOptions(options: ContentFilterOptions): void {
  setItem(FILTERS_DEFAULT_KEY, JSON.stringify(options));
  notifyProfileListeners();
}

/**
 * Resolves active metadata language.
 * Checks general settings first (global preference), then active profile language, defaulting to "en-US".
 */
export function getUserLanguage(): string {
  const general = getGeneralSettings();
  const profile = getActiveProfile();
  return general.language || profile.language || "en-US";
}
