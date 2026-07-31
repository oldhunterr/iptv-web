"use client";

import React from "react";
import { ContentFilterOptions, WatchedFilterStatus } from "@/types/settings";
import { Sparkles, Star, Download, PlayCircle, Layers } from "lucide-react";

interface QuickFilterPillsProps {
  filterOptions: ContentFilterOptions;
  onChange: (updated: Partial<ContentFilterOptions>) => void;
}

export const QuickFilterPills: React.FC<QuickFilterPillsProps> = ({
  filterOptions,
  onChange,
}) => {
  const isDefaultAll =
    filterOptions.selectedGenres.length === 0 &&
    filterOptions.minRating === 0 &&
    filterOptions.yearRange[0] === 1980 &&
    filterOptions.watchedStatus === "all" &&
    !filterOptions.onlyDownloaded;

  const handleResetAll = () => {
    onChange({
      selectedGenres: [],
      minRating: 0,
      yearRange: [1980, 2026],
      watchedStatus: "all",
      onlyDownloaded: false,
    });
  };

  const handleToggleGenre = (genre: string) => {
    const exists = filterOptions.selectedGenres.includes(genre);
    let nextGenres = [...filterOptions.selectedGenres];
    if (exists) {
      nextGenres = nextGenres.filter((g) => g !== genre);
    } else {
      nextGenres.push(genre);
    }
    onChange({ selectedGenres: nextGenres });
  };

  const handleToggleWatched = (status: WatchedFilterStatus) => {
    onChange({
      watchedStatus: filterOptions.watchedStatus === status ? "all" : status,
    });
  };

  const handleToggleTopRated = () => {
    onChange({ minRating: filterOptions.minRating === 8 ? 0 : 8 });
  };

  const handleToggleRecentYear = () => {
    const is2024Plus = filterOptions.yearRange[0] === 2024;
    onChange({ yearRange: is2024Plus ? [1980, 2026] : [2024, 2026] });
  };

  const handleToggleDownloaded = () => {
    onChange({ onlyDownloaded: !filterOptions.onlyDownloaded });
  };

  return (
    <div
      data-testid="quick-filter-pills"
      className="flex items-center gap-2 overflow-x-auto py-2.5 px-4 scrollbar-none border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md select-none"
    >
      {/* Reset / All Pill */}
      <button
        onClick={handleResetAll}
        data-testid="quick-pill-all"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 border transition-all ${
          isDefaultAll
            ? "bg-cyan-600/20 border-cyan-500 text-cyan-300 shadow-sm shadow-cyan-500/20"
            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
        }`}
      >
        <Layers className="w-3.5 h-3.5" />
        All Content
      </button>

      {/* Unwatched Pill */}
      <button
        onClick={() => handleToggleWatched("unwatched")}
        data-testid="quick-pill-unwatched"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 border transition-all ${
          filterOptions.watchedStatus === "unwatched"
            ? "bg-cyan-600/20 border-cyan-500 text-cyan-300 shadow-sm shadow-cyan-500/20"
            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
        }`}
      >
        <PlayCircle className="w-3.5 h-3.5" />
        Unwatched
      </button>

      {/* In Progress Pill */}
      <button
        onClick={() => handleToggleWatched("in-progress")}
        data-testid="quick-pill-in-progress"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 border transition-all ${
          filterOptions.watchedStatus === "in-progress"
            ? "bg-cyan-600/20 border-cyan-500 text-cyan-300 shadow-sm shadow-cyan-500/20"
            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
        }`}
      >
        In Progress
      </button>

      {/* Top Rated (★ 8+) */}
      <button
        onClick={handleToggleTopRated}
        data-testid="quick-pill-top-rated"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 border transition-all ${
          filterOptions.minRating >= 8
            ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm shadow-amber-500/20"
            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
        }`}
      >
        <Star className="w-3.5 h-3.5 fill-current text-amber-400" />
        Top Rated (8+)
      </button>

      {/* 2024+ Recent Release */}
      <button
        onClick={handleToggleRecentYear}
        data-testid="quick-pill-2024"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 border transition-all ${
          filterOptions.yearRange[0] === 2024
            ? "bg-purple-500/20 border-purple-500 text-purple-300 shadow-sm shadow-purple-500/20"
            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
        }`}
      >
        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
        2024+ New Releases
      </button>

      {/* Genre Pills */}
      {["Action", "Comedy", "Drama", "Sci-Fi", "Horror", "Animation"].map((genre) => {
        const isSelected = filterOptions.selectedGenres.includes(genre);
        return (
          <button
            key={genre}
            onClick={() => handleToggleGenre(genre)}
            data-testid={`quick-pill-genre-${genre.toLowerCase()}`}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 border transition-all ${
              isSelected
                ? "bg-cyan-600/20 border-cyan-500 text-cyan-300 shadow-sm shadow-cyan-500/20"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            {genre}
          </button>
        );
      })}

      {/* Downloaded Pill */}
      <button
        onClick={handleToggleDownloaded}
        data-testid="quick-pill-downloaded"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 border transition-all ${
          filterOptions.onlyDownloaded
            ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm shadow-emerald-500/20"
            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
        }`}
      >
        <Download className="w-3.5 h-3.5 text-emerald-400" />
        Downloaded Only
      </button>
    </div>
  );
};
