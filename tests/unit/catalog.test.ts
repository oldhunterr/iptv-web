import { describe, it, expect } from "vitest";
import {
  CatalogItem,
  Category,
  EpgProgram,
  LiveChannel,
  Series,
  SortOption,
  VodMovie,
  normalizeCatalogItem,
} from "../../src/types/iptv";

// Utility logic functions for catalog filtering, sorting, resolution, and EPG
function filterAndSortItems(
  items: CatalogItem[],
  categoryId: string,
  searchQuery: string,
  sortOption: SortOption
): CatalogItem[] {
  let result = items;

  if (categoryId && categoryId !== "all") {
    result = result.filter((item) => String(item.category_id) === String(categoryId));
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    result = result.filter((item) => item.title.toLowerCase().includes(q));
  }

  if (sortOption !== "default") {
    result = [...result].sort((a, b) => {
      if (sortOption === "name_asc") {
        return a.title.localeCompare(b.title);
      }
      if (sortOption === "name_desc") {
        return b.title.localeCompare(a.title);
      }
      if (sortOption === "rating_desc") {
        const rA = parseFloat(String(a.rating || 0));
        const rB = parseFloat(String(b.rating || 0));
        return rB - rA;
      }
      if (sortOption === "added_desc") {
        const tA = parseInt(String(a.added || 0), 10);
        const tB = parseInt(String(b.added || 0), 10);
        return tB - tA;
      }
      return 0;
    });
  }

  return result;
}

function getResolutionBadge(title: string, container?: string): string | null {
  const t = title.toUpperCase();
  if (t.includes("4K") || t.includes("UHD")) return "4K";
  if (t.includes("FHD") || t.includes("1080P")) return "FHD";
  if (t.includes("HD") || t.includes("720P")) return "HD";
  if (container) return container.toUpperCase();
  return null;
}

