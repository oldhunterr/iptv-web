import { describe, it, expect } from "vitest";
import { getStorageQuotaEstimate } from "../../src/lib/idb-downloads";

describe("IndexedDB Offline Downloads Unit Tests", () => {
  it("should return quota estimate with default values when navigator.storage is unavailable", async () => {
    const quotaInfo = await getStorageQuotaEstimate();
    expect(quotaInfo.quotaBytes).toBeGreaterThan(0);
    expect(quotaInfo.usedPercent).toBeGreaterThanOrEqual(0);
    expect(quotaInfo.availableBytes).toBeGreaterThanOrEqual(0);
  });
});
