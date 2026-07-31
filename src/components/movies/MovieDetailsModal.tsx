"use client";

import React, { useEffect, useState } from "react";
import { X, Star, Heart, Play, Terminal } from "lucide-react";
import { CatalogItem } from "@/types/iptv";
import { isFavorite, toggleFavorite } from "@/lib/storage";
import { cleanTitle } from "@/lib/formatters";
import { getUserLanguage } from "@/lib/profile-storage";
import { findBestMatch } from "@/lib/tmdb";
import { MetadataAuditModal, MetadataAuditLog } from "@/components/common/MetadataAuditModal";

interface MovieDetailsModalProps {
  movie: CatalogItem | null;
  isOpen: boolean;
  onClose: () => void;
  onPlay: (movie: CatalogItem) => void;
}

export const MovieDetailsModal: React.FC<MovieDetailsModalProps> = ({
  movie,
  isOpen,
  onClose,
  onPlay,
}) => {
  const [loading, setLoading] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [tmdbId, setTmdbId] = useState<number | string | null>(null);
  const [heroBackdrop, setHeroBackdrop] = useState<string | null>(null);
  const [tmdbCredits, setTmdbCredits] = useState<any>(null);
  const [showAllCast, setShowAllCast] = useState(false);
  const [plot, setPlot] = useState<string | undefined>(undefined);
  const [tmdbPoster, setTmdbPoster] = useState<string | null>(null);
  const [imdbId, setImdbId] = useState<string | null>(null);
  const [tvdbId, setTvdbId] = useState<string | number | null>(null);
  const [auditLog, setAuditLog] = useState<MetadataAuditLog | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Sync favorite state
  useEffect(() => {
    if (movie) {
      setIsFav(isFavorite("movies", movie.stream_id || movie.id));
    }
  }, [movie]);

  // Reset state when modal closes or movie changes
  useEffect(() => {
    setTmdbId(null);
    setHeroBackdrop(null);
    setTmdbPoster(null);
    setTmdbCredits(null);
    setImdbId(null);
    setTvdbId(null);
    setShowAllCast(false);
    setPlot(undefined);
    setAuditLog(null);
    setIsAuditModalOpen(false);

    if (!isOpen || !movie) {
      return;
    }

    setPlot(movie.plot || movie.info?.plot);

    // Initial ID check
    const existingTmdb = movie.tmdb_id || movie.info?.tmdb_id;
    if (existingTmdb) {
      setTmdbId(existingTmdb);
    }
  }, [isOpen, movie]);

  // Fetch TMDB Movie ID and Backdrop if tmdbId is not set
  useEffect(() => {
    if (!isOpen || !movie || tmdbId) return;

    let isMounted = true;
    const userLang = getUserLanguage();

    const rawTitle = movie.name || movie.title || "";
    const { title, year } = cleanTitle(rawTitle);

    let searchUrl = `/api/proxy/tmdb?type=search&query=${encodeURIComponent(title)}&language=${userLang}`;
    if (year) searchUrl += `&year=${year}`;

    fetch(searchUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data) return;
        const results = data.results || [];

        if (results.length > 0) {
          const match = findBestMatch(results, title, year, "movie");
          if (match && match.id) {
            setTmdbId(match.id);
            setAuditLog({
              rawName: rawTitle,
              cleanedTitle: title,
              extractedYear: year,
              source: "tmdb",
              requestedLanguage: userLang,
              tmdbId: match.id,
              searchUrl,
              detailsUrl: `/api/proxy/tmdb?type=movie&id=${match.id}&language=${userLang}`,
              matchedCandidate: {
                id: match.id,
                name: match.name || match.title,
                originalName: match.original_name || match.original_title,
                releaseDate: match.release_date,
              },
              rawPayload: { searchResults: results, selectedMovie: movie },
              timestamp: new Date().toLocaleTimeString(),
            });
            return;
          }
        }

        // Fallback: search raw name stripped of common tags if cleaned title returned 0 results
        const rawName = movie.name || movie.title || "";
        const fallbackQuery = rawName
          .replace(/(مترجم|المترجم|مدبلج|المدبلج)/g, "")
          .replace(/[\(\[].*?[\)\]]/g, "")
          .trim();

        if (fallbackQuery && fallbackQuery !== title) {
          fetch(`/api/proxy/tmdb?type=search&query=${encodeURIComponent(fallbackQuery)}&language=${userLang}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((fbData) => {
              if (!isMounted || !fbData) return;
              const fbResults = fbData.results || [];
              const fbMatch = findBestMatch(fbResults, fallbackQuery, year, "movie");
              if (fbMatch && fbMatch.id) {
                setTmdbId(fbMatch.id);
              }
            })
            .catch(() => {});
        }
      })
      .catch((err) => console.warn("TMDB search failed:", err));

    return () => {
      isMounted = false;
    };
  }, [isOpen, movie, tmdbId]);

  // Fetch TMDB Movie Details once tmdbId is known
  useEffect(() => {
    if (!isOpen || !tmdbId) return;

    let isMounted = true;
    setLoading(true);
    const userLang = getUserLanguage();

    fetch(`/api/proxy/tmdb?type=movie&id=${tmdbId}&language=${userLang}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data) return;

        const needsFallback = userLang !== "en-US" && (!data.overview || data.overview.trim() === "" || !data.poster_path);

        const applyData = (mainData: any, fallbackData?: any) => {
          const overview = mainData.overview || fallbackData?.overview;
          const poster = mainData.poster_path || fallbackData?.poster_path;
          const backdrop = mainData.backdrop_path || fallbackData?.backdrop_path;
          const credits = mainData.credits || fallbackData?.credits;

          const imdb = mainData.imdb_id || fallbackData?.imdb_id || mainData.external_ids?.imdb_id || fallbackData?.external_ids?.imdb_id;
          const tvdb = mainData.external_ids?.tvdb_id || fallbackData?.external_ids?.tvdb_id;

          if (imdb) setImdbId(imdb);
          if (tvdb) setTvdbId(tvdb);

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
          
          if (overview) {
            setPlot(overview);
          }

          if (credits) {
            setTmdbCredits(credits);
          }
          setLoading(false);
        };

        if (needsFallback) {
          fetch(`/api/proxy/tmdb?type=movie&id=${tmdbId}&language=en-US`)
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
      .catch((err) => {
        console.warn("TMDB movie details fetch failed:", err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, tmdbId]);

  if (!isOpen || !movie) return null;

  const handleToggleFavorite = () => {
    const nextState = toggleFavorite(movie);
    setIsFav(nextState);
  };

  const infoObj = movie.info || {};
  const backdrop =
    heroBackdrop ||
    movie.backdrop_path ||
    infoObj.backdrop_path ||
    movie.cover ||
    movie.stream_icon ||
    movie.poster;
    
  const rawTitle = movie.name || movie.title || "Unknown Movie";
  const { title } = cleanTitle(rawTitle);
  const cover = tmdbPoster || movie.stream_icon || movie.cover || movie.poster || infoObj.cover_big;
  const rating = movie.rating || movie.rating_5based || infoObj.rating;
  const genre = movie.genre || infoObj.genre;
  const releaseDate = movie.releaseDate || movie.release_date || infoObj.release_date;

  return (
    <div
      data-testid="movie-details-modal"
      className="fixed inset-0 z-50 bg-app overflow-y-auto animate-fade-in"
    >
      <div className="relative w-full min-h-screen flex flex-col pb-24">
        {/* Hero Backdrop */}
        <div className="relative h-[65vh] w-full bg-black overflow-hidden shrink-0 select-none">
          {backdrop && (
            <img
              src={backdrop}
              alt={title}
              className="w-full h-full object-cover opacity-60"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-app via-app/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-app/80 via-transparent to-transparent" />

          {/* Close & Header Buttons */}
          <div className="absolute top-6 right-6 flex items-center gap-3 z-20">
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

          {/* Movie Hero Information */}
          <div className="absolute bottom-0 left-0 right-0 p-8 sm:p-12 md:p-16 flex items-end gap-8 z-10 max-w-7xl mx-auto w-full">
            {cover && (
              <img
                src={cover}
                alt={rawTitle}
                className="w-32 sm:w-48 rounded-2xl border-2 border-border-subtle/50 shadow-2xl object-cover shrink-0 hidden md:block"
              />
            )}
            <div className="flex-1 min-w-0 pb-4">
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight drop-shadow-lg truncate">
                {rawTitle}
              </h2>
              <div className="flex items-center gap-4 mt-4 text-sm sm:text-base text-theme-muted font-medium flex-wrap">
                {rating && (
                  <span className="flex items-center gap-1.5 bg-amber-500/20 text-amber-400 px-3 py-1 rounded-lg border border-amber-500/30">
                    <Star className="w-4 h-4 fill-current" />
                    {rating}
                  </span>
                )}
                {genre && (
                  <span className="bg-white/10 text-white px-3 py-1 rounded-lg backdrop-blur-sm">
                    {genre}
                  </span>
                )}
                {releaseDate && <span className="text-theme-muted">{releaseDate}</span>}
                {tmdbId && (
                  <a
                    href={`https://www.themoviedb.org/movie/${tmdbId}`}
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
                <button
                  onClick={() => {
                    if (!auditLog) {
                      const rawName = movie.name || movie.title || "";
                      const { title, year } = cleanTitle(rawName);
                      setAuditLog({
                        rawName,
                        cleanedTitle: title,
                        extractedYear: year,
                        source: tmdbId ? "tmdb" : "xtream",
                        requestedLanguage: getUserLanguage(),
                        tmdbId: tmdbId || undefined,
                        tvdbId: tvdbId || undefined,
                        imdbId: imdbId || undefined,
                        rawPayload: { movie },
                        timestamp: new Date().toLocaleTimeString(),
                      });
                    }
                    setIsAuditModalOpen(true);
                  }}
                  data-testid="audit-log-badge"
                  className="flex items-center gap-1.5 text-xs text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 px-2.5 py-1 rounded-lg border border-cyan-500/30 transition-all font-bold cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Data Source Log</span>
                </button>
              </div>
              
              {/* Plot Overview in Hero */}
              {plot && (
                <p className="mt-6 text-base sm:text-lg text-theme-primary leading-relaxed max-w-3xl drop-shadow-md line-clamp-3">
                  {plot}
                </p>
              )}
              
              <div className="mt-8 flex items-center gap-4">
                <button
                  onClick={() => onPlay(movie)}
                  className="flex items-center gap-2 bg-accent-primary hover:bg-accent-hover text-white px-8 py-3.5 rounded-xl font-bold text-lg transition-all shadow-lg hover:scale-105"
                >
                  <Play className="w-6 h-6 fill-current" />
                  Play Movie
                </button>
              </div>
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
                (movie.cast || infoObj.cast) && <p className="text-theme-muted text-sm">Cast: {movie.cast || infoObj.cast}</p>
              )}

              {/* Director / Creator */}
              <div className="text-sm text-theme-muted mt-4">
                {tmdbCredits?.crew?.filter((c:any) => c.job === "Director").length > 0 ? (
                  <p>
                    <span className="font-semibold text-theme-primary">Director: </span>
                    {Array.from(new Set(tmdbCredits.crew.filter((c:any) => c.job === "Director").map((c:any) => c.name))).join(", ")}
                  </p>
                ) : (movie.director || infoObj.director) ? (
                  <p><span className="font-semibold text-theme-primary">Director: </span>{movie.director || infoObj.director}</p>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Metadata Resolution Debug Log Modal */}
      <MetadataAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        auditLog={auditLog}
      />
    </div>
  );
};
