"use client";

import React from "react";
import { Search, RefreshCw, Layers, SlidersHorizontal, Settings } from "lucide-react";
import { UserProfile } from "@/types/settings";

interface SearchFilterHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  categoryName: string;
  itemCount: number;
  onSyncData: () => void;
  isLoading?: boolean;
  onToggleFilterBar?: () => void;
  isFilterOpen?: boolean;
  activeFilterCount?: number;
  onOpenSettings?: () => void;
  activeProfile?: UserProfile;
}

export const SearchFilterHeader: React.FC<SearchFilterHeaderProps> = ({
  searchQuery,
  onSearchChange,
  categoryName,
  itemCount,
  onSyncData,
  isLoading = false,
  onToggleFilterBar,
  isFilterOpen = false,
  activeFilterCount = 0,
  onOpenSettings,
}) => {
  return (
    <header
      data-testid="search-filter-header"
      className="bg-glass border-b border-border-subtle p-4 flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-[var(--glass-blur)] sticky top-0 z-20"
    >
      {/* Category Info & Count Badge */}
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <div className="p-2 bg-surface-hover rounded-xl text-accent-primary">
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

      {/* Search Input, Advanced Filter Toggle & Action Buttons */}
      <div className="flex items-center gap-2.5 w-full sm:w-auto">
        <div className="relative flex-1 sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search channels, movies, series..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            data-testid="catalog-search-input"
            className="w-full bg-app text-sm text-theme-primary placeholder-theme-muted pl-9 pr-4 py-2 rounded-xl border border-border-subtle focus:outline-none focus:border-accent-primary transition-colors shadow-inner"
          />
        </div>

        {/* Filter Drawer Toggle Button */}
        {onToggleFilterBar && (
          <button
            onClick={onToggleFilterBar}
            data-testid="toggle-filter-drawer-button"
            className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all shrink-0 ${
              isFilterOpen || activeFilterCount > 0
                ? "bg-accent-primary/20 border-accent-primary text-accent-light shadow-md"
                : "bg-surface hover:bg-surface-hover text-theme-muted border-border-subtle"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden md:inline">Filter</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-accent-primary text-app font-bold text-[10px] flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        )}

        {/* Settings Shortcut Button */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            data-testid="header-settings-button"
            className="p-2 bg-surface hover:bg-surface-hover text-theme-muted hover:text-theme-primary rounded-xl border border-border-subtle transition-all shrink-0"
            title="Open Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}

        {/* Sync Data Button */}
        <button
          onClick={onSyncData}
          disabled={isLoading}
          data-testid="sync-data-button"
          className="flex items-center gap-2 px-3 py-2 bg-surface hover:bg-surface-hover disabled:opacity-50 text-theme-muted hover:text-theme-primary text-xs font-semibold rounded-xl border border-border-subtle transition-all shadow-sm shrink-0"
          title="Force Sync / Refresh Data from Server"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-accent-primary" : ""}`} />
          <span className="hidden md:inline">Sync Data</span>
        </button>
      </div>
    </header>
  );
};
