"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { AppSection, Category, CatalogItem, Series, Episode, normalizeCatalogItem } from "@/types/iptv";
import { UserProfile, ContentFilterOptions, isRatingAllowed, DownloadQueueState, IDBDownloadItem } from "@/types/settings";
import {
  fetchLiveCategories,
  fetchLiveStreams,
  fetchVodCategories,
  fetchVodStreams,
  fetchSeriesCategories,
  fetchSeries,
  getStreamUrl,
} from "@/lib/api-client";
import {
  getFavorites,
  getWatchHistory,
  subscribeStorage,
  removeFromHistory,
  clearWatchHistory,
} from "@/lib/storage";
import {
  getActiveProfile,
  subscribeProfileStorage,
  getDefaultFilterOptions,
  getDownloadQueueState,
} from "@/lib/profile-storage";

import { CategorySidebar } from "@/components/catalog/CategorySidebar";
import { SearchFilterHeader } from "@/components/catalog/SearchFilterHeader";
import { VirtualizedGrid } from "@/components/catalog/VirtualizedGrid";
import { SeriesDetailsModal } from "@/components/series/SeriesDetailsModal";
import { MovieDetailsModal } from "@/components/movies/MovieDetailsModal";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { ProfileSelectorModal } from "@/components/profiles/ProfileSelectorModal";
import { AdvancedFilterBar } from "@/components/filters/AdvancedFilterBar";
import { QuickFilterPills } from "@/components/filters/QuickFilterPills";

import { Play, Trash2, Loader2 } from "lucide-react";

interface PlayingMediaState {
  src: string;
  title: string;
  itemKey: string;
  streamId: string | number;
  section: "live" | "movies" | "series";
  poster?: string;
  backdrop?: string;
  containerExtension?: string;
  tvdbId?: string | number;
  tmdbId?: string | number;
  seasonNum?: number;
  episodeNum?: number;
  seriesId?: string | number;
}

