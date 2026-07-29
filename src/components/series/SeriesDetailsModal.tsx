"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { X, Star, Volume2, VolumeX, Heart, Loader2 } from "lucide-react";
import { Series, SeriesInfo, Episode, normalizeCatalogItem } from "@/types/iptv";
import { fetchSeriesInfo, getThemeAudioUrl } from "@/lib/api-client";
import { isFavorite, toggleFavorite } from "@/lib/storage";
import { cleanTitle } from "@/lib/tmdb";
import { EpisodeList } from "./EpisodeList";

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

  const audioRef = useRef<HTMLAudioElement | null>(null);

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
      setTmdbCredits(null);
      setShowAllCast(false);
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
    const { title, year } = cleanTitle(series.name);
    let searchUrl = `/api/proxy/tmdb?type=search_tv&query=${encodeURIComponent(title)}`;
    if (year) searchUrl += `&year=${year}`;

    fetch(searchUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data) return;
        const results = data.results || [];
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
    fetch(`/api/proxy/tmdb?type=tv&id=${tmdbId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data) return;
        if (data.external_ids?.tvdb_id && !tvdbId) {
          setTvdbId(data.external_ids.tvdb_id);
        }
        if (data.backdrop_path) {
          const bgUrl = data.backdrop_path.startsWith("http")
            ? data.backdrop_path
            : `https://image.tmdb.org/t/p/original${data.backdrop_path}`;
          setHeroBackdrop(bgUrl);
        }
        if (data.credits) {
          setTmdbCredits(data.credits);
        }
      })
      .catch((err) => console.warn("TMDB show details fetch failed:", err));

    return () => {
      isMounted = false;
    };
  }, [isOpen, tmdbId, tvdbId]);

  // Fetch TMDB Season Details when selectedSeason or tmdbId changes
  useEffect(() => {
    if (!isOpen || !tmdbId || selectedSeason === undefined) return;
    if (tmdbSeasonsMap[selectedSeason]) return; // already fetched

    let isMounted = true;
    fetch(`/api/proxy/tmdb?type=tv&id=${tmdbId}&season=${selectedSeason}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data || !data.episodes) return;
        setTmdbSeasonsMap((prev) => ({
          ...prev,
          [selectedSeason]: data.episodes,
        }));
      })
      .catch((err) => console.warn(`TMDB Season ${selectedSeason} fetch failed:`, err));

    return () => {
      isMounted = false;
    };
  }, [isOpen, tmdbId, selectedSeason, tmdbSeasonsMap]);

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

      return {
        ...ep,
        title: tmdbEp.name ? `${ep.episode_num}. ${tmdbEp.name}` : ep.title,
        info: {
          ...ep.info,
          plot: tmdbEp.overview || ep.info?.plot,
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
      className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto animate-fade-in"
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
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-transparent" />

          {/* Close & Header Buttons */}
          <div className="absolute top-6 right-6 flex items-center gap-3 z-20">
            <button
              onClick={toggleThemeAudio}
              data-testid="theme-audio-button"
              className={`p-3 rounded-full border backdrop-blur-md transition-all shadow-lg ${
                isPlayingTheme
                  ? "bg-cyan-600/90 text-white border-cyan-400 animate-pulse"
                  : themeBlocked
                  ? "bg-amber-600/90 text-white border-amber-400 animate-bounce"
                  : "bg-black/60 text-slate-300 border-slate-700 hover:text-white"
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
                  : "bg-black/60 text-slate-300 border-slate-700 hover:text-rose-400"
              }`}
            >
              <Heart className={`w-6 h-6 ${isFav ? "fill-current" : ""}`} />
            </button>

            <button
              onClick={onClose}
              data-testid="close-modal-button"
              className="p-3 bg-black/60 hover:bg-slate-800 rounded-full border border-slate-700 text-slate-300 hover:text-white backdrop-blur-md transition-colors shadow-lg"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Series Hero Information */}
          <div className="absolute bottom-0 left-0 right-0 p-8 sm:p-12 md:p-16 flex items-end gap-8 z-10 max-w-7xl mx-auto w-full">
            {series.cover && (
              <img
                src={series.cover}
                alt={series.name}
                className="w-32 sm:w-48 rounded-2xl border-2 border-slate-700/50 shadow-2xl object-cover shrink-0 hidden md:block"
              />
            )}
            <div className="flex-1 min-w-0 pb-4">
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight drop-shadow-lg truncate">
                {series.name}
              </h2>
              <div className="flex items-center gap-4 mt-4 text-sm sm:text-base text-slate-300 font-medium flex-wrap">
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
                {series.releaseDate && <span className="text-slate-400">{series.releaseDate}</span>}
              </div>
              
              {/* Plot Overview in Hero */}
              {infoObj.plot && (
                <p className="mt-6 text-base sm:text-lg text-slate-300 leading-relaxed max-w-3xl drop-shadow-md line-clamp-3">
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
                    className="text-sm text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
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
                      <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-800 border-2 border-slate-800 group-hover:border-cyan-500/50 transition-colors">
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
                        <p className="text-sm font-semibold text-slate-200 truncate w-full">{actor.name}</p>
                        <p className="text-xs text-slate-500 truncate w-full">{actor.character}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                infoObj.cast && <p className="text-slate-400 text-sm">Cast: {infoObj.cast}</p>
              )}

              {/* Director / Creator */}
              <div className="text-sm text-slate-400">
                {tmdbCredits?.crew?.filter((c:any) => c.job === "Director" || c.job === "Executive Producer" || c.job === "Creator").length > 0 ? (
                  <p>
                    <span className="font-semibold text-slate-300">Creators / Directors: </span>
                    {Array.from(new Set(tmdbCredits.crew.filter((c:any) => c.job === "Director" || c.job === "Executive Producer" || c.job === "Creator").map((c:any) => c.name))).slice(0, 5).join(", ")}
                  </p>
                ) : infoObj.director ? (
                  <p><span className="font-semibold text-slate-300">Director: </span>{infoObj.director}</p>
                ) : null}
              </div>
            </div>
          )}

          {/* Season Selector & Episode List */}
          <div>
            <div className="flex items-center justify-between gap-4 border-b border-slate-800/60 pb-4 mb-6">
              <h3 className="text-2xl font-bold text-white">Episodes</h3>

              {seasonsList.length > 1 ? (
                <select
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(Number(e.target.value))}
                  data-testid="season-select"
                  className="bg-slate-900 text-base font-medium text-slate-200 border border-slate-700 rounded-xl px-4 py-2 focus:outline-none focus:border-cyan-400 cursor-pointer shadow-lg"
                >
                  {seasonsList.map((sNum) => (
                    <option key={sNum} value={sNum}>
                      {sNum === 0 ? "Specials" : `Season ${sNum}`}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-sm text-slate-400 font-medium px-4 py-2 bg-slate-900 rounded-xl border border-slate-800">
                  {selectedSeason === 0 ? "Specials" : `Season ${selectedSeason}`}
                </span>
              )}
            </div>

            {loading ? (
              <div className="py-24 flex flex-col items-center justify-center text-slate-500 gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-cyan-500/50" />
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