function calculateEpgProgress(
  currentUnix: number,
  startTimestamp: number,
  stopTimestamp: number
): number {
  if (!startTimestamp || !stopTimestamp || startTimestamp >= stopTimestamp) return 0;
  if (currentUnix < startTimestamp) return 0;
  if (currentUnix > stopTimestamp) return 100;

  const total = stopTimestamp - startTimestamp;
  const elapsed = currentUnix - startTimestamp;
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

function isEpgProgramLive(
  currentUnix: number,
  startTimestamp: number,
  stopTimestamp: number
): boolean {
  return currentUnix >= startTimestamp && currentUnix <= stopTimestamp;
}

describe("Catalog & EPG Unit Tests", () => {
  const mockItems: CatalogItem[] = [
    normalizeCatalogItem(
      {
        stream_id: 1,
        name: "US: CNN HD 4K",
        category_id: "news",
        rating: "8.5",
        added: "1700000000",
      } as LiveChannel,
      "live"
    ),
    normalizeCatalogItem(
      {
        stream_id: 2,
        name: "BBC One FHD",
        category_id: "news",
        rating: "9.1",
        added: "1700005000",
      } as LiveChannel,
      "live"
    ),
    normalizeCatalogItem(
      {
        stream_id: 101,
        name: "Inception (2010)",
        category_id: "movies",
        rating: "8.8",
        container_extension: "mp4",
        added: "1700002000",
      } as VodMovie,
      "vod"
    ),
    normalizeCatalogItem(
      {
        series_id: 501,
        name: "Breaking Bad",
        category_id: "drama",
        rating: "9.5",
        last_modified: "1700009000",
      } as Series,
      "series"
    ),
  ];

  describe("Item Normalization & Resolution Badges", () => {
    it("should correctly normalize live, vod, and series raw payloads", () => {
      const liveItem = mockItems[0];
      expect(liveItem.id).toBe(1);
      expect(liveItem.title).toBe("US: CNN HD 4K");
      expect(liveItem.type).toBe("live");
      expect(liveItem.container_extension).toBe("ts");

      const vodItem = mockItems[2];
      expect(vodItem.id).toBe(101);
      expect(vodItem.title).toBe("Inception (2010)");
      expect(vodItem.type).toBe("vod");
      expect(vodItem.container_extension).toBe("mp4");

      const seriesItem = mockItems[3];
      expect(seriesItem.id).toBe(501);
      expect(seriesItem.title).toBe("Breaking Bad");
      expect(seriesItem.type).toBe("series");
    });

    it("should extract resolution badges accurately from title or container", () => {
      expect(getResolutionBadge("US: CNN HD 4K")).toBe("4K");
      expect(getResolutionBadge("BBC News FHD")).toBe("FHD");
      expect(getResolutionBadge("Sky Sports 720p")).toBe("HD");
      expect(getResolutionBadge("Random Channel", "mkv")).toBe("MKV");
    });
  });

  describe("Category & Title Search Filtering", () => {
    it("should filter items by category ID", () => {
      const newsItems = filterAndSortItems(mockItems, "news", "", "default");
      expect(newsItems.length).toBe(2);
      expect(newsItems.every((i) => i.category_id === "news")).toBe(true);
    });

    it("should filter items by title search query case-insensitively", () => {
      const bbcItems = filterAndSortItems(mockItems, "all", "bbc", "default");
      expect(bbcItems.length).toBe(1);
      expect(bbcItems[0].title).toBe("BBC One FHD");

      const breakingItems = filterAndSortItems(mockItems, "all", "BREAKING", "default");
      expect(breakingItems.length).toBe(1);
      expect(breakingItems[0].title).toBe("Breaking Bad");
    });

    it("should apply combined category and search filter", () => {
      const result = filterAndSortItems(mockItems, "news", "CNN", "default");
      expect(result.length).toBe(1);
      expect(result[0].title).toBe("US: CNN HD 4K");
    });
  });

  describe("Catalog Sorting", () => {
    it("should sort items by Title A-Z (name_asc)", () => {
      const sorted = filterAndSortItems(mockItems, "all", "", "name_asc");
      expect(sorted[0].title).toBe("BBC One FHD");
      expect(sorted[1].title).toBe("Breaking Bad");
      expect(sorted[2].title).toBe("Inception (2010)");
      expect(sorted[3].title).toBe("US: CNN HD 4K");
    });

    it("should sort items by Title Z-A (name_desc)", () => {
      const sorted = filterAndSortItems(mockItems, "all", "", "name_desc");
      expect(sorted[0].title).toBe("US: CNN HD 4K");
      expect(sorted[3].title).toBe("BBC One FHD");
    });

    it("should sort items by Highest Rated (rating_desc)", () => {
      const sorted = filterAndSortItems(mockItems, "all", "", "rating_desc");
      expect(sorted[0].title).toBe("Breaking Bad"); // 9.5
      expect(sorted[1].title).toBe("BBC One FHD"); // 9.1
      expect(sorted[2].title).toBe("Inception (2010)"); // 8.8
      expect(sorted[3].title).toBe("US: CNN HD 4K"); // 8.5
    });
  });

  describe("EPG Progress & Live Program Logic", () => {
    it("should calculate EPG program progress correctly", () => {
      const start = 1000;
      const stop = 2000;

      // Before start
      expect(calculateEpgProgress(500, start, stop)).toBe(0);

      // Halfway through
      expect(calculateEpgProgress(1500, start, stop)).toBe(50);

      // At end
      expect(calculateEpgProgress(2000, start, stop)).toBe(100);

      // Past end
      expect(calculateEpgProgress(2500, start, stop)).toBe(100);
    });

    it("should accurately determine if EPG program is currently live", () => {
      const start = 1000;
      const stop = 2000;

      expect(isEpgProgramLive(999, start, stop)).toBe(false);
      expect(isEpgProgramLive(1000, start, stop)).toBe(true);
      expect(isEpgProgramLive(1500, start, stop)).toBe(true);
      expect(isEpgProgramLive(2000, start, stop)).toBe(true);
      expect(isEpgProgramLive(2001, start, stop)).toBe(false);
    });
  });
});
