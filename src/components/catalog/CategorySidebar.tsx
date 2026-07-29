"use client";

import React, { useState } from "react";
import { Tv, Film, Clapperboard, Heart, History, Search } from "lucide-react";
import { AppSection, Category } from "@/types/iptv";

interface CategorySidebarProps {
  activeSection: AppSection;
  onSelectSection: (section: AppSection) => void;
  categories: Category[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
  liveCount?: number;
  moviesCount?: number;
  seriesCount?: number;
  favoritesCount?: number;
  historyCount?: number;
}

export const CategorySidebar: React.FC<CategorySidebarProps> = ({
  activeSection,
  onSelectSection,
  categories,
  selectedCategoryId,
  onSelectCategory,
  liveCount = 0,
  moviesCount = 0,
  seriesCount = 0,
  favoritesCount = 0,
  historyCount = 0,
}) => {
  const [catSearch, setCatSearch] = useState("");

  const filteredCategories = categories.filter((cat) =>
    cat.category_name.toLowerCase().includes(catSearch.toLowerCase())
  );

  const navItems: { id: AppSection; label: string; icon: React.ReactNode; count: number }[] = [
    { id: "live", label: "Live TV", icon: <Tv className="w-4 h-4" />, count: liveCount },
    { id: "movies", label: "Movies", icon: <Film className="w-4 h-4" />, count: moviesCount },
    { id: "series", label: "Series", icon: <Clapperboard className="w-4 h-4" />, count: seriesCount },
    { id: "favorites", label: "Favorites", icon: <Heart className="w-4 h-4" />, count: favoritesCount },
    { id: "history", label: "History", icon: <History className="w-4 h-4" />, count: historyCount },
  ];

  return (
    <aside
      data-testid="category-sidebar"
      className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 h-full select-none"
    >
      {/* App Branding Header */}
      <div className="p-4 border-b border-slate-800 flex items-center gap-3">
        <div className="p-2 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-xl shadow-md text-white">
          <Tv className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-extrabold text-white tracking-wide text-lg">IPTV Hub</h1>
          <p className="text-[11px] text-cyan-400 font-medium">Next.js Web Edition</p>
        </div>
      </div>

      {/* Main Section Nav */}
      <nav className="p-3 space-y-1 border-b border-slate-800" data-testid="section-nav">
        {navItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectSection(item.id);
                onSelectCategory("ALL");
              }}
              data-testid={`nav-section-${item.id}`}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                isActive
                  ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {item.icon}
                <span>{item.label}</span>
              </div>
              {item.count > 0 && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-mono font-semibold ${
                    isActive ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Category Filter Search & List (Only for live/movies/series) */}
      {(activeSection === "live" || activeSection === "movies" || activeSection === "series") && (
        <div className="flex-1 flex flex-col min-h-0 p-3">
          <div className="relative mb-3">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search categories..."
              value={catSearch}
              onChange={(e) => setCatSearch(e.target.value)}
              data-testid="category-search-input"
              className="w-full bg-slate-950 text-xs text-slate-200 placeholder-slate-500 pl-9 pr-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-0.5 pr-1" data-testid="category-list">
            <button
              onClick={() => onSelectCategory("ALL")}
              data-testid="category-item-ALL"
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                selectedCategoryId === "ALL"
                  ? "bg-slate-800 text-cyan-400 font-semibold border-l-2 border-cyan-400"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-850"
              }`}
            >
              All Categories
            </button>

            {filteredCategories.map((cat) => {
              const isSelected = selectedCategoryId === String(cat.category_id);
              return (
                <button
                  key={cat.category_id}
                  onClick={() => onSelectCategory(String(cat.category_id))}
                  data-testid={`category-item-${cat.category_id}`}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium truncate transition-colors ${
                    isSelected
                      ? "bg-slate-800 text-cyan-400 font-semibold border-l-2 border-cyan-400"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/80"
                  }`}
                >
                  {cat.category_name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
};
