"use client";

import React, { useState } from "react";
import { Play, Star, Heart, Tv, Film, Check } from "lucide-react";
import { CatalogItem } from "@/types/iptv";
import { isFavorite, toggleFavorite, getWatchProgress, getSeriesProgress } from "@/lib/storage";

interface ItemCardProps {
  item: CatalogItem;
  onSelect: (item: CatalogItem) => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onSelect }) => {
  const itemId = item.type === "series" ? item.series_id : item.stream_id;
  const itemKey = `${item.type}_${itemId}`;

  const [isFav, setIsFav] = useState(() =>
    isFavorite(
      item.type === "vod" ? "movies" : (item.type as "live" | "movies" | "series"),
      itemId!
    )
  );
  const [imgError, setImgError] = useState(false);

  const title = item.name || item.title || "Untitled";
  let posterUrl: string | undefined = undefined;
  let rating: string | undefined = undefined;

  if (item.type === "live") {
    posterUrl = item.stream_icon || item.poster;
  } else if (item.type === "movies" || item.type === "vod") {
    posterUrl = item.stream_icon || item.poster;
    rating = item.rating !== undefined && item.rating !== null ? String(item.rating) : undefined;
  } else if (item.type === "series") {
    posterUrl = item.cover || item.poster;
    rating = item.rating !== undefined && item.rating !== null ? String(item.rating) : undefined;
  }

  // Calculate watch progress and completion status (M9)
  let percent = 0;
  let isWatched = false;

  if (item.type === "series") {
    const seriesProg = itemId !== undefined ? getSeriesProgress(itemId) : null;
    if (seriesProg) {
      percent = seriesProg.percent;
      isWatched = seriesProg.isWatched;
    } else {
      const historyItem = getWatchProgress(itemKey);
      if (historyItem && historyItem.duration > 0) {
        percent = Math.min(100, Math.floor((historyItem.lastPosition / historyItem.duration) * 100));
        isWatched = percent >= 90;
      }
    }
  } else {
    const historyItem = getWatchProgress(itemKey);
    if (historyItem && historyItem.duration > 0) {
      percent = Math.min(100, Math.floor((historyItem.lastPosition / historyItem.duration) * 100));
      isWatched = percent >= 90;
    }
  }

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextState = toggleFavorite(item);
    setIsFav(nextState);
  };

  const isLive = item.type === "live";

  return (
    <div
      onClick={() => onSelect(item)}
      data-testid={`item-card-${itemId}`}
      className="group relative flex flex-col bg-slate-900/90 rounded-2xl border border-slate-800 hover:border-cyan-500/50 overflow-hidden shadow-md hover:shadow-cyan-500/10 cursor-pointer transition-all duration-300 hover:-translate-y-1"
    >
      {/* Media Poster Wrapper */}
      <div className="relative aspect-[2/3] w-full bg-slate-950 flex items-center justify-center overflow-hidden">
        {posterUrl && !imgError ? (
          <img
            src={posterUrl}
            alt={title}
            className={
              isLive
                ? "w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                : "w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            }
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 p-4 text-center text-slate-500 w-full h-full bg-slate-950">
            {isLive ? (
              <Tv className="w-10 h-10 stroke-[1.5] text-slate-500" />
            ) : (
              <Film className="w-10 h-10 stroke-[1.5] text-slate-500" />
            )}
            <span className="text-xs font-semibold text-slate-400 line-clamp-2 px-1">
              {title}
            </span>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/40 opacity-80 group-hover:opacity-60 transition-opacity" />

        {/* Badges Container (Top Right) */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
          {isWatched && (
            <div
              data-testid="watched-badge"
              className="flex items-center gap-1 px-2 py-0.5 bg-emerald-600/90 text-white backdrop-blur-md rounded-md text-[11px] font-semibold border border-emerald-400/40 shadow"
            >
              <Check className="w-3 h-3 stroke-[3]" />
              <span>Watched</span>
            </div>
          )}

          {rating && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-black/70 backdrop-blur-md rounded-md text-[11px] font-semibold text-amber-400 border border-amber-500/30 shadow">
              <Star className="w-3 h-3 fill-current" />
              <span>{rating}</span>
            </div>
          )}
        </div>

        {/* Favorite Button (Top Left) */}
        <button
          onClick={handleFavoriteClick}
          data-testid="favorite-card-button"
          className={`absolute top-2.5 left-2.5 p-2 rounded-full backdrop-blur-md transition-all shadow z-10 ${
            isFav
              ? "bg-rose-600/90 text-white border border-rose-400"
              : "bg-black/60 text-slate-300 hover:text-rose-400 border border-white/10 opacity-0 group-hover:opacity-100"
          }`}
          title={isFav ? "Remove from Favorites" : "Add to Favorites"}
        >
          <Heart className={`w-3.5 h-3.5 ${isFav ? "fill-current" : ""}`} />
        </button>

        {/* Hover Play Button Icon */}
        <div
          data-testid="play-card-button"
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <div className="p-3.5 bg-cyan-600/90 hover:bg-cyan-500 text-white rounded-full shadow-xl backdrop-blur-sm transform transition-transform group-hover:scale-110">
            <Play className="w-6 h-6 fill-current translate-x-0.5" />
          </div>
        </div>

        {/* Watch Progress Bar (M9) */}
        {percent > 0 && !isWatched && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-950/80 z-10">
            <div
              className="h-full bg-cyan-400 transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
      </div>

      {/* Card Metadata Title Footer */}
      <div className="p-3">
        <h3 className="text-xs font-semibold text-slate-100 truncate group-hover:text-cyan-400 transition-colors">
          {title}
        </h3>
        <p className="text-[11px] text-slate-500 capitalize mt-0.5">
          {item.type} {isWatched ? "· Watched" : percent > 0 ? `· ${percent}% watched` : ""}
        </p>
      </div>
    </div>
  );
};
