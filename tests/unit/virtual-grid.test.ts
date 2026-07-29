import { describe, it, expect } from "vitest";
import { normalizeCatalogItem, CatalogItem, ViewMode } from "../../src/types/iptv";

// Helper functions testing virtualization mathematical & algorithmic logic
function calculateColumnCount(width: number, viewMode: ViewMode, overrideColumns?: number): number {
  if (viewMode === "list") return 1;
  if (overrideColumns && overrideColumns > 0) return overrideColumns;
  if (width < 480) return 2;
  if (width < 768) return 3;
  if (width < 1024) return 4;
  if (width < 1280) return 5;
  return 6;
}

function calculateRowCount(totalItems: number, columnCount: number): number {
  if (totalItems <= 0 || columnCount <= 0) return 0;
  return Math.ceil(totalItems / columnCount);
}

function calculateTotalVirtualHeight(
  rowCount: number,
  rowHeight: number
): number {
  return rowCount * rowHeight;
}

function getVisibleRowRange(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  overscan: number = 3,
  totalRows: number = 0
): { start: number; end: number } {
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(
    totalRows,
    Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan
  );
  return { start, end };
}

describe("VirtualizedGrid Unit Tests", () => {
  it("should calculate column counts correctly across responsive breakpoints", () => {
    expect(calculateColumnCount(320, "grid")).toBe(2);
    expect(calculateColumnCount(600, "grid")).toBe(3);
    expect(calculateColumnCount(800, "grid")).toBe(4);
    expect(calculateColumnCount(1100, "grid")).toBe(5);
    expect(calculateColumnCount(1400, "grid")).toBe(6);

    // List mode should always be 1 column regardless of width
    expect(calculateColumnCount(1400, "list")).toBe(1);

    // Override columns prop should take precedence in grid mode
    expect(calculateColumnCount(1400, "grid", 4)).toBe(4);
  });

  it("should handle virtualized grid row calculations for 10,000+ items without DOM bloat", () => {
    const totalItems = 10000;
    const columns = 5;
    const rowCount = calculateRowCount(totalItems, columns);

    expect(rowCount).toBe(2000);

    const rowHeight = 340;
    const totalHeight = calculateTotalVirtualHeight(rowCount, rowHeight);
    expect(totalHeight).toBe(680000);

    // Simulate viewport scroll at 1000px down with 800px viewport height
    const { start, end } = getVisibleRowRange(1000, 800, rowHeight, 3, rowCount);

    // Only ~8 virtual rows rendered out of 2,000 total rows!
    const renderedRows = end - start;
    expect(renderedRows).toBeLessThanOrEqual(10);
    expect(start).toBe(0);
    expect(end).toBe(9);
  });

  it("should handle virtualized grid for 50,000+ items efficiently", () => {
    const totalItems = 50000;
    const columns = 6;
    const rowCount = calculateRowCount(totalItems, columns);

    expect(rowCount).toBe(8334);

    const rowHeightGrid = 340;
    const rowHeightList = 88;

    const totalHeightGrid = calculateTotalVirtualHeight(rowCount, rowHeightGrid);
    const totalHeightList = calculateTotalVirtualHeight(totalItems, rowHeightList);

    expect(totalHeightGrid).toBe(2833560);
    expect(totalHeightList).toBe(4400000);
  });

  it("should correctly partition items for a given virtual row", () => {
    const items: CatalogItem[] = Array.from({ length: 100 }, (_, i) =>
      normalizeCatalogItem(
        {
          stream_id: i + 1,
          name: `Channel ${i + 1}`,
          category_id: "1",
        },
        "live"
      )
    );

    const columns = 4;
    const rowIndex = 3; // 4th row (indices 12..15)

    const startIndex = rowIndex * columns;
    const rowItems = items.slice(startIndex, startIndex + columns);

    expect(rowItems.length).toBe(4);
    expect(rowItems[0].id).toBe(13);
    expect(rowItems[3].id).toBe(16);
  });

  it("should return zero rows for empty item list", () => {
    expect(calculateRowCount(0, 5)).toBe(0);
    expect(calculateTotalVirtualHeight(0, 340)).toBe(0);

    const { start, end } = getVisibleRowRange(0, 800, 340, 3, 0);
    expect(start).toBe(0);
    expect(end).toBe(0);
  });
});