export default function Home() {
  const [activeSection, setActiveSection] = useState<AppSection>("live");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // User Profile & Modal state
  const [activeProfile, setActiveProfile] = useState<UserProfile>(getActiveProfile());
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  // Filter Drawer & Filter Options State
  const [isFilterBarOpen, setIsFilterBarOpen] = useState<boolean>(false);
  const [filterOptions, setFilterOptions] = useState<ContentFilterOptions>(getDefaultFilterOptions());

  // Raw fetched datasets
  const [liveCategories, setLiveCategories] = useState<Category[]>([]);
  const [liveStreams, setLiveStreams] = useState<CatalogItem[]>([]);
  const [vodCategories, setVodCategories] = useState<Category[]>([]);
  const [vodStreams, setVodStreams] = useState<CatalogItem[]>([]);
  const [seriesCategories, setSeriesCategories] = useState<Category[]>([]);
  const [seriesList, setSeriesList] = useState<CatalogItem[]>([]);

  // State-managed items
  const [favoritesList, setFavoritesList] = useState<CatalogItem[]>([]);
  const [historyItems, setHistoryItems] = useState<any[]>([]);

  // Modals state
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<CatalogItem | null>(null);
  const [playingMedia, setPlayingMedia] = useState<PlayingMediaState | null>(null);

  // Sync Profile Storage
  const refreshProfileState = useCallback(() => {
    setActiveProfile(getActiveProfile());
  }, []);

  useEffect(() => {
    refreshProfileState();
    const unsubscribe = subscribeProfileStorage(refreshProfileState);
    return () => unsubscribe();
  }, [refreshProfileState]);

  // Sync Storage (Favorites / History)
  const refreshStorageData = useCallback(() => {
    const favs = getFavorites();
    setFavoritesList(favs.map((f) => f.item));
    const hist = getWatchHistory();
    setHistoryItems(hist);
  }, []);

  useEffect(() => {
    refreshStorageData();
    const unsubscribe = subscribeStorage(refreshStorageData);
    return () => unsubscribe();
  }, [refreshStorageData]);

  // Sync Download Queue State via SSE / API
  const [downloadQueue, setDownloadQueue] = useState<DownloadQueueState>(getDownloadQueueState());

  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource("/api/download?events=true");
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (Array.isArray(data.tasks)) {
            const serverItems = data.tasks.map((st: any) => ({
              id: st.id,
              streamId: st.streamId,
              section: st.type === "series" ? "series" : "movies",
              title: st.title,
              poster: st.poster,
              containerExtension: st.containerExtension || "mp4",
              status: st.status,
              bytesDownloaded: st.bytesDownloaded,
              totalBytes: st.totalBytes,
              progressPercent: st.progressPercent,
              downloadSpeedBps: st.downloadSpeedBps,
              etaSeconds: st.etaSeconds,
              downloadedAt: st.downloadedAt,
              expiresAt: st.downloadedAt + 86400000 * 30,
              xtreamCredentialsHash: "server",
              retryCount: 0,
            }));

            setDownloadQueue((prev) => ({
              ...prev,
              items: serverItems,
            }));
          }
        } catch {}
      };
    } catch {}

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  // Load Data based on active section
  const loadSectionData = useCallback(async (force = false) => {
    if (activeSection === "settings") {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      if (activeSection === "live") {
        const [cats, streams] = await Promise.all([
          fetchLiveCategories(force),
          fetchLiveStreams(force),
        ]);
        setLiveCategories(cats);
        setLiveStreams(streams.map((s) => normalizeCatalogItem(s, "live")));
      } else if (activeSection === "movies") {
        const [cats, movies] = await Promise.all([
          fetchVodCategories(force),
          fetchVodStreams(force),
        ]);
        setVodCategories(cats);
        setVodStreams(movies.map((m) => normalizeCatalogItem(m, "movies")));
      } else if (activeSection === "series") {
        const [cats, srs] = await Promise.all([
          fetchSeriesCategories(force),
          fetchSeries(force),
        ]);
        setSeriesCategories(cats);
        setSeriesList(srs.map((s) => normalizeCatalogItem(s, "series")));
      }
    } catch (err) {
      console.error("Failed to load IPTV section data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [activeSection]);

  useEffect(() => {
    if (activeSection === "favorites" || activeSection === "history" || activeSection === "settings") {
      setIsLoading(false);
      return;
    }

    if (activeSection === "live" && liveStreams.length > 0) return;
    if (activeSection === "movies" && vodStreams.length > 0) return;
    if (activeSection === "series" && seriesList.length > 0) return;

    loadSectionData();
  }, [activeSection, loadSectionData, liveStreams.length, vodStreams.length, seriesList.length]);

  // Current active categories array
  const currentCategories = useMemo(() => {
    if (activeSection === "live") return liveCategories;
    if (activeSection === "movies") return vodCategories;
    if (activeSection === "series") return seriesCategories;
    return [];
  }, [activeSection, liveCategories, vodCategories, seriesCategories]);

  // Selected Category Name
  const currentCategoryName = useMemo(() => {
    if (activeSection === "settings") return "Application Settings";
    if (selectedCategory === "ALL") return "All Categories";
    const found = currentCategories.find((c) => String(c.category_id) === selectedCategory);
    return found ? found.category_name : "Category Items";
  }, [selectedCategory, currentCategories, activeSection]);

  // Combined Filter Logic (Parental Guard, Category, Search, Genre, Year, Rating, Watched Status, Sort)
  const filteredCatalogItems = useMemo(() => {
    let source: CatalogItem[] = [];
    if (activeSection === "live") source = liveStreams;
    else if (activeSection === "movies") source = vodStreams;
    else if (activeSection === "series") source = seriesList;
    else if (activeSection === "favorites") source = favoritesList;
    else if (activeSection === "history" || activeSection === "settings") return [];

    let result = source;

    // 1. Parental Control Rating Guard & Adult Category Lock
    if (activeProfile && activeProfile.parentalControls && activeProfile.parentalControls.enabled) {
      result = result.filter((item) =>
        isRatingAllowed(
          item.rating,
          activeProfile.parentalControls.maxRatingLimit,
          activeProfile.parentalControls.blockUnrated
        )
      );

      // Adult Category Lock (`group-title`)
      if (activeProfile.isKids || activeProfile.parentalControls.lockAdultCategories) {
        const pattern = new RegExp(activeProfile.parentalControls.adultCategoryPattern || "xxx|adult|18\\+|erotic|porno|nsfw|pink", "i");
        result = result.filter((item) => {
          const categoryName = item.category_name || item.group_title || "";
          const titleName = item.title || item.name || "";
          return !pattern.test(categoryName) && !pattern.test(titleName);
        });
      }
    }

    // 2. Selected Category Filter
    if (selectedCategory !== "ALL" && activeSection !== "favorites") {
      result = result.filter((item) => String(item.category_id) === selectedCategory);
    }

    // 3. Search Query Match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((item) => (item.title || item.name || "").toLowerCase().includes(q));
    }

    // 4. Genre Filter
    if (filterOptions.selectedGenres.length > 0) {
      result = result.filter((item) => {
        const itemGenre = (item.genre || "").toLowerCase();
        return filterOptions.selectedGenres.some((g) => itemGenre.includes(g.toLowerCase()));
      });
    }

    // 5. Min Rating Threshold
    if (filterOptions.minRating > 0) {
      result = result.filter((item) => {
        const rVal = parseFloat(String(item.rating || 0)) || 0;
        return rVal >= filterOptions.minRating;
      });
    }

    // 6. Release Year Range Filter
    if (filterOptions.yearRange[0] > 1980 || filterOptions.yearRange[1] < 2026) {
      result = result.filter((item) => {
        const dateStr = item.releaseDate || item.release_date || item.added || "";
        const match = dateStr.match(/\b(19\d\d|20\d\d)\b/);
        if (!match) return true;
        const y = parseInt(match[1]);
        return y >= filterOptions.yearRange[0] && y <= filterOptions.yearRange[1];
      });
    }

    // 7. Stream Type Facet
    if (filterOptions.streamType && filterOptions.streamType !== "all") {
      result = result.filter((item) => item.type === filterOptions.streamType);
    }

    // 8. Stream Resolution Facet (4K, 1080p, 720p)
    if (filterOptions.resolution && filterOptions.resolution !== "all") {
      const targetRes = filterOptions.resolution.toLowerCase();
      result = result.filter((item) => {
        const titleStr = (item.title || item.name || "").toLowerCase();
        if (targetRes === "4k") return titleStr.includes("4k") || titleStr.includes("uhd") || titleStr.includes("2160");
        if (targetRes === "1080p") return titleStr.includes("1080") || titleStr.includes("fhd") || titleStr.includes("full hd");
        if (targetRes === "720p") return titleStr.includes("720") || titleStr.includes("hd");
        return true;
      });
    }

    // 9. EPG Guide Facet
    if (filterOptions.hasEpg) {
      result = result.filter((item) => item.type === "live" && Boolean(item.epg_channel_id || item.tvg_id || (item as any).hasEpg));
    }

    // 9b. Audio & Translation Tag Facet
    if (filterOptions.audioLanguage && filterOptions.audioLanguage !== "all") {
      const targetLang = filterOptions.audioLanguage.toLowerCase();
      result = result.filter((item) => {
        const titleStr = (item.title || item.name || "").toLowerCase();
        const catStr = (item.category_name || item.group_title || "").toLowerCase();

        if (targetLang === "dubbed") {
          return titleStr.includes("مدبلج") || catStr.includes("مدبلج") || titleStr.includes("dubbed");
        }
        if (targetLang === "subtitled") {
          return titleStr.includes("مترجم") || catStr.includes("مترجم") || titleStr.includes("subbed") || titleStr.includes("subtitled");
        }
        if (targetLang === "arabic") {
          return /[\u0600-\u06FF]/.test(titleStr) || catStr.includes("arabic") || catStr.includes("عربي") || catStr.includes("عربى");
        }
        if (targetLang === "english") {
          return catStr.includes("english") || catStr.includes("en") || catStr.includes("us") || catStr.includes("uk");
        }
        return true;
      });
    }

    // 10. Watched Status Filter
    if (filterOptions.watchedStatus !== "all") {
      result = result.filter((item) => {
        const hItem = historyItems.find(
          (h) => String(h.streamId || h.id) === String(item.id || item.stream_id)
        );
        if (filterOptions.watchedStatus === "unwatched") return !hItem;
        if (filterOptions.watchedStatus === "watched")
          return hItem && hItem.duration > 0 && hItem.lastPosition / hItem.duration >= 0.9;
        if (filterOptions.watchedStatus === "in-progress")
          return hItem && hItem.duration > 0 && hItem.lastPosition / hItem.duration < 0.9;
        return true;
      });
    }

    // 8. Sorting Logic
    if (filterOptions.sortBy !== "default") {
      result = [...result].sort((a, b) => {
        if (filterOptions.sortBy === "name_asc") {
          return (a.title || a.name || "").localeCompare(b.title || b.name || "");
        }
        if (filterOptions.sortBy === "name_desc") {
          return (b.title || b.name || "").localeCompare(a.title || a.name || "");
        }
        if (filterOptions.sortBy === "rating_desc") {
          const rA = parseFloat(String(a.rating || 0)) || 0;
          const rB = parseFloat(String(b.rating || 0)) || 0;
          return rB - rA;
        }
        if (filterOptions.sortBy === "year_desc") {
          const yA = parseInt((a.releaseDate || a.release_date || "").match(/\b(19\d\d|20\d\d)\b/)?.[1] || "0");
          const yB = parseInt((b.releaseDate || b.release_date || "").match(/\b(19\d\d|20\d\d)\b/)?.[1] || "0");
          return yB - yA;
        }
        if (filterOptions.sortBy === "added_desc") {
          return (b.added || "").localeCompare(a.added || "");
        }
        return 0;
      });
    }

    return result;
  }, [
    activeSection,
    liveStreams,
    vodStreams,
    seriesList,
    favoritesList,
    historyItems,
    selectedCategory,
    searchQuery,
    activeProfile,
    filterOptions,
  ]);

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

  // Media Selection Handlers
  const handleSelectItem = (item: CatalogItem) => {
    if (item.type === "series") {
      setSelectedSeries(
        (item.raw as Series) || {
          ...item,
          name: item.name || item.title || "Series",
          series_id: item.series_id || item.id,
          category_id: item.category_id,
        }
      );
    } else if (item.type === "live") {
      const sId = item.stream_id ?? item.id;
      const url = getStreamUrl("live", sId, "ts");
      setPlayingMedia({
        src: url,
        title: item.name || item.title || "Live Stream",
        itemKey: `live_${sId}`,
        streamId: sId,
        section: "live",
        poster: item.stream_icon || item.poster,
        containerExtension: "ts",
      });
    } else if (item.type === "movies" || item.type === "vod") {
      setSelectedMovie(item);
    }
  };

  const handlePlayMovie = (item: CatalogItem) => {
    const sId = item.stream_id ?? item.id;
    const ext = item.container_extension || "mp4";

    const completedTask = downloadQueue.items.find(
      (it) => String(it.streamId) === String(sId) && it.status === "completed"
    );

    const url = completedTask
      ? `/api/download?file=true&id=${completedTask.id}`
      : getStreamUrl("movie", sId, ext);

    setPlayingMedia({
      src: url,
      title: item.name || item.title || "Movie",
      itemKey: `movies_${sId}`,
      streamId: sId,
      section: "movies",
      poster: item.stream_icon || item.poster,
      containerExtension: ext,
      tmdbId: item.tmdb_id || item.info?.tmdb_id,
    });
    setSelectedMovie(null);
  };

  const handlePlayEpisode = (series: Series, seasonNum: number, episode: Episode) => {
    const ext = episode.container_extension || "mp4";
    
    const completedTask = downloadQueue.items.find(
      (it) => String(it.streamId) === String(episode.id) && it.status === "completed"
    );

    const url = completedTask
      ? `/api/download?file=true&id=${completedTask.id}`
      : getStreamUrl("series", episode.id, ext);

    const itemKey = `series_${series.series_id}_s${seasonNum}e${episode.episode_num}_${episode.id}`;

    setPlayingMedia({
      src: url,
      title: `${series.name} — S${seasonNum < 10 ? "0" : ""}${seasonNum}E${
        episode.episode_num < 10 ? "0" : ""
      }${episode.episode_num} · ${episode.title || "Episode"}`,
      itemKey,
      streamId: episode.id,
      section: "series",
      poster: series.cover || (series as any).cover_big,
      backdrop: episode.info?.movie_image || episode.info?.cover_big || (episode as any).cover_big,
      containerExtension: ext,
      tvdbId: (series as any).tvdb_id || (episode.info as any)?.tvdb_id,
      tmdbId: (series as any).tmdb_id || (episode.info as any)?.tmdb_id,
      seasonNum,
      episodeNum: episode.episode_num,
      seriesId: series.series_id,
    });

    setSelectedSeries(null);
  };

  const handlePlayHistoryItem = (hItem: any) => {
    setPlayingMedia({
      src: hItem.streamUrl || getStreamUrl(hItem.section, hItem.streamId || hItem.id, hItem.containerExtension || "mp4"),
      title: hItem.title,
      itemKey: hItem.key,
      streamId: hItem.streamId || hItem.id,
      section: hItem.section,
      poster: hItem.poster,
      backdrop: hItem.backdrop,
      containerExtension: hItem.containerExtension || "mp4",
      tvdbId: hItem.tvdbId,
      seasonNum: hItem.seasonNum,
      episodeNum: hItem.episodeNum,
      seriesId: hItem.seriesId,
    });
  };

  const downloadedStreamIds = useMemo(() => {
    const ids = new Set<string | number>();
    downloadQueue.items.forEach((item) => {
      if (item.status === "completed" && item.streamId) {
        ids.add(String(item.streamId));
      }
    });
    return ids;
  }, [downloadQueue.items]);

  return (
    <div
      data-testid="app-dashboard"
      className="flex h-screen w-screen bg-[var(--bg-app,#0f172a)] text-[var(--text-primary,#f8fafc)] font-sans overflow-hidden transition-colors"
    >
      {/* Sidebar Navigation */}
      <CategorySidebar
        activeSection={activeSection}
        onSelectSection={(sec) => {
          setActiveSection(sec);
          setSelectedCategory("ALL");
          setSearchQuery("");
        }}
        categories={currentCategories}
        selectedCategoryId={selectedCategory}
        onSelectCategory={setSelectedCategory}
        liveCount={liveStreams.length}
        moviesCount={vodStreams.length}
        seriesCount={seriesList.length}
        favoritesCount={favoritesList.length}
        historyCount={historyItems.length}
        activeProfile={activeProfile}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[var(--bg-app,#0f172a)]">
        {activeSection !== "settings" && (
          <SearchFilterHeader
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            categoryName={currentCategoryName}
            itemCount={filteredCatalogItems.length || (activeSection === "history" ? historyItems.length : 0)}
            onSyncData={() => loadSectionData(true)}
            isLoading={isLoading}
            onToggleFilterBar={() => setIsFilterBarOpen((prev) => !prev)}
            isFilterOpen={isFilterBarOpen}
            activeFilterCount={activeFilterCount}
            onOpenSettings={() => setActiveSection("settings")}
            onOpenProfiles={() => setIsProfileModalOpen(true)}
            activeProfile={activeProfile}
          />
        )}

        {/* Advanced Filter Slide-out Drawer */}
        {activeSection !== "settings" && activeSection !== "history" && (
          <AdvancedFilterBar
            filterOptions={filterOptions}
            onChange={(updated) => setFilterOptions((prev) => ({ ...prev, ...updated }))}
            isOpen={isFilterBarOpen}
            onClose={() => setIsFilterBarOpen(false)}
            totalFilteredCount={filteredCatalogItems.length}
          />
        )}

        {/* Quick Filter Pills Bar */}
        {activeSection !== "settings" && activeSection !== "history" && (
          <QuickFilterPills
            filterOptions={filterOptions}
            onChange={(updated) => setFilterOptions((prev) => ({ ...prev, ...updated }))}
          />
        )}

        {/* Content Body Switcher */}
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
            <p className="text-sm font-semibold">Loading IPTV Catalog...</p>
          </div>
        ) : activeSection === "settings" ? (
          /* Settings Shell View */
          <SettingsShell onClose={() => setActiveSection("live")} />
        ) : activeSection === "history" ? (
          /* Watch History Tab */
          <div className="flex-1 overflow-y-auto p-6" data-testid="history-tab">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Watch History</h2>
                <p className="text-xs text-slate-400">
                  Continue watching for profile <span className="text-cyan-400 font-semibold">{activeProfile.name}</span>
                </p>
              </div>
              {historyItems.length > 0 && (
                <button
                  onClick={clearWatchHistory}
                  data-testid="clear-history-button"
                  className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 text-xs font-semibold rounded-xl transition-colors"
                >
                  Clear All History
                </button>
              )}
            </div>

            {historyItems.length === 0 ? (
              <div className="py-20 text-center text-slate-500">
                <p className="text-base font-semibold">No Watch History Found</p>
                <p className="text-xs text-slate-600 mt-1">Start watching live streams, movies, or series to see progress here</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {historyItems.map((h) => {
                  const percent =
                    h.duration > 0 ? Math.min(100, Math.floor((h.lastPosition / h.duration) * 100)) : 0;
                  return (
                    <div
                      key={h.key}
                      data-testid={`history-card-${h.key}`}
                      className="flex bg-surface rounded-xl border border-border-subtle overflow-hidden hover:border-accent-primary/40 transition-all group"
                    >
                      <div className="relative w-28 aspect-[2/3] shrink-0 bg-app">
                        {h.poster && (
                          <img src={h.poster} alt={h.title} className="w-full h-full object-cover" />
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handlePlayHistoryItem(h)}
                            className="p-2 bg-accent-primary rounded-full text-white shadow-lg"
                          >
                            <Play className="w-4 h-4 fill-current translate-x-0.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 p-3 flex flex-col justify-between min-w-0 relative">
                        {h.backdrop && (
                          <div
                            className="absolute inset-0 bg-cover bg-center opacity-30 pointer-events-none"
                            style={{
                              backgroundImage: `url(${h.backdrop})`,
                              maskImage: "linear-gradient(to right, transparent, black 30%, black 100%)",
                              WebkitMaskImage: "linear-gradient(to right, transparent, black 30%, black 100%)",
                            }}
                          />
                        )}
                        <div className="relative z-10">
                          <h4 className="text-sm font-semibold text-white truncate">{h.title}</h4>
                          <p className="text-xs text-accent-primary mt-0.5">{percent}% watched</p>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-subtle/60 relative z-10">
                          <button
                            onClick={() => handlePlayHistoryItem(h)}
                            className="flex items-center gap-1 text-xs text-accent-primary hover:text-accent-hover font-semibold"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" /> Resume
                          </button>
                          <button
                            onClick={() => removeFromHistory(h.key)}
                            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Catalog Virtualized Grid */
          <VirtualizedGrid
            items={filteredCatalogItems}
            downloadedStreamIds={downloadedStreamIds}
            onSelectItem={handleSelectItem}
          />
        )}
      </main>

      {/* Profile Selector Modal */}
      <ProfileSelectorModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onProfileSwitched={(p) => setActiveProfile(p)}
      />

      {/* Series Details Modal */}
      <SeriesDetailsModal
        series={selectedSeries}
        isOpen={!!selectedSeries}
        onClose={() => setSelectedSeries(null)}
        onPlayEpisode={handlePlayEpisode}
      />

      {/* Movie Details Modal */}
      <MovieDetailsModal
        movie={selectedMovie}
        isDownloaded={Boolean(
          selectedMovie &&
            downloadedStreamIds.has(String(selectedMovie.stream_id ?? selectedMovie.id))
        )}
        isOpen={!!selectedMovie}
        onClose={() => setSelectedMovie(null)}
        onPlay={handlePlayMovie}
      />

      {/* Video Player Modal / View */}
      {playingMedia && (
        <div
          data-testid="player-modal-view"
          className="fixed inset-0 z-50 bg-black flex items-center justify-center animate-fade-in"
        >
          <VideoPlayer
            src={playingMedia.src}
            title={playingMedia.title}
            itemKey={playingMedia.itemKey}
            streamId={playingMedia.streamId}
            section={playingMedia.section}
            poster={playingMedia.poster}
            backdrop={playingMedia.backdrop}
            containerExtension={playingMedia.containerExtension}
            tvdbId={playingMedia.tvdbId}
            tmdbId={playingMedia.tmdbId}
            seasonNum={playingMedia.seasonNum}
            episodeNum={playingMedia.episodeNum}
            seriesId={playingMedia.seriesId}
            onClose={() => setPlayingMedia(null)}
          />
        </div>
      )}
    </div>
  );
}
