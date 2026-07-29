"use client";

import React from "react";
import { Search, RefreshCw, Layers } from "lucide-react";

interface SearchFilterHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  categoryName: string;
  itemCount: number;
  onSyncData: () => void;
  isLoading?: boolean;
}

export const SearchFilterHeader: React.FC<SearchFilterHeaderProps> = ({
  searchQuery,
  onSearchChange,
  categoryName,
  itemCount,
  onSyncData,
  isLoading = false,
}) => {
  return (
    <header
      data-testid="search-filter-header"
      className="bg-slate-900/90 border-b border-slate-800 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-md sticky top-0 z-20"
    >
      {/* Category Info & Count Badge */}
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <div className="p-2 bg-slate-800 rounded-xl text-cyan-400">
          <Layers className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white tracking-tight truncate max-w-xs sm:max-w-sm">
            {categoryName}
          </h2>
          <span
            data-testid="item-count-badge"
            className="text-xs text-slate-400 font-medium"
          >
            {itemCount.toLocaleString()} items available
          </span>
        </div>
      </div>

      {/* Search Input & Sync Controls */}
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <div className="relative flex-1 sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search channels, movies, series..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            data-testid="catalog-search-input"
            className="w-full bg-slate-950 text-sm text-slate-200 placeholder-slate-500 pl-9 pr-4 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-cyan-500 transition-colors shadow-inner"
          />
        </div>

        <button
          onClick={onSyncData}
          disabled={isLoading}
          data-testid="sync-data-button"
          className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-slate-700 transition-all shadow-sm shrink-0"
          title="Force Sync / Refresh Data from Server"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-cyan-400" : ""}`} />
          <span className="hidden md:inline">Sync Data</span>
        </button>
      </div>
    </header>
  );
};
