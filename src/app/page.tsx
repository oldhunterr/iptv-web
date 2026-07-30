"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { AppSection, Category, CatalogItem, Series, Episode, normalizeCatalogItem } from "@/types/iptv";
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
import { CategorySidebar } from "@/components/catalog/CategorySidebar";
import { SearchFilterHeader } from "@/components/catalog/SearchFilterHeader";
import { VirtualizedGrid } from "@/components/catalog/VirtualizedGrid";
import { SeriesDetailsModal } from "@/components/series/SeriesDetailsModal";
import { MovieDetailsModal } from "@/components/movies/MovieDetailsModal";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { Play, Trash2, Loader2, Sparkles } from "lucide-react";

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

  // Load Data based on active section
  const loadSectionData = useCallback(async (force = false) => {
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
    if (activeSection === "favorites" || activeSection === "history") {
      setIsLoading(false);
      return;
    }

    // Client-side caching: Prevent redundant network fetches when switching tabs
    // The data is retained in state, so we only fetch if the array is empty.
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
    if (selectedCategory === "ALL") return "All Categories";
    const found = currentCategories.find((c) => String(c.category_id) === selectedCategory);
    return found ? found.category_name : "Category Items";
  }, [selectedCategory, currentCategories]);

  // Filter items by category & search query
  const filteredCatalogItems = useMemo(() => {
    let source: CatalogItem[] = [];
    if (activeSection === "live") source = liveStreams;
    else if (activeSection === "movies") source = vodStreams;
    else if (activeSection === "series") source = seriesList;
    else if (activeSection === "favorites") source = favoritesList;
    else if (activeSection === "history") return [];

    let result = source;

    if (selectedCategory !== "ALL" && activeSection !== "favorites") {
      result = result.filter((item) => String(item.category_id) === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((item) => (item.title || item.name || "").toLowerCase().includes(q));
    }

    return result;
  }, [activeSection, liveStreams, vodStreams, seriesList, favoritesList, selectedCategory, searchQuery]);

  // Media Selection Handler
  const handleSelectItem = (item: CatalogItem) => {
    if (item.type === "series") {
      setSelectedSeries((item.raw as Series) || { ...item, name: item.name || item.title || "Series", series_id: item.series_id || item.id, category_id: item.category_id });
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
    const url = getStreamUrl("movie", sId, ext);
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

  // Play Episode from Series Details Modal
  const handlePlayEpisode = (series: Series, seasonNum: number, episode: Episode) => {
    const ext = episode.container_extension || "mp4";
    const url = getStreamUrl("series", episode.id, ext);
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

  // Play from History Item
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

  return (
    <div
      data-testid="app-dashboard"
      className="flex h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden"
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
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-950">
        <SearchFilterHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          categoryName={currentCategoryName}
          itemCount={filteredCatalogItems.length || (activeSection === "history" ? historyItems.length : 0)}
          onSyncData={() => loadSectionData(true)}
          isLoading={isLoading}
        />

        {/* Content Body */}
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
            <p className="text-sm font-semibold">Loading IPTV Catalog...</p>
          </div>
        ) : activeSection === "history" ? (
          /* Watch History Tab */
          <div className="flex-1 overflow-y-auto p-6" data-testid="history-tab">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Watch History</h2>
                <p className="text-xs text-slate-400">Continue watching your favorite media</p>
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
                      className="flex bg-slate-900 rounded-xl border border-slate-800 overflow-hidden hover:border-cyan-500/40 transition-all group"
                    >
                      <div className="relative w-28 aspect-[2/3] shrink-0 bg-slate-950">
                        {h.poster && (
                          <img src={h.poster} alt={h.title} className="w-full h-full object-cover" />
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handlePlayHistoryItem(h)}
                            className="p-2 bg-cyan-600 rounded-full text-white shadow-lg"
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
                              maskImage: 'linear-gradient(to right, transparent, black 30%, black 100%)',
                              WebkitMaskImage: 'linear-gradient(to right, transparent, black 30%, black 100%)'
                            }}
                          />
                        )}
                        <div className="relative z-10">
                          <h4 className="text-sm font-semibold text-white truncate">{h.title}</h4>
                          <p className="text-xs text-cyan-400 mt-0.5">{percent}% watched</p>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/60 relative z-10">
                          <button
                            onClick={() => handlePlayHistoryItem(h)}
                            className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
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
          <VirtualizedGrid items={filteredCatalogItems} onSelectItem={handleSelectItem} />
        )}
      </main>

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
