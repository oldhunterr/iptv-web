"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { X, Star, Volume2, VolumeX, Heart, Loader2 } from "lucide-react";
import { Series, SeriesInfo, Episode, normalizeCatalogItem } from "@/types/iptv";
import { fetchSeriesInfo, getThemeAudioUrl } from "@/lib/api-client";
import { isFavorite, toggleFavorite } from "@/lib/storage";
import { cleanTitle } from "@/lib/formatters";
import { EpisodeList } from "./EpisodeList";
import { getActiveProfile, getGeneralSettings } from "@/lib/profile-storage";

interface SeriesDetailsModalProps {
  series: Series | null;
  isOpen: boolean;
  onClose: () => void;
  onPlayEpisode: (series: Series, seasonNum: number, episode: Episode) => void;
}

export const SeriesDetailsModal: React.FC<SeriesDetailsModalProps> = ({
  series,
  isOpen,
  onClose,
  onPlayEpisode,
}) => {
  const [seriesInfo, setSeriesInfo] = useState<SeriesInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [isPlayingTheme, setIsPlayingTheme] = useState(false);
  const [themeBlocked, setThemeBlocked] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [tmdbId, setTmdbId] = useState<number | string | null>(null);
  const [tvdbId, setTvdbId] = useState<number | string | null>(null);
  const [tmdbSeasonsMap, setTmdbSeasonsMap] = useState<Record<number, any[]>>({});
  const [heroBackdrop, setHeroBackdrop] = useState<string | null>(null);
  const [tmdbCredits, setTmdbCredits] = useState<any>(null);
  const [showAllCast, setShowAllCast] = useState(false);
  const [tmdbPoster, setTmdbPoster] = useState<string | null>(null);
  const [imdbId, setImdbId] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fetchedSeasonsRef = useRef<Set<number>>(new Set());

  // Sync favorite state
  useEffect(() => {
    if (series) {
      setIsFav(isFavorite("series", series.series_id));
    }
  }, [series]);

  // Reset state when modal closes or series changes
  useEffect(() => {
    if (!isOpen || !series) {
      setSeriesInfo(null);
      setIsPlayingTheme(false);
      setThemeBlocked(false);
      setTmdbId(null);
      setTvdbId(null);
      setTmdbSeasonsMap({});
      setHeroBackdrop(null);
      setTmdbPoster(null);
      setTmdbCredits(null);
      setImdbId(null);
      setShowAllCast(false);
      fetchedSeasonsRef.current.clear();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      return;
    }

    setLoading(true);
    let isMounted = true;

    fetchSeriesInfo(series.series_id)
      .then((info) => {
        if (!isMounted) return;
        setSeriesInfo(info);
        setLoading(false);

        // Extract available season numbers including 0 (Specials)
        const seasonNums: number[] = [];
        if (info.seasons && info.seasons.length > 0) {
          info.seasons.forEach((s) => {
            if (typeof s.season_number === "number") seasonNums.push(s.season_number);
          });
        }
        if (info.episodes) {
          Object.keys(info.episodes).forEach((k) => {
            const num = Number(k);
            if (!isNaN(num)) seasonNums.push(num);
          });
        }

        const uniqueNums = Array.from(new Set(seasonNums)).sort((a, b) => a - b);
        if (uniqueNums.length > 0) {
          const defaultSeason = uniqueNums.includes(1) ? 1 : uniqueNums[0];
          setSelectedSeason(defaultSeason);
        } else {
          setSelectedSeason(1);
        }

        // Check if IDs are directly available on series or info
        const existingTmdb = (series as any).tmdb_id || (info.info as any)?.tmdb_id;
        const existingTvdb = (series as any).tvdb_id || (info.info as any)?.tvdb_id;

        if (existingTmdb) setTmdbId(existingTmdb);
        if (existingTvdb) setTvdbId(existingTvdb);
      })
      .catch((err) => {
        console.error("Failed to fetch series info:", err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [isOpen, series]);

  // Fetch TMDB Show ID and Backdrop if tmdbId is not set
  useEffect(() => {
    if (!isOpen || !series || tmdbId) return;

    let isMounted = true;
    const profile = getActiveProfile();
    const general = getGeneralSettings();
    const userLang = profile.language || general.language || "en-US";

    const { title, year } = cleanTitle(series.name);

    // Always search in English for best match accuracy, especially for Arabic-only titles
    const searchLang = /[a-zA-Z]/.test(title) ? userLang : "en-US";
    
    // If the cleaned title is still Arabic-only, try searching with the raw name in English
    // TMDB has better matching for Arabic text when querying with language=en-US
    let searchQuery = title;
    if (!/[a-zA-Z]/.test(searchQuery)) {
      // Arabic-only title: use raw name directly (TMDB can handle Arabic queries)
      searchQuery = series.name
        .replace(/(مترجم|المترجم|مدبلج|المدبلج)/g, "")
        .replace(/[\(\[].*?[\)\]]/g, "")
        .trim();
    }

    let searchUrl = `/api/proxy/tmdb?type=search_tv&query=${encodeURIComponent(searchQuery)}&language=${searchLang}`;
    if (year) searchUrl += `&year=${year}`;

    fetch(searchUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data) return;
        const results = data.results || [];
        if (results.length === 0) return;
        
        // For Arabic-only queries, try to find a better match by checking original name similarity
        const match = results.find((r: any) => r.media_type === "tv") || results[0];
        if (match && match.id) {
          setTmdbId(match.id);
        }
      })
      .catch((err) => console.warn("TMDB search failed:", err));

    return () => {
      isMounted = false;
    };
  }, [isOpen, series, tmdbId]);

  // Fetch TMDB Show Details (external_ids & backdrop) once tmdbId is known
  useEffect(() => {
    if (!isOpen || !tmdbId) return;

    let isMounted = true;
    const profile = getActiveProfile();
    const general = getGeneralSettings();
    const userLang = profile.language || general.language || "en-US";

    fetch(`/api/proxy/tmdb?type=tv&id=${tmdbId}&language=${userLang}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data) return;

        const needsFallback = userLang !== "en-US" && (!data.overview || data.overview.trim() === "" || !data.poster_path);

        const applyData = (mainData: any, fallbackData?: any) => {
          if (mainData.external_ids?.tvdb_id && !tvdbId) {
            setTvdbId(mainData.external_ids.tvdb_id);
          } else if (fallbackData?.external_ids?.tvdb_id && !tvdbId) {
            setTvdbId(fallbackData.external_ids.tvdb_id);
          }

          const imdb = mainData.imdb_id || fallbackData?.imdb_id || mainData.external_ids?.imdb_id || fallbackData?.external_ids?.imdb_id;
          if (imdb) setImdbId(imdb);

          const backdrop = mainData.backdrop_path || fallbackData?.backdrop_path;
          const poster = mainData.poster_path || fallbackData?.poster_path;
          const credits = mainData.credits || fallbackData?.credits;

          if (backdrop) {
            const bgUrl = backdrop.startsWith("http")
              ? backdrop
              : `https://image.tmdb.org/t/p/original${backdrop}`;
            setHeroBackdrop(bgUrl);
          }
          
          if (poster) {
            const posterUrl = poster.startsWith("http")
              ? poster
              : `https://image.tmdb.org/t/p/w500${poster}`;
            setTmdbPoster(posterUrl);
          }

          if (credits) {
            setTmdbCredits(credits);
          }
        };

        if (needsFallback) {
          fetch(`/api/proxy/tmdb?type=tv&id=${tmdbId}&language=en-US`)
            .then((enRes) => (enRes.ok ? enRes.json() : null))
            .then((enData) => {
              if (!isMounted) return;
              applyData(data, enData);
            })
            .catch(() => {
              if (!isMounted) return;
              applyData(data);
            });
        } else {
          applyData(data);
        }
      })
      .catch((err) => console.warn("TMDB show details fetch failed:", err));

    return () => {
      isMounted = false;
    };
  }, [isOpen, tmdbId, tvdbId]);

  // Pre-fetch all seasons' episode metadata in parallel once tmdbId and seriesInfo are loaded
  useEffect(() => {
    if (!isOpen || !tmdbId || !seriesInfo) return;

    // Compute seasons list
    const seasons: number[] = Array.from(
      new Set<number>([
        ...(seriesInfo.seasons
          ? seriesInfo.seasons
              .map((s) => s.season_number)
              .filter((n): n is number => typeof n === "number" && !isNaN(n))
          : []),
        ...(seriesInfo.episodes
          ? Object.keys(seriesInfo.episodes)
              .map(Number)
              .filter((n) => !isNaN(n))
          : []),
      ])
    ).sort((a, b) => a - b);

    if (seasons.length === 0) return;

    const profile = getActiveProfile();
    const general = getGeneralSettings();
    const userLang = profile.language || general.language || "en-US";

    let isMounted = true;

    seasons.forEach((seasonNum) => {
      if (fetchedSeasonsRef.current.has(seasonNum)) return;
      fetchedSeasonsRef.current.add(seasonNum);

      fetch(`/api/proxy/tmdb?type=tv&id=${tmdbId}&season=${seasonNum}&language=${userLang}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!isMounted || !data || !data.episodes) return;

          // Check if any episode has empty or generic title/overview
          const needsEnglishFallback = userLang !== "en-US" && data.episodes.some((ep: any) => {
            const isGenericName = !ep.name || ep.name.trim() === "" || ep.name.match(/^(episode|episode\s+\d+|حلقة\s+\d+|الحلقة\s+\d+)$/i);
            return isGenericName || !ep.overview || ep.overview.trim() === "";
          });

          const applyEpisodes = (mainEpisodes: any[], fallbackEpisodes?: any[]) => {
            const merged = mainEpisodes.map((ep: any) => {
              const enEp = fallbackEpisodes?.find((e: any) => e.episode_number === ep.episode_number);
              
              const isGenericName = !ep.name || ep.name.trim() === "" || ep.name.match(/^(episode|episode\s+\d+|حلقة\s+\d+|الحلقة\s+\d+)$/i);
              const name = isGenericName ? (enEp?.name || ep.name) : ep.name;
              
              const isGenericPlot = !ep.overview || ep.overview.trim() === "";
              const overview = isGenericPlot ? (enEp?.overview || ep.overview) : ep.overview;

              return {
                ...ep,
                name,
                overview,
              };
            });

            setTmdbSeasonsMap((prev) => ({
              ...prev,
              [seasonNum]: merged,
            }));
          };

          if (needsEnglishFallback) {
            fetch(`/api/proxy/tmdb?type=tv&id=${tmdbId}&season=${seasonNum}&language=en-US`)
              .then((enRes) => (enRes.ok ? enRes.json() : null))
              .then((enData) => {
                if (!isMounted) return;
                applyEpisodes(data.episodes, enData?.episodes);
              })
              .catch(() => {
                if (!isMounted) return;
                applyEpisodes(data.episodes);
              });
          } else {
            applyEpisodes(data.episodes);
          }
        })
        .catch((err) => console.warn(`TMDB Season ${seasonNum} pre-fetch failed:`, err));
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, tmdbId, seriesInfo]);

  // Plex Theme Music Audio Playback
  useEffect(() => {
    if (!isOpen || !tvdbId) return;

    const themeUrl = getThemeAudioUrl(tvdbId);
    if (!audioRef.current) {
      audioRef.current = new Audio(themeUrl);
    } else {
      audioRef.current.src = themeUrl;
    }
    audioRef.current.volume = 0.3;
    audioRef.current
      .play()
      .then(() => {
        setIsPlayingTheme(true);
        setThemeBlocked(false);
      })
      .catch((e) => {
        setIsPlayingTheme(false);
        if (e.name === "NotAllowedError") setThemeBlocked(true);
      });

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [isOpen, tvdbId]);

  if (!isOpen || !series) return null;

  const toggleThemeAudio = () => {
    if (!audioRef.current) return;
    if (isPlayingTheme) {
      audioRef.current.pause();
      setIsPlayingTheme(false);
    } else {
      audioRef.current
        .play()
        .then(() => {
          setIsPlayingTheme(true);
          setThemeBlocked(false);
        })
        .catch((e) => console.warn("Theme play error:", e));
    }
  };

  const handleToggleFavorite = () => {
    const nextState = toggleFavorite(normalizeCatalogItem(series, "series"));
    setIsFav(nextState);
  };

  const handlePlayEpisodeClick = (ep: Episode) => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlayingTheme(false);
    }
    const seriesWithIds: Series = {
      ...series,
      tmdb_id: (tmdbId || (series as any).tmdb_id) as any,
      tvdb_id: (tvdbId || (series as any).tvdb_id) as any,
    } as any;

    const epWithIds: Episode = {
      ...ep,
      info: {
        ...ep.info,
        tmdb_id: tmdbId || ep.info?.tmdb_id,
      },
    };

    onPlayEpisode(seriesWithIds, selectedSeason, epWithIds);
  };

  const infoObj = seriesInfo?.info || series;
  const backdrop =
    heroBackdrop ||
    (series as any).backdrop_path?.[0] ||
    (infoObj as any).backdrop_path?.[0] ||
    series.cover;

  const cover = tmdbPoster || series.cover || (infoObj as any).cover_big;

  // Compute available seasons list (including Specials season 0 if present)
  const seasonsList: number[] = Array.from(
    new Set<number>([
      ...(seriesInfo?.seasons
        ? seriesInfo.seasons
            .map((s) => s.season_number)
            .filter((n): n is number => typeof n === "number" && !isNaN(n))
        : []),
      ...(seriesInfo?.episodes
        ? Object.keys(seriesInfo.episodes)
            .map(Number)
            .filter((n) => !isNaN(n))
        : []),
    ])
  ).sort((a, b) => a - b);

  if (seasonsList.length === 0) {
    seasonsList.push(1);
  }

  // Extract and enrich episodes for selected season
  const rawSeasonEpisodes: Episode[] =
    seriesInfo?.episodes?.[String(selectedSeason)] ||
    seriesInfo?.episodes?.[selectedSeason as any] ||
    [];

  const tmdbEpList = tmdbSeasonsMap[selectedSeason] || [];

  const seasonEpisodes: Episode[] = rawSeasonEpisodes.map((ep, idx) => {
    const tmdbEp =
      tmdbEpList.find((t: any) => Number(t.episode_number) === Number(ep.episode_num)) ||
      tmdbEpList[idx];

    if (tmdbEp) {
      const stillUrl = tmdbEp.still_path
        ? tmdbEp.still_path.startsWith("http")
          ? tmdbEp.still_path
          : `https://image.tmdb.org/t/p/w300${tmdbEp.still_path}`
        : undefined;

      // tmdbEp.name and tmdbEp.overview may already be merged with English fallback
      // from the pre-fetch logic, so use them directly
      const epName = tmdbEp.name && tmdbEp.name.trim() !== "" ? tmdbEp.name : null;
      const epOverview = tmdbEp.overview && tmdbEp.overview.trim() !== "" ? tmdbEp.overview : null;

      return {
        ...ep,
        title: epName ? `${ep.episode_num}. ${epName}` : ep.title,
        info: {
          ...ep.info,
          plot: epOverview || ep.info?.plot || "",
          movie_image: stillUrl || ep.info?.movie_image || ep.cover_big || series.cover,
          cover_big: stillUrl || ep.cover_big || ep.info?.movie_image || series.cover,
          tmdb_id: tmdbId || ep.info?.tmdb_id,
        },
      };
    }
    return ep;
  });

  return (
    <div
      data-testid="series-details-modal"
      className="fixed inset-0 z-50 bg-app overflow-y-auto animate-fade-in"
    >
      <div className="relative w-full min-h-screen flex flex-col pb-24">
        {/* Hero Backdrop */}
        <div className="relative h-[60vh] w-full bg-black overflow-hidden shrink-0 select-none">
          {backdrop && (
            <img
              src={backdrop}
              alt={series.name}
              className="w-full h-full object-cover opacity-60"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-app via-app/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-app/80 via-transparent to-transparent" />

          {/* Close & Header Buttons */}
          <div className="absolute top-6 right-6 flex items-center gap-3 z-20">
            <button
              onClick={toggleThemeAudio}
              data-testid="theme-audio-button"
              className={`p-3 rounded-full border backdrop-blur-md transition-all shadow-lg ${
                isPlayingTheme
                  ? "bg-accent-primary/90 text-white border-accent-light animate-pulse"
                  : themeBlocked
                  ? "bg-amber-600/90 text-white border-amber-400 animate-bounce"
                  : "bg-black/60 text-theme-primary border-border-subtle hover:text-white"
              }`}
              title={isPlayingTheme ? "Mute Theme Song" : themeBlocked ? "Play Theme (Autoplay Blocked)" : "Play Theme Song"}
            >
              {isPlayingTheme ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </button>

            <button
              onClick={handleToggleFavorite}
              data-testid="favorite-modal-button"
              className={`p-3 rounded-full border backdrop-blur-md transition-all shadow-lg ${
                isFav
                  ? "bg-rose-600/90 text-white border-rose-400"
                  : "bg-black/60 text-theme-primary border-border-subtle hover:text-rose-400"
              }`}
            >
              <Heart className={`w-6 h-6 ${isFav ? "fill-current" : ""}`} />
            </button>

            <button
              onClick={onClose}
              data-testid="close-modal-button"
              className="p-3 bg-black/60 hover:bg-surface-hover rounded-full border border-border-subtle text-theme-primary hover:text-white backdrop-blur-md transition-colors shadow-lg"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Series Hero Information */}
          <div className="absolute bottom-0 left-0 right-0 p-8 sm:p-12 md:p-16 flex items-end gap-8 z-10 max-w-7xl mx-auto w-full">
            {cover && (
              <img
                src={cover}
                alt={series.name}
                className="w-32 sm:w-48 rounded-2xl border-2 border-border-subtle/50 shadow-2xl object-cover shrink-0 hidden md:block"
              />
            )}
            <div className="flex-1 min-w-0 pb-4">
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight drop-shadow-lg truncate">
                {series.name}
              </h2>
              <div className="flex items-center gap-4 mt-4 text-sm sm:text-base text-theme-muted font-medium flex-wrap">
                {series.rating && (
                  <span className="flex items-center gap-1.5 bg-amber-500/20 text-amber-400 px-3 py-1 rounded-lg border border-amber-500/30">
                    <Star className="w-4 h-4 fill-current" />
                    {series.rating}
                  </span>
                )}
                {series.genre && (
                  <span className="bg-white/10 text-white px-3 py-1 rounded-lg backdrop-blur-sm">
                    {series.genre}
                  </span>
                )}
                {series.releaseDate && <span className="text-theme-muted">{series.releaseDate}</span>}
                {tmdbId && (
                  <a
                    href={`https://www.themoviedb.org/tv/${tmdbId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20 px-2.5 py-1 rounded-lg border border-yellow-500/20 transition-all font-bold cursor-pointer"
                  >
                    TMDB
                  </a>
                )}
                {imdbId && (
                  <a
                    href={`https://www.imdb.com/title/${imdbId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/20 transition-all font-bold cursor-pointer"
                  >
                    IMDb
                  </a>
                )}
                {tvdbId && (
                  <a
                    href={`https://thetvdb.com/dereferrer/series/${tvdbId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-green-500 bg-green-500/10 hover:bg-green-500/20 px-2.5 py-1 rounded-lg border border-green-500/20 transition-all font-bold cursor-pointer"
                  >
                    TVDB
                  </a>
                )}
              </div>
              
              {/* Plot Overview in Hero */}
              {infoObj.plot && (
                <p className="mt-6 text-base sm:text-lg text-theme-primary leading-relaxed max-w-3xl drop-shadow-md line-clamp-3">
                  {infoObj.plot}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 max-w-7xl mx-auto w-full px-8 sm:px-12 md:px-16 pt-8 space-y-12">
          
          {/* Cast & Crew Section */}
          {(tmdbCredits?.cast?.length > 0 || tmdbCredits?.crew?.length > 0 || infoObj.director) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Cast & Crew</h3>
                {tmdbCredits?.cast?.length > 8 && (
                  <button
                    onClick={() => setShowAllCast(!showAllCast)}
                    className="text-sm text-accent-primary hover:text-accent-hover font-medium transition-colors"
                  >
                    {showAllCast ? "Show Less" : "Show All"}
                  </button>
                )}
              </div>
              
              {/* TMDB Cast Horizontal Scroll / Grid */}
              {tmdbCredits?.cast?.length > 0 ? (
                <div className={`flex gap-4 pb-4 select-none ${
                  showAllCast 
                    ? "flex-wrap justify-center sm:justify-start" 
                    : "overflow-x-auto snap-x [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                }`}>
                  {tmdbCredits.cast.slice(0, showAllCast ? 50 : 8).map((actor: any) => (
                    <div key={actor.id} className="flex flex-col items-center gap-2 w-28 shrink-0 snap-start group">
                      <div className="w-24 h-24 rounded-full overflow-hidden bg-surface border-2 border-border-subtle group-hover:border-accent-primary/50 transition-colors">
                        {actor.profile_path ? (
                          <img 
                            src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`} 
                            alt={actor.name}
                            className="w-full h-full object-cover"
                            draggable={false}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600">No Image</div>
                        )}
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-theme-primary truncate w-full">{actor.name}</p>
                        <p className="text-xs text-theme-muted truncate w-full">{actor.character}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                infoObj.cast && <p className="text-slate-400 text-sm">Cast: {infoObj.cast}</p>
              )}

              {/* Director / Creator */}
              <div className="text-sm text-theme-muted">
                {tmdbCredits?.crew?.filter((c:any) => c.job === "Director" || c.job === "Executive Producer" || c.job === "Creator").length > 0 ? (
                  <p>
                    <span className="font-semibold text-theme-primary">Creators / Directors: </span>
                    {Array.from(new Set(tmdbCredits.crew.filter((c:any) => c.job === "Director" || c.job === "Executive Producer" || c.job === "Creator").map((c:any) => c.name))).slice(0, 5).join(", ")}
                  </p>
                ) : infoObj.director ? (
                  <p><span className="font-semibold text-theme-primary">Director: </span>{infoObj.director}</p>
                ) : null}
              </div>
            </div>
          )}

          {/* Season Selector & Episode List */}
          <div>
            <div className="flex items-center justify-between gap-4 border-b border-border-subtle/60 pb-4 mb-6">
              <h3 className="text-2xl font-bold text-white">Episodes</h3>

              {seasonsList.length > 1 ? (
                <select
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(Number(e.target.value))}
                  data-testid="season-select"
                  className="bg-surface text-base font-medium text-theme-primary border border-border-subtle rounded-xl px-4 py-2 focus:outline-none focus:border-accent-primary cursor-pointer shadow-lg"
                >
                  {seasonsList.map((sNum) => (
                    <option key={sNum} value={sNum}>
                      {sNum === 0 ? "Specials" : `Season ${sNum}`}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-sm text-theme-muted font-medium px-4 py-2 bg-surface rounded-xl border border-border-subtle">
                  {selectedSeason === 0 ? "Specials" : `Season ${selectedSeason}`}
                </span>
              )}
            </div>

            {loading ? (
              <div className="py-24 flex flex-col items-center justify-center text-theme-muted gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-accent-primary/50" />
                <p className="text-base font-medium">Loading episodes metadata...</p>
              </div>
            ) : (
              <EpisodeList
                episodes={seasonEpisodes}
                seriesId={series.series_id}
                seasonNum={selectedSeason}
                seriesTitle={series.name}
                poster={series.cover}
                onPlayEpisode={handlePlayEpisodeClick}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
