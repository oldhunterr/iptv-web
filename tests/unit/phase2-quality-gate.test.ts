import { describe, it, expect, beforeEach, vi } from "vitest";
import { isRatingAllowed, ContentRating } from "../../src/types/settings";
import {
  initializeProfileStorage,
  getProfiles,
  getActiveProfileId,
  getActiveProfile,
  setActiveProfileId,
  saveProfile,
  deleteProfile,
  hashPin,
  checkPinRateLimit,
  recordFailedPinAttempt,
  resetPinAttempts,
  verifyProfilePin,
  getGeneralSettings,
  saveGeneralSettings,
  getDownloadQueueState,
  saveDownloadQueueState,
  getDefaultFilterOptions,
  saveDefaultFilterOptions,
  DEFAULT_MASTER_PROFILE,
  DEFAULT_KIDS_PROFILE,
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_DOWNLOAD_QUEUE,
  DEFAULT_FILTER_OPTIONS,
} from "../../src/lib/profile-storage";
import {
  getFavorites,
  isFavorite,
  toggleFavorite,
  getWatchHistory,
  getWatchProgress,
  saveWatchProgress,
} from "../../src/lib/storage";

// Mock localStorage in memory
const createMockLocalStorage = (shouldThrow = false) => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => {
      if (shouldThrow) throw new Error("localStorage access denied");
      return store[key] || null;
    },
    setItem: (key: string, value: string) => {
      if (shouldThrow) throw new Error("QuotaExceededError");
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      if (shouldThrow) throw new Error("localStorage access denied");
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    getStore: () => store,
    setRawItem: (key: string, val: string) => {
      store[key] = val;
    },
  };
};

let currentMockStorage = createMockLocalStorage();

Object.defineProperty(global, "localStorage", {
  get: () => currentMockStorage,
  configurable: true,
});

