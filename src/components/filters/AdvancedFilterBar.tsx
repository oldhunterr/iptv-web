"use client";

import React from "react";
import { ContentFilterOptions, SortField, WatchedFilterStatus } from "@/types/settings";
import { SlidersHorizontal, RotateCcw, X, Star, Calendar, ArrowUpDown, Filter, Tv, Monitor, Radio } from "lucide-react";

interface AdvancedFilterBarProps {
  filterOptions: ContentFilterOptions;
  onChange: (updated: Partial<ContentFilterOptions>) => void;
  isOpen: boolean;
  onClose: () => void;
  totalFilteredCount?: number;
}

const COMMON_GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "Horror",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Thriller",
];

export const AdvancedFilterBar: React.FC<AdvancedFilterBarProps> = ({
  filterOptions,
  onChange,
  isOpen,
  onClose,
  totalFilteredCount,
}) => {
  if (!isOpen) return null;

  const handleToggleGenre = (genre: string) => {
    const exists = filterOptions.selectedGenres.includes(genre);
    const updated = exists
      ? filterOptions.selectedGenres.filter((g) => g !== genre)
      : [...filterOptions.selectedGenres, genre];
    onChange({ selectedGenres: updated });
  };

  const handleReset = () => {
    onChange({
      selectedGenres: [],
      yearRange: [1980, 2026],
      minRating: 0,
      watchedStatus: "all",
      streamType: "all",
      resolution: "all",
      hasEpg: false,
      onlyDownloaded: false,
      sortBy: "default",
    });
  };

  const activeFilterCount =
    filterOptions.selectedGenres.length +
    (filterOptions.minRating > 0 ? 1 : 0) +
    (filterOptions.yearRange[0] > 1980 || filterOptions.yearRange[1] < 2026 ? 1 : 0) +
    (filterOptions.watchedStatus !== "all" ? 1 : 0) +
    (filterOptions.streamType && filterOptions.streamType !== "all" ? 1 : 0) +
    (filterOptions.resolution && filterOptions.resolution !== "all" ? 1 : 0) +
    (filterOptions.hasEpg ? 1 : 0) +
    (filterOptions.onlyDownloaded ? 1 : 0) +
    (filterOptions.sortBy !== "default" ? 1 : 0);

  return (
    <div
      data-testid="advanced-filter-drawer"
      className="p-4 bg-slate-900/95 border-b border-slate-800 backdrop-blur-xl shadow-2xl space-y-5 animate-fade-in text-slate-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-cyan-600/20 border border-cyan-500/30 rounded-lg text-cyan-400">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-white text-sm">Advanced IPTV Content Filters &amp; Facets</h3>
          {activeFilterCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500 text-slate-950 font-bold">
              {activeFilterCount} Active
            </span>
          )}
          {typeof totalFilteredCount === "number" && (
            <span className="text-xs text-slate-400 font-medium ml-2">
              ({totalFilteredCount.toLocaleString()} items match)
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {activeFilterCount > 0 && (
            <button
              onClick={handleReset}
              data-testid="reset-filters-button"
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-400 transition-colors font-semibold"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
            </button>
          )}
          <button
            onClick={onClose}
            data-testid="close-filter-bar"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 pt-1 border-t border-slate-800/60">
        {/* 1. IPTV Metadata Facets (StreamType, Resolution, EPG) */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
            <Tv className="w-3.5 h-3.5 text-cyan-400" /> Stream Type &amp; Resolution
          </label>
          <div className="space-y-2">
            <div>
              <span className="text-[11px] text-slate-400 block mb-1">Stream Classification</span>
              <div className="grid grid-cols-2 gap-1">
                {[
                  { id: "all", label: "All" },
                  { id: "live", label: "Live TV" },
                  { id: "movies", label: "Movies" },
                  { id: "series", label: "Series" },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => onChange({ streamType: st.id as any })}
                    data-testid={`stream-type-${st.id}`}
                    className={`py-1 px-2 text-[11px] font-semibold rounded-lg border transition-all ${
                      (filterOptions.streamType || "all") === st.id
                        ? "bg-cyan-600/20 border-cyan-500 text-cyan-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block mb-1">Quality Resolution Facet</span>
              <div className="grid grid-cols-2 gap-1">
                {[
                  { id: "all", label: "All Quality" },
                  { id: "4K", label: "4K UHD" },
                  { id: "1080p", label: "1080p FHD" },
                  { id: "720p", label: "720p HD" },
                ].map((res) => (
                  <button
                    key={res.id}
                    onClick={() => onChange({ resolution: res.id as any })}
                    data-testid={`resolution-facet-${res.id}`}
                    className={`py-1 px-2 text-[11px] font-semibold rounded-lg border transition-all ${
                      (filterOptions.resolution || "all") === res.id
                        ? "bg-purple-600/20 border-purple-500 text-purple-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {res.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                <Radio className="w-3.5 h-3.5 text-cyan-400" /> Has EPG Guide Data
              </span>
              <input
                type="checkbox"
                checked={filterOptions.hasEpg || false}
                onChange={(e) => onChange({ hasEpg: e.target.checked })}
                data-testid="toggle-has-epg"
                className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* 2. Genres Selector */}
        <div className="space-y-2 lg:col-span-1">
          <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-cyan-400" /> Genre Filter
          </label>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
            {COMMON_GENRES.map((g) => {
              const isSelected = filterOptions.selectedGenres.includes(g);
              return (
                <button
                  key={g}
                  onClick={() => handleToggleGenre(g)}
                  data-testid={`genre-tag-${g.toLowerCase()}`}
                  className={`px-2 py-0.5 rounded-lg text-xs font-medium border transition-colors ${
                    isSelected
                      ? "bg-cyan-600 text-white border-cyan-400 shadow-md shadow-cyan-600/30"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Rating & Year Controls */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> Min Rating
              </span>
              <span className="text-cyan-400 font-bold text-xs">
                {filterOptions.minRating > 0 ? `★ ${filterOptions.minRating}.0+` : "Any Rating"}
              </span>
            </label>
            <div className="flex gap-1.5">
              {[0, 5, 7, 8].map((r) => (
                <button
                  key={r}
                  onClick={() => onChange({ minRating: r })}
                  data-testid={`min-rating-${r}`}
                  className={`flex-1 py-1 text-xs font-bold rounded-lg border transition-all ${
                    filterOptions.minRating === r
                      ? "bg-amber-500/20 border-amber-500 text-amber-300"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {r === 0 ? "All" : `${r}+`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 flex items-center justify-between mb-1">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-400" /> Release Year Range
              </span>
              <span className="text-purple-300 font-bold text-xs">
                {filterOptions.yearRange[0]} - {filterOptions.yearRange[1]}
              </span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1950}
                max={2026}
                value={filterOptions.yearRange[0]}
                onChange={(e) =>
                  onChange({
                    yearRange: [parseInt(e.target.value) || 1980, filterOptions.yearRange[1]],
                  })
                }
                data-testid="year-range-min-input"
                className="w-1/2 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
              <span className="text-xs text-slate-600">-</span>
              <input
                type="number"
                min={1950}
                max={2026}
                value={filterOptions.yearRange[1]}
                onChange={(e) =>
                  onChange({
                    yearRange: [filterOptions.yearRange[0], parseInt(e.target.value) || 2026],
                  })
                }
                data-testid="year-range-max-input"
                className="w-1/2 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* 4. Watched Status & Sorting Dropdown */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1.5">Watched Status</label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: "all", label: "All" },
                { id: "unwatched", label: "Unwatched" },
                { id: "in-progress", label: "In Progress" },
                { id: "watched", label: "Watched" },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => onChange({ watchedStatus: st.id as WatchedFilterStatus })}
                  data-testid={`watched-status-${st.id}`}
                  className={`py-1 text-xs font-semibold rounded-lg border transition-all ${
                    filterOptions.watchedStatus === st.id
                      ? "bg-cyan-600/20 border-cyan-500 text-cyan-300"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 mb-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" /> Sort Order
            </label>
            <select
              value={filterOptions.sortBy}
              onChange={(e) => onChange({ sortBy: e.target.value as SortField })}
              data-testid="sort-by-select"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="default">Default Order</option>
              <option value="name_asc">Title (A to Z)</option>
              <option value="name_desc">Title (Z to A)</option>
              <option value="rating_desc">Rating (High to Low)</option>
              <option value="year_desc">Release Year (Newest)</option>
              <option value="added_desc">Recently Added</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
