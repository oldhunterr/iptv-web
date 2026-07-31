"use client";

import React, { useState, useEffect } from "react";
import { useTheme, THEME_PRESETS, ThemePresetDefinition } from "@/components/theme/ThemeProvider";
import {
  UserProfile,
  ContentRating,
  ACCENT_SWATCHES,
  GeneralSettings,
  DownloadQueueState,
  ContentFilterOptions,
  IDBDownloadItem,
} from "@/types/settings";
import {
  getProfiles,
  getActiveProfile,
  saveProfile,
  getGeneralSettings,
  saveGeneralSettings,
  getDownloadQueueState,
  saveDownloadQueueState,
  getDefaultFilterOptions,
  saveDefaultFilterOptions,
} from "@/lib/profile-storage";
import {
  Sliders,
  Palette,
  Users,
  Filter,
  Download,
  Shield,
  Check,
  HardDrive,
  Trash2,
  Lock,
  Sparkles,
  Tv,
  Play,
  Pause,
  Clock,
  CheckCircle2,
  ShieldAlert,
  Layers,
  Film,
  Radio,
  FileCode,
} from "lucide-react";

type SettingsTab = "general" | "theme" | "profiles" | "filters" | "downloads";

export const SettingsShell: React.FC<{ onClose?: () => void }> = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("theme");
  const { themeSettings, setThemePreset, setAccentSwatch, updateTheme } = useTheme();

  // Settings states
  const [general, setGeneral] = useState<GeneralSettings>(getGeneralSettings());
  const [activeProfile, setActiveProfile] = useState<UserProfile>(getActiveProfile());
  const [profilesList, setProfilesList] = useState<UserProfile[]>(getProfiles());
  const [downloadQueue, setDownloadQueue] = useState<DownloadQueueState>(getDownloadQueueState());
  const [defaultFilters, setDefaultFilters] = useState<ContentFilterOptions>(getDefaultFilterOptions());

  useEffect(() => {
    setGeneral(getGeneralSettings());
    setActiveProfile(getActiveProfile());
    setProfilesList(getProfiles());
    setDownloadQueue(getDownloadQueueState());
    setDefaultFilters(getDefaultFilterOptions());
  }, []);

  // Update handlers
  const handleSaveGeneral = (updated: Partial<GeneralSettings>) => {
    const next = { ...general, ...updated };
    setGeneral(next);
    saveGeneralSettings(next);

    if (updated.language) {
      const nextProfile = { ...activeProfile, language: updated.language };
      setActiveProfile(nextProfile);
      saveProfile(nextProfile);
      setProfilesList(getProfiles());
    }
  };

  const handleUpdateProfileParental = (updatedParental: Partial<UserProfile["parentalControls"]>) => {
    const nextProfile: UserProfile = {
      ...activeProfile,
      parentalControls: {
        ...activeProfile.parentalControls,
        ...updatedParental,
      },
    };
    setActiveProfile(nextProfile);
    saveProfile(nextProfile);
    setProfilesList(getProfiles());
  };

  const handleUpdateProfileLanguage = (language: string) => {
    const nextProfile: UserProfile = {
      ...activeProfile,
      language,
    };
    setActiveProfile(nextProfile);
    saveProfile(nextProfile);

    const nextGeneral = { ...general, language };
    setGeneral(nextGeneral);
    saveGeneralSettings(nextGeneral);

    setProfilesList(getProfiles());
  };

  const handleSaveDownloads = (updated: Partial<DownloadQueueState>) => {
    const next = { ...downloadQueue, ...updated };
    setDownloadQueue(next);
    saveDownloadQueueState(next);
  };

  const handleDeleteDownloadItem = (id: string) => {
    const nextItems = downloadQueue.items.filter((item) => item.id !== id);
    const next = { ...downloadQueue, items: nextItems };
    setDownloadQueue(next);
    saveDownloadQueueState(next);
  };

  const handleTogglePauseDownload = (id: string) => {
    const nextItems = downloadQueue.items.map((item) => {
      if (item.id === id) {
        const nextStatus = item.status === "downloading" ? "paused" : "downloading";
        return { ...item, status: nextStatus as IDBDownloadItem["status"] };
      }
      return item;
    });
    const next = { ...downloadQueue, items: nextItems };
    setDownloadQueue(next);
    saveDownloadQueueState(next);
  };

  const handleSaveFilters = (updated: Partial<ContentFilterOptions>) => {
    const next = { ...defaultFilters, ...updated };
    setDefaultFilters(next);
    saveDefaultFilterOptions(next);
  };

  // Compute downloaded storage total bytes
  const totalDownloadedBytes = downloadQueue.items
    .filter((i) => i.status === "completed" || i.status === "downloading")
    .reduce((acc, curr) => acc + (curr.bytesDownloaded || 0), 0);
  const totalGbUsed = (totalDownloadedBytes / (1024 * 1024 * 1024)).toFixed(2);
  const quotaGb = 120;
  const quotaPercent = Math.min(100, Math.max(1, ((parseFloat(totalGbUsed) / quotaGb) * 100))).toFixed(1);

  return (
    <div
      data-testid="settings-shell"
      className="flex-1 flex flex-col md:flex-row h-full min-h-0 bg-app text-theme-primary overflow-hidden"
    >
      {/* Settings Navigation Sidebar */}
      <div className="w-full md:w-64 bg-surface border-r border-border-subtle p-4 shrink-0 space-y-1 select-none">
        <div className="pb-3 border-b border-border-subtle mb-2">
          <h2 className="font-extrabold text-white text-lg flex items-center gap-2">
            <Sliders className="w-5 h-5 text-accent-primary" /> Settings
          </h2>
          <p className="text-xs text-theme-muted">Configure application preferences</p>
        </div>

        {[
          { id: "general", label: "General", icon: <Tv className="w-4 h-4" /> },
          { id: "theme", label: "Appearance & Theme", icon: <Palette className="w-4 h-4" /> },
          { id: "profiles", label: "Profiles & Parental", icon: <Users className="w-4 h-4" /> },
          { id: "filters", label: "Content Filtering", icon: <Filter className="w-4 h-4" /> },
          { id: "downloads", label: "Offline Downloads", icon: <Download className="w-4 h-4" /> },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              data-testid={`settings-tab-${tab.id}`}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? "bg-accent-primary text-white shadow-lg"
                  : "text-theme-muted hover:text-theme-primary hover:bg-surface-hover"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Settings Body */}
      <div className="flex-1 p-6 overflow-y-auto min-h-0 space-y-6">
        {/* ========================================== */}
        {/* 1. GENERAL TAB */}
        {/* ========================================== */}
        {activeTab === "general" && (
          <div data-testid="settings-general-tab" className="space-y-6 max-w-3xl">
            <div>
              <h3 className="text-xl font-bold text-white">General Application Settings</h3>
              <p className="text-xs text-slate-400">Configure playback and interface behaviors</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-surface rounded-2xl border border-border-subtle">
                <div>
                  <h4 className="text-sm font-semibold text-white">Autoplay Next Episode</h4>
                  <p className="text-xs text-theme-muted">Automatically launch next episode when binge-watching series</p>
                </div>
                <input
                  type="checkbox"
                  checked={general.autoPlayNextEpisode}
                  onChange={(e) => handleSaveGeneral({ autoPlayNextEpisode: e.target.checked })}
                  data-testid="toggle-autoplay"
                  className="w-5 h-5 accent-accent-primary rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-900 rounded-2xl border border-slate-800">
                <div>
                  <h4 className="text-sm font-semibold text-white">Playback Buffer Window</h4>
                  <p className="text-xs text-slate-400">Pre-buffer video segments before playback starts</p>
                </div>
                <select
                  value={general.bufferSizeSeconds}
                  onChange={(e) => handleSaveGeneral({ bufferSizeSeconds: parseInt(e.target.value) })}
                  data-testid="buffer-size-select"
                  className="bg-app border border-border-subtle rounded-xl px-3 py-1.5 text-xs text-theme-primary focus:outline-none focus:border-accent-primary"
                >
                  <option value={5}>5 seconds (Fastest)</option>
                  <option value={15}>15 seconds (Recommended)</option>
                  <option value={30}>30 seconds (High Latency)</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-4 bg-surface rounded-2xl border border-border-subtle">
                <div>
                  <h4 className="text-sm font-semibold text-white">Hardware Acceleration</h4>
                  <p className="text-xs text-theme-muted">Use GPU acceleration for H.264 / HEVC video decoding</p>
                </div>
                <input
                  type="checkbox"
                  checked={general.hardwareAcceleration}
                  onChange={(e) => handleSaveGeneral({ hardwareAcceleration: e.target.checked })}
                  className="w-5 h-5 accent-accent-primary rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-surface rounded-2xl border border-border-subtle">
                <div>
                  <h4 className="text-sm font-semibold text-white">Default Metadata Language</h4>
                  <p className="text-xs text-theme-muted">App-wide fallback metadata language for TMDB fetches</p>
                </div>
                <select
                  value={general.language || "en-US"}
                  onChange={(e) => handleSaveGeneral({ language: e.target.value })}
                  data-testid="general-language-select"
                  className="bg-app border border-border-subtle rounded-xl px-3 py-1.5 text-xs text-theme-primary focus:outline-none focus:border-accent-primary cursor-pointer"
                >
                  <option value="en-US">English (US)</option>
                  <option value="es-ES">Español (ES)</option>
                  <option value="fr-FR">Français (FR)</option>
                  <option value="de-DE">Deutsch (DE)</option>
                  <option value="it-IT">Italiano (IT)</option>
                  <option value="pt-BR">Português (BR)</option>
                  <option value="ar-SA">العربية (SA)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* 2. THEME & APPEARANCE TAB */}
        {/* ========================================== */}
        {activeTab === "theme" && (
          <div data-testid="settings-theme-tab" className="space-y-8 max-w-4xl">
            <div>
              <h3 className="text-xl font-bold text-white">Appearance & Theme Engine</h3>
              <p className="text-xs text-slate-400">Customize visual themes, dynamic accent glows, anti-FOUC boot, and glassmorphic styling</p>
            </div>

            {/* Theme Presets Matrix */}
            <div>
              <label className="text-sm font-semibold text-white block mb-3">Theme Preset</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(Object.values(THEME_PRESETS) as ThemePresetDefinition[]).map((preset) => {
                  const isSelected = themeSettings.themeId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => setThemePreset(preset.id)}
                      data-testid={`theme-preset-${preset.id}`}
                      className={`text-left p-5 rounded-2xl border transition-all ${
                        isSelected
                          ? "bg-surface-hover border-accent-primary shadow-xl shadow-accent-primary/10"
                          : "bg-surface/60 hover:bg-surface-hover border-border-subtle"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: preset.bgApp }}
                          />
                          <h4 className="font-bold text-white text-sm">{preset.name}</h4>
                        </div>
                        {isSelected && (
                          <span className="p-1 bg-accent-primary rounded-full text-white">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-theme-muted">{preset.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Accent Palette Swatches */}
            <div>
              <label className="text-sm font-semibold text-white block mb-3">Custom Accent Highlight</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {Object.entries(ACCENT_SWATCHES).map(([key, swatch]) => {
                  const isSelected = themeSettings.accentColor === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setAccentSwatch(key)}
                      data-testid={`accent-swatch-${key}`}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all ${
                        isSelected
                          ? "bg-surface-hover border-accent-primary shadow-md"
                          : "bg-surface border-border-subtle hover:border-border-subtle/80"
                      }`}
                    >
                      <div
                        className="w-5 h-5 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: swatch.primary }}
                      />
                      <span className="text-xs font-semibold text-white truncate">{swatch.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Glassmorphism Controls */}
            <div className="p-5 bg-surface rounded-2xl border border-border-subtle space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-accent-primary" /> Glassmorphic Overlays
                  </h4>
                  <p className="text-xs text-theme-muted">Enable semi-transparent frosted glass backdrop blur</p>
                </div>
                <input
                  type="checkbox"
                  checked={themeSettings.glassmorphismEnabled}
                  onChange={(e) => updateTheme({ glassmorphismEnabled: e.target.checked })}
                  data-testid="toggle-glassmorphism"
                  className="w-5 h-5 accent-accent-primary rounded cursor-pointer"
                />
              </div>

              {themeSettings.glassmorphismEnabled && (
                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                  <span className="text-xs text-slate-300 font-semibold">Blur Intensity</span>
                  <div className="flex gap-2">
                    {(["sm", "md", "lg"] as const).map((intensity) => (
                      <button
                        key={intensity}
                        onClick={() => updateTheme({ glassBlurIntensity: intensity })}
                        data-testid={`glass-blur-${intensity}`}
                        className={`px-3 py-1 text-xs font-bold rounded-lg uppercase border transition-all ${
                          themeSettings.glassBlurIntensity === intensity
                            ? "bg-accent-primary text-white border-accent-light"
                            : "bg-app text-theme-muted border-border-subtle"
                        }`}
                      >
                        {intensity}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Anti-FOUC & Theme Config Persistence Indicator */}
            <div className="p-5 bg-slate-900/60 rounded-2xl border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-cyan-400" /> Anti-FOUC Boot Script & JSON Schema
                </span>
                <span className="text-[10px] px-2 py-0.5 bg-emerald-950 text-emerald-400 font-bold border border-emerald-800 rounded">
                  Schema v2.0 Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Synchronously injected into HTML head element prior to hydration. Persisted key: <code className="text-cyan-400 bg-slate-950 px-1 py-0.5 rounded">iptv_theme_config</code>.
              </p>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* 3. PROFILES & PARENTAL TAB */}
        {/* ========================================== */}
        {activeTab === "profiles" && (
          <div data-testid="settings-profiles-tab" className="space-y-6 max-w-3xl">
            <div>
              <h3 className="text-xl font-bold text-white">Active Profile & Parental Controls</h3>
              <p className="text-xs text-slate-400">Manage parental restriction thresholds, PIN protection, rating regex normalization, and adult group locking</p>
            </div>

            {/* Active Profile Info */}
            <div className="p-5 bg-surface rounded-2xl border border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-cyan-600/20 text-cyan-400 rounded-2xl">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-base">{activeProfile.name}</h4>
                  <p className="text-xs text-slate-400">
                    {activeProfile.isMaster ? "Master Admin Profile" : activeProfile.isKids ? "Kids Profile" : "Standard Profile"}
                  </p>
                </div>
              </div>
              <span className="text-xs px-3 py-1 bg-cyan-950 border border-cyan-800 text-cyan-400 font-bold rounded-full">
                Active Profile
              </span>
            </div>

            {/* Profile Language */}
            <div className="p-5 bg-surface rounded-2xl border border-border-subtle flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-white">Profile Language</h4>
                <p className="text-xs text-theme-muted">Preferred language for movie and series metadata (posters, plots, episode titles)</p>
              </div>
              <select
                value={activeProfile.language || "en-US"}
                onChange={(e) => handleUpdateProfileLanguage(e.target.value)}
                data-testid="profile-language-select"
                className="bg-app border border-border-subtle rounded-xl px-3 py-1.5 text-xs text-theme-primary focus:outline-none focus:border-accent-primary cursor-pointer"
              >
                <option value="en-US">English (US)</option>
                <option value="es-ES">Español (ES)</option>
                <option value="fr-FR">Français (FR)</option>
                <option value="de-DE">Deutsch (DE)</option>
                <option value="it-IT">Italiano (IT)</option>
                <option value="pt-BR">Português (BR)</option>
                <option value="ar-SA">العربية (SA)</option>
              </select>
            </div>

            {/* Parental Restriction Controls */}
            <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-pink-400" /> Parental Rating Guard
                  </h4>
                  <p className="text-xs text-slate-400">Restrict access to movies or series exceeding max allowed rating</p>
                </div>
                <input
                  type="checkbox"
                  checked={activeProfile.parentalControls.enabled}
                  onChange={(e) => handleUpdateProfileParental({ enabled: e.target.checked })}
                  data-testid="toggle-parental-controls"
                  className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
                />
              </div>

              {activeProfile.parentalControls.enabled && (
                <div className="space-y-4 pt-3 border-t border-slate-800">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Max Allowed Rating</label>
                    <select
                      value={activeProfile.parentalControls.maxRatingLimit}
                      onChange={(e) =>
                        handleUpdateProfileParental({
                          maxRatingLimit: e.target.value as ContentRating,
                        })
                      }
                      data-testid="max-rating-select"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="G">G / TV-Y (Little Kids)</option>
                      <option value="PG">PG / TV-PG (Older Kids)</option>
                      <option value="PG-13">PG-13 / TV-14 (Teens)</option>
                      <option value="R">R (Restricted Adult)</option>
                      <option value="NC-17">NC-17 / TV-MA (Unrestricted Adult)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-semibold text-white">Block Unrated Media</h5>
                      <p className="text-[11px] text-slate-400">Hide channels or VOD without rating metadata (`blockUnrated` flag)</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={activeProfile.parentalControls.blockUnrated}
                      onChange={(e) => handleUpdateProfileParental({ blockUnrated: e.target.checked })}
                      className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                    />
                  </div>

                  {/* Rating Normalization Regex Badge */}
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                    <p className="font-semibold text-white">Rating Regex Normalization Engine:</p>
                    <code className="text-cyan-400 font-mono text-[10px]">
                      /(?:\[?(\d&#123;1,2&#125;\+?|UK\s*\d&#123;1,2&#125;|TV-\w+|PG-?\d*|NC-?\d*|R|G)\]?)/i
                    </code>
                    <p className="text-[10px] text-slate-500">Normalizes [18+], UK 15, TV-MA, R18 into standardized rating weights (10-100)</p>
                  </div>
                </div>
              )}
            </div>

            {/* Adult Category Lock Specification Section */}
            <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-400" /> Adult Category (`group-title`) Lock
                  </h4>
                  <p className="text-xs text-slate-400">Lock Adult / 18+ channel groups with 4-digit PIN challenge</p>
                </div>
                <input
                  type="checkbox"
                  checked={activeProfile.parentalControls.lockAdultCategories ?? true}
                  onChange={(e) => handleUpdateProfileParental({ lockAdultCategories: e.target.checked })}
                  className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
                />
              </div>

              {(activeProfile.parentalControls.lockAdultCategories ?? true) && (
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Adult Group Title Regex Pattern</label>
                    <input
                      type="text"
                      value={activeProfile.parentalControls.adultCategoryPattern ?? "xxx|adult|18\\+|erotic|porno|nsfw|pink"}
                      onChange={(e) => handleUpdateProfileParental({ adultCategoryPattern: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-cyan-400"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Matches M3U <code className="text-cyan-400">group-title</code> or category names to enforce PIN access control.
                  </p>
                </div>
              )}
            </div>

            {/* Profile List Summary */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">All Registered Family Profiles</h4>
              <div className="space-y-2">
                {profilesList.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-xs text-white">{p.name}</span>
                      {p.isMaster && <span className="text-[10px] text-cyan-400 font-bold">MASTER</span>}
                      {p.isKids && <span className="text-[10px] text-pink-400 font-bold">KIDS</span>}
                    </div>
                    <span className="text-xs text-slate-400">Max Rating: {p.parentalControls.maxRatingLimit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* 4. CONTENT FILTERING TAB */}
        {/* ========================================== */}
        {activeTab === "filters" && (
          <div data-testid="settings-filters-tab" className="space-y-6 max-w-3xl">
            <div>
              <h3 className="text-xl font-bold text-white">Content Filtering & IPTV Metadata Facets</h3>
              <p className="text-xs text-slate-400">Configure default catalog sorting, IPTV facets, and zero-copy Web Worker indexing</p>
            </div>

            <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Default Catalog Sorting</label>
                <select
                  value={defaultFilters.sortBy}
                  onChange={(e) => handleSaveFilters({ sortBy: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="default">Default Provider Order</option>
                  <option value="name_asc">Title (A to Z)</option>
                  <option value="rating_desc">Rating (High to Low)</option>
                  <option value="year_desc">Release Year (Newest)</option>
                  <option value="added_desc">Recently Added</option>
                </select>
              </div>

              {/* IPTV Metadata Facets Defaults */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-800">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Default Stream Type Facet</label>
                  <select
                    value={defaultFilters.streamType || "all"}
                    onChange={(e) => handleSaveFilters({ streamType: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
                  >
                    <option value="all">All Types (Live / VOD / Series)</option>
                    <option value="live">Live TV Channels</option>
                    <option value="movies">Movies / VOD</option>
                    <option value="series">TV Series</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Default Resolution Facet</label>
                  <select
                    value={defaultFilters.resolution || "all"}
                    onChange={(e) => handleSaveFilters({ resolution: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
                  >
                    <option value="all">All Resolutions</option>
                    <option value="4K">4K Ultra HD</option>
                    <option value="1080p">1080p Full HD</option>
                    <option value="720p">720p HD</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <div>
                  <h4 className="text-xs font-semibold text-white">Require EPG Guide Metadata (`hasEpg`)</h4>
                  <p className="text-[11px] text-slate-400">Only display live channels with active electronic program guide</p>
                </div>
                <input
                  type="checkbox"
                  checked={defaultFilters.hasEpg || false}
                  onChange={(e) => handleSaveFilters({ hasEpg: e.target.checked })}
                  className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                />
              </div>
            </div>

            {/* Zero-Copy Web Worker Indexing Tech Spec */}
            <div className="p-5 bg-slate-900/60 rounded-2xl border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" /> Web Worker Offloaded Indexing Engine
                </span>
                <span className="text-[10px] px-2 py-0.5 bg-cyan-950 text-cyan-400 font-bold border border-cyan-800 rounded">
                  &lt; 12ms @ 50,000 items
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Offloads N-Gram search &amp; bitmask filtering to <code className="text-cyan-400">filter-worker.ts</code> using zero-copy <code className="text-cyan-400">Transferable</code> ArrayBuffers via <code className="text-cyan-400">postMessage(data, [transferableBuffer])</code>.
              </p>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* 5. OFFLINE DOWNLOADS TAB */}
        {/* ========================================== */}
        {activeTab === "downloads" && (
          <div data-testid="settings-downloads-tab" className="space-y-6 max-w-4xl">
            <div>
              <h3 className="text-xl font-bold text-white">Offline Downloads & Storage Management</h3>
              <p className="text-xs text-slate-400">Monitor local disk quota, Service Worker HTTP 206 handler, active downloading tasks & completed video queue</p>
            </div>

            {/* Storage Quota Indicator Bar */}
            <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-white flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-cyan-400" /> Cache Storage Quota Allocation
                </span>
                <span className="text-slate-400">
                  {totalGbUsed} GB used / {quotaGb} GB total ({quotaPercent}%)
                </span>
              </div>
              <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
                <div
                  className="bg-cyan-500 h-full transition-all duration-500"
                  style={{ width: `${quotaPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>Cache Storage API: <code className="text-cyan-400">iptv-offline-media-v1</code></span>
                <span>IndexedDB Queue: <code className="text-cyan-400">iptv_downloads_db</code></span>
              </div>
            </div>

            {/* Offline Downloads Queue List */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-white flex items-center justify-between">
                <span>Active & Completed Download Queue ({downloadQueue.items.length})</span>
                <span className="text-xs text-cyan-400 font-normal">
                  Global Speed: {(downloadQueue.globalSpeedBps / (1024 * 1024)).toFixed(1)} MB/s
                </span>
              </h4>

              {downloadQueue.items.length === 0 ? (
                <div className="p-8 text-center bg-slate-900 rounded-2xl border border-slate-800 text-slate-500">
                  <p className="text-sm font-semibold">No offline downloads in queue</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {downloadQueue.items.map((item) => {
                    const isCompleted = item.status === "completed";
                    const isDownloading = item.status === "downloading";
                    const isPaused = item.status === "paused";
                    const speedMb = (item.downloadSpeedBps / (1024 * 1024)).toFixed(1);
                    const downloadedMb = (item.bytesDownloaded / (1024 * 1024)).toFixed(0);
                    const totalMb = (item.totalBytes / (1024 * 1024)).toFixed(0);

                    return (
                      <div
                        key={item.id}
                        data-testid={`download-item-${item.id}`}
                        className="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          {item.poster ? (
                            <img
                              src={item.poster}
                              alt={item.title}
                              className="w-12 h-16 object-cover rounded-xl shrink-0 bg-slate-950 border border-slate-800"
                            />
                          ) : (
                            <div className="w-12 h-16 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600 shrink-0">
                              <Film className="w-6 h-6" />
                            </div>
                          )}

                          <div className="min-w-0 space-y-1">
                            <h5 className="text-sm font-bold text-white truncate">{item.title}</h5>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                              <span className="uppercase px-1.5 py-0.2 bg-slate-950 border border-slate-800 text-cyan-400 rounded text-[10px] font-bold">
                                {item.containerExtension}
                              </span>
                              <span>{downloadedMb} MB / {totalMb} MB</span>
                              {item.totalSegments && (
                                <span>({item.downloadedSegments || 0}/{item.totalSegments} segments)</span>
                              )}
                            </div>

                            {/* Downloading Progress Bar */}
                            {(isDownloading || isPaused) && (
                              <div className="space-y-1 pt-1">
                                <div className="w-full md:w-64 h-1.5 bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
                                  <div
                                    className={`h-full transition-all duration-300 ${
                                      isPaused ? "bg-amber-500" : "bg-cyan-500"
                                    }`}
                                    style={{ width: `${item.progressPercent}%` }}
                                  />
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-slate-400">
                                  <span>{item.progressPercent}%</span>
                                  {isDownloading && (
                                    <>
                                      <span className="text-cyan-400 font-semibold">{speedMb} MB/s</span>
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-slate-500" /> {item.etaSeconds}s left
                                      </span>
                                    </>
                                  )}
                                  {isPaused && <span className="text-amber-400 font-semibold">Paused</span>}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Status Badge & Action Controls */}
                        <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                          {isCompleted && (
                            <span className="flex items-center gap-1 text-xs px-2.5 py-1 bg-emerald-950/80 border border-emerald-800 text-emerald-400 font-bold rounded-xl">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                            </span>
                          )}

                          {item.status === "queued" && (
                            <span className="text-xs px-2.5 py-1 bg-slate-950 border border-slate-800 text-slate-400 font-semibold rounded-xl">
                              Queued
                            </span>
                          )}

                          {(isDownloading || isPaused) && (
                            <button
                              onClick={() => handleTogglePauseDownload(item.id)}
                              className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white transition-colors"
                            >
                              {isDownloading ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteDownloadItem(item.id)}
                            className="p-2 bg-slate-950 hover:bg-red-950 border border-slate-800 hover:border-red-800 rounded-xl text-slate-400 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Offline Engine Architecture Specifications */}
            <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-white">Auto-Delete Watched Downloads</h4>
                  <p className="text-xs text-slate-400">Automatically purge cached video 24 hours after completion when watch progress &gt; 90%</p>
                </div>
                <input
                  type="checkbox"
                  checked={downloadQueue.autoDeleteWatched}
                  onChange={(e) => handleSaveDownloads({ autoDeleteWatched: e.target.checked })}
                  className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <div>
                  <h4 className="text-sm font-semibold text-white">Offline Target Quality Limit</h4>
                  <p className="text-xs text-slate-400">Maximum resolution stream target for HLS segments</p>
                </div>
                <select
                  value={downloadQueue.qualityPreference}
                  onChange={(e) => handleSaveDownloads({ qualityPreference: e.target.value as any })}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
                >
                  <option value="1080p">1080p Full HD</option>
                  <option value="720p">720p HD</option>
                  <option value="480p">480p SD</option>
                </select>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <p className="font-semibold text-white">Service Worker HTTP 206 &amp; HLS.js Loader Spec:</p>
                <p className="text-[10px] text-slate-400">
                  Service Worker intercepts <code className="text-cyan-400">/offline-stream/*</code> and parses HTTP <code className="text-cyan-400">Range: bytes=start-end</code>, slicing cached Blob chunks for HTML5 video seeking. HLS.js loader plugin <code className="text-cyan-400">OfflineHlsLoader</code> intercepts segment requests to serve from Cache Storage without re-downloading.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
