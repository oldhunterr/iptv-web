"use client";

import React, { useEffect, useState } from "react";
import { X, Star, Heart, Play } from "lucide-react";
import { CatalogItem } from "@/types/iptv";
import { isFavorite, toggleFavorite } from "@/lib/storage";
import { cleanTitle } from "@/lib/formatters";

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

  // Sync favorite state
  useEffect(() => {
    if (movie) {
      setIsFav(isFavorite("movies", movie.stream_id || movie.id));
    }
  }, [movie]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen || !movie) {
      setTmdbId(null);
      setHeroBackdrop(null);
      setTmdbCredits(null);
      setShowAllCast(false);
      setPlot(movie?.plot || movie?.info?.plot);
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
    const { title, year } = cleanTitle(movie.name || movie.title || "");
    let searchUrl = `/api/proxy/tmdb?type=search&query=${encodeURIComponent(title)}`;
    if (year) searchUrl += `&year=${year}`;

    fetch(searchUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data) return;
        const results = data.results || [];
        // For search/multi, prefer movies
        const match = results.find((r: any) => r.media_type === "movie") || results[0];
        if (match && match.id) {
          setTmdbId(match.id);
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
    fetch(`/api/proxy/tmdb?type=movie&id=${tmdbId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data) return;
        
        if (data.backdrop_path) {
          const bgUrl = data.backdrop_path.startsWith("http")
            ? data.backdrop_path
            : `https://image.tmdb.org/t/p/original${data.backdrop_path}`;
          setHeroBackdrop(bgUrl);
        }
        
        if (data.overview) {
          setPlot(data.overview);
        }

        if (data.credits) {
          setTmdbCredits(data.credits);
        }
        setLoading(false);
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
  const cover = movie.stream_icon || movie.cover || movie.poster || infoObj.cover_big;
  const rating = movie.rating || movie.rating_5based || infoObj.rating;
  const genre = movie.genre || infoObj.genre;
  const releaseDate = movie.releaseDate || movie.release_date || infoObj.release_date;

  return (
    <div
      data-testid="movie-details-modal"
      className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto animate-fade-in"
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
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-transparent" />

          {/* Close & Header Buttons */}
          <div className="absolute top-6 right-6 flex items-center gap-3 z-20">
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

          {/* Movie Hero Information */}
          <div className="absolute bottom-0 left-0 right-0 p-8 sm:p-12 md:p-16 flex items-end gap-8 z-10 max-w-7xl mx-auto w-full">
            {cover && (
              <img
                src={cover}
                alt={title}
                className="w-32 sm:w-48 rounded-2xl border-2 border-slate-700/50 shadow-2xl object-cover shrink-0 hidden md:block"
              />
            )}
            <div className="flex-1 min-w-0 pb-4">
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight drop-shadow-lg truncate">
                {title}
              </h2>
              <div className="flex items-center gap-4 mt-4 text-sm sm:text-base text-slate-300 font-medium flex-wrap">
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
                {releaseDate && <span className="text-slate-400">{releaseDate}</span>}
              </div>
              
              {/* Plot Overview in Hero */}
              {plot && (
                <p className="mt-6 text-base sm:text-lg text-slate-300 leading-relaxed max-w-3xl drop-shadow-md line-clamp-3">
                  {plot}
                </p>
              )}
              
              <div className="mt-8 flex items-center gap-4">
                <button
                  onClick={() => onPlay(movie)}
                  className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-3.5 rounded-xl font-bold text-lg transition-all shadow-lg shadow-cyan-600/30 hover:shadow-cyan-500/50 hover:scale-105"
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
                (movie.cast || infoObj.cast) && <p className="text-slate-400 text-sm">Cast: {movie.cast || infoObj.cast}</p>
              )}

              {/* Director / Creator */}
              <div className="text-sm text-slate-400 mt-4">
                {tmdbCredits?.crew?.filter((c:any) => c.job === "Director").length > 0 ? (
                  <p>
                    <span className="font-semibold text-slate-300">Director: </span>
                    {Array.from(new Set(tmdbCredits.crew.filter((c:any) => c.job === "Director").map((c:any) => c.name))).join(", ")}
                  </p>
                ) : (movie.director || infoObj.director) ? (
                  <p><span className="font-semibold text-slate-300">Director: </span>{movie.director || infoObj.director}</p>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