describe("Phase 2 Quality Gate - State Management & Profile Storage Stress Tests", () => {
  beforeEach(() => {
    currentMockStorage = createMockLocalStorage();
    resetPinAttempts();
  });

  describe("1. isRatingAllowed Helper Edge Cases", () => {
    it("should handle missing / falsy ratings correctly", () => {
      expect(isRatingAllowed(undefined, "PG", false)).toBe(true);
      expect(isRatingAllowed(undefined, "PG", true)).toBe(false);
      expect(isRatingAllowed(null as any, "PG", false)).toBe(true);
      expect(isRatingAllowed(null as any, "PG", true)).toBe(false);
      expect(isRatingAllowed("", "PG", false)).toBe(true);
      expect(isRatingAllowed("", "PG", true)).toBe(false);
    });

    it("should handle numeric rating 0 edge case", () => {
      // 0 is falsy in JS, so !itemRating is true -> returns !blockUnrated
      expect(isRatingAllowed(0, "PG", false)).toBe(true);
      expect(isRatingAllowed(0, "PG", true)).toBe(false);

      // String "0" is truthy, falls back to UNRATED weight (70)
      expect(isRatingAllowed("0", "PG", false)).toBe(false); // 70 <= 30 is false
      expect(isRatingAllowed("0", "NC-17", false)).toBe(true); // 70 <= 90 is true
    });

    it("should handle UNRATED content against kids and adult profiles", () => {
      // UNRATED with blockUnrated = true
      expect(isRatingAllowed("UNRATED", "NC-17", true)).toBe(false);
      expect(isRatingAllowed("unrated", "NC-17", true)).toBe(false);
      expect(isRatingAllowed(" Unrated ", "NC-17", true)).toBe(false);

      // UNRATED with blockUnrated = false against Kids profile (PG = weight 30)
      // UNRATED weight is 70, PG weight is 30 -> 70 <= 30 is false!
      expect(isRatingAllowed("UNRATED", "PG", false)).toBe(false);

      // UNRATED with blockUnrated = false against Master profile (NC-17 = weight 90)
      expect(isRatingAllowed("UNRATED", "NC-17", false)).toBe(true);
    });

    it("should restrict TV-MA content on Kids profile (PG limit)", () => {
      expect(isRatingAllowed("TV-MA", "PG", false)).toBe(false);
      expect(isRatingAllowed("R", "PG", false)).toBe(false);
      expect(isRatingAllowed("NC-17", "PG", false)).toBe(false);
      expect(isRatingAllowed("TV-14", "PG", false)).toBe(false);
    });

    it("should allow PG / TV-PG / G content on Kids profile (PG limit)", () => {
      expect(isRatingAllowed("G", "PG", false)).toBe(true);
      expect(isRatingAllowed("TV-Y", "PG", false)).toBe(true);
      expect(isRatingAllowed("TV-Y7", "PG", false)).toBe(true);
      expect(isRatingAllowed("TV-G", "PG", false)).toBe(true);
      expect(isRatingAllowed("PG", "PG", false)).toBe(true);
    });

    it("should handle case sensitivity and whitespace formatting", () => {
      expect(isRatingAllowed(" tv-ma ", "PG", false)).toBe(false);
      expect(isRatingAllowed(" pg-13 ", "PG", false)).toBe(false);
      expect(isRatingAllowed(" g ", "PG", false)).toBe(true);
    });

    it("should handle unknown rating strings (e.g. NR, NOT RATED, TV-18)", () => {
      // Unknown ratings get default UNRATED weight (70)
      expect(isRatingAllowed("NOT RATED", "PG", false)).toBe(false); // 70 <= 30 is false
      expect(isRatingAllowed("NOT RATED", "NC-17", false)).toBe(true); // 70 <= 90 is true
      // Note: norm === "UNRATED" check is false for "NOT RATED", so if blockUnrated=true & maxAllowed=NC-17, weight 70 <= 90 returns true
      expect(isRatingAllowed("NOT RATED", "NC-17", true)).toBe(true);
    });
  });

  describe("2. Profile Storage & PIN Verification & Rate Limiting Lockout", () => {
    it("should initialize default profiles when storage is empty", () => {
      const { profiles, activeId } = initializeProfileStorage();
      expect(profiles).toHaveLength(2);
      expect(profiles[0].id).toBe(DEFAULT_MASTER_PROFILE.id);
      expect(profiles[1].id).toBe(DEFAULT_KIDS_PROFILE.id);
      expect(activeId).toBe(DEFAULT_MASTER_PROFILE.id);
    });

    it("should verify plaintext PIN and hashed PIN correctly", async () => {
      const plainPinProfile = { ...DEFAULT_MASTER_PROFILE, pin: "1234" };
      const hashedPinProfile = {
        ...DEFAULT_MASTER_PROFILE,
        pinHash: await hashPin("5678"),
      };

      // Correct PIN tests
      expect(await verifyProfilePin(plainPinProfile, "1234")).toBe(true);
      expect(await verifyProfilePin(hashedPinProfile, "5678")).toBe(true);

      // Wrong PIN tests
      expect(await verifyProfilePin(plainPinProfile, "0000")).toBe(false);
    });

    it("should execute rate limiting lockout state machine after 3 failed attempts", async () => {
      const pinProfile = { ...DEFAULT_MASTER_PROFILE, pin: "4321" };

      // Attempt 1: Fail
      const res1 = await verifyProfilePin(pinProfile, "0000");
      expect(res1).toBe(false);
      let limitStatus = checkPinRateLimit();
      expect(limitStatus.isLocked).toBe(false);

      // Attempt 2: Fail
      const res2 = await verifyProfilePin(pinProfile, "0000");
      expect(res2).toBe(false);
      limitStatus = checkPinRateLimit();
      expect(limitStatus.isLocked).toBe(false);

      // Attempt 3: Fail -> triggers lockout
      const res3 = await verifyProfilePin(pinProfile, "0000");
      expect(res3).toBe(false);
      limitStatus = checkPinRateLimit();
      expect(limitStatus.isLocked).toBe(true);
      expect(limitStatus.remainingSeconds).toBeGreaterThan(0);
      expect(limitStatus.remainingSeconds).toBeLessThanOrEqual(30);

      // Subsequent attempt even with CORRECT pin while locked MUST return false
      const resLocked = await verifyProfilePin(pinProfile, "4321");
      expect(resLocked).toBe(false);

      // Reset pin attempts clears lockout
      resetPinAttempts();
      limitStatus = checkPinRateLimit();
      expect(limitStatus.isLocked).toBe(false);

      // Now correct PIN succeeds
      const resUnlocked = await verifyProfilePin(pinProfile, "4321");
      expect(resUnlocked).toBe(true);
    });

    it("should handle profile CRUD operations safely", () => {
      const newProfile = {
        ...DEFAULT_KIDS_PROFILE,
        id: "prof_custom",
        name: "Teen Profile",
      };

      saveProfile(newProfile);
      let profiles = getProfiles();
      expect(profiles.some((p) => p.id === "prof_custom")).toBe(true);

      setActiveProfileId("prof_custom");
      expect(getActiveProfileId()).toBe("prof_custom");
      expect(getActiveProfile().name).toBe("Teen Profile");

      // Attempt to delete master profile (should be disallowed)
      const deletedMaster = deleteProfile(DEFAULT_MASTER_PROFILE.id);
      expect(deletedMaster).toBe(false);
      expect(getProfiles().some((p) => p.id === DEFAULT_MASTER_PROFILE.id)).toBe(true);

      // Delete custom profile while active -> active profile switches back to first profile
      const deletedCustom = deleteProfile("prof_custom");
      expect(deletedCustom).toBe(true);
      expect(getActiveProfileId()).toBe(DEFAULT_MASTER_PROFILE.id);
    });
  });

  describe("3. Storage Fallback Behavior (Corrupted / Empty / Throwing localStorage)", () => {
    it("should fallback gracefully when localStorage contains corrupted JSON", () => {
      // Inject corrupted JSON strings into storage keys
      currentMockStorage.setRawItem("iptv_profiles_v2", "{ invalid json {{{");
      currentMockStorage.setRawItem("iptv_general_settings_v2", "[Corrupt");
      currentMockStorage.setRawItem("iptv_downloads_queue_v2", "BAD_DATA");
      currentMockStorage.setRawItem("iptv_filters_default_v2", "NOT_JSON");
      currentMockStorage.setRawItem("iptv_favorites_v1", "{corrupted");
      currentMockStorage.setRawItem("iptv_watch_history_v1", "###");

      // Verify profile storage falls back to defaults
      const profiles = getProfiles();
      expect(profiles).toHaveLength(2);
      expect(profiles[0].id).toBe(DEFAULT_MASTER_PROFILE.id);

      // Verify settings & queue fall back to defaults
      expect(getGeneralSettings()).toEqual(DEFAULT_GENERAL_SETTINGS);
      expect(getDownloadQueueState()).toEqual(DEFAULT_DOWNLOAD_QUEUE);
      expect(getDefaultFilterOptions()).toEqual(DEFAULT_FILTER_OPTIONS);

      // Verify favorites and watch history fall back to empty arrays
      expect(getFavorites()).toEqual([]);
      expect(getWatchHistory()).toEqual([]);
    });

    it("should fallback to memoryStore when localStorage throws exceptions (Quota / Access Denied)", () => {
      // Switch mock storage to throw on every call
      currentMockStorage = createMockLocalStorage(true);

      // Operating on profile storage should not throw
      expect(() => {
        const profiles = getProfiles();
        expect(profiles.length).toBeGreaterThan(0);
      }).not.toThrow();

      expect(() => {
        saveGeneralSettings({ ...DEFAULT_GENERAL_SETTINGS, bufferSizeSeconds: 30 });
      }).not.toThrow();

      expect(getGeneralSettings().bufferSizeSeconds).toBe(30);

      // Favorites and history should return empty arrays gracefully without crashing
      expect(() => {
        expect(getFavorites()).toEqual([]);
        expect(getWatchHistory()).toEqual([]);
      }).not.toThrow();
    });
  });
});
