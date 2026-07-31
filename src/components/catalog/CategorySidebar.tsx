"use client";

import React, { useState } from "react";
import { Tv, Film, Clapperboard, Heart, History, Search, Settings, User, Baby, Sparkles, Lock } from "lucide-react";
import { AppSection, Category } from "@/types/iptv";
import { UserProfile } from "@/types/settings";

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
  activeProfile?: UserProfile;
  onOpenProfileModal?: () => void;
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
  activeProfile,
  onOpenProfileModal,
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
    { id: "settings", label: "Settings", icon: <Settings className="w-4 h-4" />, count: 0 },
  ];

  const getAvatarIcon = (avatarKey?: string) => {
    switch (avatarKey) {
      case "baby":
        return <Baby className="w-4 h-4 text-pink-400" />;
      case "sparkles":
        return <Sparkles className="w-4 h-4 text-amber-400" />;
      default:
        return <User className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <aside
      data-testid="category-sidebar"
      className="w-64 bg-surface border-r border-border-subtle flex flex-col shrink-0 h-full select-none"
    >
      {/* App Branding Header */}
      <div className="p-4 border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-accent-primary to-accent-hover rounded-xl shadow-md text-white">
            <Tv className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-extrabold text-white tracking-wide text-lg">IPTV Hub</h1>
            <p className="text-[11px] text-accent-primary font-medium">Next.js Web Edition</p>
          </div>
        </div>
      </div>

      {/* Main Section Nav */}
      <nav className="p-3 space-y-1 border-b border-border-subtle" data-testid="section-nav">
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
                  ? "bg-accent-primary text-white shadow-lg"
                  : "text-theme-muted hover:text-theme-primary hover:bg-surface-hover"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {item.icon}
                <span>{item.label}</span>
              </div>
              {item.count > 0 && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-mono font-semibold ${
                    isActive ? "bg-white/20 text-white" : "bg-surface-hover text-theme-muted"
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
              className="w-full bg-app text-xs text-theme-primary placeholder-theme-muted pl-9 pr-3 py-2 rounded-xl border border-border-subtle focus:outline-none focus:border-accent-primary transition-colors"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-0.5 pr-1" data-testid="category-list">
            <button
              onClick={() => onSelectCategory("ALL")}
              data-testid="category-item-ALL"
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                selectedCategoryId === "ALL"
                  ? "bg-surface-hover text-accent-primary font-semibold border-l-2 border-accent-primary"
                  : "text-theme-muted hover:text-theme-primary hover:bg-surface-hover"
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
                      ? "bg-surface-hover text-accent-primary font-semibold border-l-2 border-accent-primary"
                      : "text-theme-muted hover:text-theme-primary hover:bg-surface-hover"
                  }`}
                >
                  {cat.category_name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Profile Switcher Pill Footer */}
      {activeProfile && (
        <div className="p-3 border-t border-border-subtle mt-auto">
          <button
            onClick={onOpenProfileModal}
            data-testid="sidebar-profile-button"
            className="w-full flex items-center justify-between p-2.5 bg-app/80 hover:bg-surface-hover border border-border-subtle hover:border-accent-primary/40 rounded-2xl transition-all group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 bg-surface rounded-xl border border-border-subtle group-hover:border-accent-primary/30">
                {getAvatarIcon(activeProfile.avatar)}
              </div>
              <div className="text-left truncate">
                <p className="text-xs font-bold text-white truncate">{activeProfile.name}</p>
                <p className="text-[10px] text-cyan-400 font-medium">
                  {activeProfile.isMaster ? "Master" : activeProfile.isKids ? "Kids" : "Switch User"}
                </p>
              </div>
            </div>
            {Boolean(activeProfile.pin || activeProfile.pinHash) && (
              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            )}
          </button>
        </div>
      )}
    </aside>
  );
};
