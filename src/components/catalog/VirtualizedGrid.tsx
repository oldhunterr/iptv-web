"use client";

import React, { useRef, useState, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CatalogItem } from "@/types/iptv";
import { ItemCard } from "./ItemCard";

interface VirtualizedGridProps {
  items: CatalogItem[];
  onSelectItem: (item: CatalogItem) => void;
}

export const VirtualizedGrid: React.FC<VirtualizedGridProps> = ({ items, onSelectItem }) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(5);
  const [visibleCount, setVisibleCount] = useState(120);

  // Reset visible items when the underlying list changes (e.g., search, category change)
  useEffect(() => {
    setVisibleCount(120);
  }, [items]);

  // Dynamic grid column calculation based on parent container width
  useEffect(() => {
    const updateColumns = () => {
      if (!parentRef.current) return;
      const width = parentRef.current.clientWidth;
      if (width < 640) setColumns(2);
      else if (width < 768) setColumns(3);
      else if (width < 1024) setColumns(4);
      else if (width < 1280) setColumns(5);
      else setColumns(6);
    };

    updateColumns();
    const observer = new ResizeObserver(updateColumns);
    if (parentRef.current) observer.observe(parentRef.current);
    return () => observer.disconnect();
  }, []);

  const displayedItems = items.slice(0, visibleCount);
  const rowCount = Math.ceil(displayedItems.length / columns);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => {
      const width = parentRef.current ? parentRef.current.clientWidth : (typeof window !== 'undefined' ? window.innerWidth : 1000);
      const colWidth = (width - ((columns - 1) * 16) - 32) / columns; // 32 is padding, 16 is gap
      return (colWidth * 1.5) + 65; // Aspect ratio + footer height
    },
    overscan: 2,
  });

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // Load more when user scrolls within 800px of the bottom
    if (scrollHeight - scrollTop - clientHeight < 800) {
      if (visibleCount < items.length) {
        setVisibleCount((prev) => Math.min(prev + 120, items.length));
      }
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500">
        <p className="text-base font-semibold">No catalog items found</p>
        <p className="text-xs text-slate-600 mt-1">Try adjusting your search query or category filter</p>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      onScroll={handleScroll}
      data-testid="virtualized-grid-container"
      className="flex-1 overflow-y-auto p-4 select-none"
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * columns;
          const rowItems = displayedItems.slice(startIndex, startIndex + columns);

          return (
            <div
              key={virtualRow.key}
              data-testid={`grid-row-${virtualRow.index}`}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                display: "grid",
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                gap: "1rem",
                alignItems: "start",
              }}
              className="transition-all"
            >
              {rowItems.map((item, idx) => {
                const itemId = item.type === "series" ? item.series_id : item.stream_id;
                return (
                  <ItemCard
                    key={`${item.type}_${itemId}_${startIndex + idx}`}
                    item={item}
                    onSelect={onSelectItem}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
