"use client";

import React from "react";
import { Play, Check, Trash2, Download, HardDrive } from "lucide-react";
import { Episode } from "@/types/iptv";
import { getWatchProgress, removeFromHistory } from "@/lib/storage";

interface EpisodeListProps {
  episodes: Episode[];
  seriesId: string | number;
  seasonNum: number;
  seriesTitle: string;
  poster?: string;
  downloadedStreamIds?: Set<string | number>;
  onPlayEpisode: (episode: Episode) => void;
}

export const EpisodeList: React.FC<EpisodeListProps> = ({
  episodes,
  seriesId,
  seasonNum,
  seriesTitle,
  poster,
  downloadedStreamIds,
  onPlayEpisode,
}) => {
  const handleDownloadEpisode = async (ep: Episode) => {
    const streamId = ep.id;
    const title = `${seriesTitle} — S${seasonNum < 10 ? "0" : ""}${seasonNum}E${
      ep.episode_num < 10 ? "0" : ""
    }${ep.episode_num} · ${ep.title || "Episode"}`;
    const containerExtension = ep.container_extension || "mp4";
    const thumbUrl = ep.info?.movie_image || ep.cover_big || poster;

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          streamId,
          type: "series",
          title,
          containerExtension,
          poster: thumbUrl,
        }),
      });

      if (res.ok) {
        alert("Episode download started! Check Settings > Downloads for progress.");
      } else {
        const data = await res.json();
        alert(`Download failed: ${data.error || "Server error"}`);
      }
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    }
  };
  if (!episodes || episodes.length === 0) {
    return (
      <div className="py-12 text-center text-theme-muted">
        <p>No episodes available for {seasonNum === 0 ? "Specials" : `Season ${seasonNum}`}.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4" data-testid="episode-list">
      {episodes.map((ep) => {
        const itemKey = `series_${seriesId}_s${seasonNum}e${ep.episode_num}_${ep.id}`;
        const historyItem = getWatchProgress(itemKey);

        const lastPos = historyItem?.lastPosition || 0;
        const dur = historyItem?.duration || ep.info?.duration_secs || 0;
        const percent = dur > 0 ? Math.min(100, Math.floor((lastPos / dur) * 100)) : 0;
        const isCompleted = percent >= 90;

        const thumbUrl = ep.info?.movie_image || ep.cover_big || poster;
        const displayTitle = ep.title
          ? ep.title.startsWith(`${ep.episode_num}.`) || ep.title.startsWith(`E${ep.episode_num}`)
            ? ep.title
            : `${ep.episode_num}. ${ep.title}`
          : `Episode ${ep.episode_num}`;

        return (
          <div
            key={ep.id || ep.episode_num}
            data-testid={`episode-card-${ep.episode_num}`}
            className="flex flex-col sm:flex-row bg-surface/80 hover:bg-surface-hover/80 rounded-xl border border-border-subtle hover:border-accent-primary/45 overflow-hidden transition-all duration-200 group"
          >
            {/* Thumbnail */}
            <div className="relative sm:w-40 h-28 shrink-0 bg-app flex items-center justify-center overflow-hidden">
              {thumbUrl ? (
                <img
                  src={thumbUrl}
                  alt={ep.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              ) : (
                <div className="text-slate-600 font-bold text-lg">E{ep.episode_num}</div>
              )}
              {isCompleted && (
                <div className="absolute top-2 right-2 bg-emerald-500 text-black p-1 rounded-full shadow">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
              {percent > 0 && !isCompleted && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-border-subtle">
                  <div
                    className="h-full bg-accent-primary"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-theme-primary truncate group-hover:text-accent-primary transition-colors">
                    {displayTitle}
                  </h4>
                  {ep.info?.duration && (
                    <span className="text-[11px] font-mono text-theme-muted shrink-0">
                      {ep.info.duration}
                    </span>
                  )}
                </div>
                {ep.info?.plot && (
                  <p className="text-xs text-theme-muted line-clamp-2 mt-1">
                    {ep.info.plot}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-border-subtle/80">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onPlayEpisode(ep)}
                    data-testid={`play-episode-${ep.episode_num}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary hover:bg-accent-hover text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    {percent > 0 ? `Resume (${percent}%)` : "Play Episode"}
                  </button>

                  {downloadedStreamIds && downloadedStreamIds.has(String(ep.id)) ? (
                    <span
                      title="Episode Downloaded Offline"
                      data-testid={`episode-downloaded-${ep.episode_num}`}
                      className="flex items-center gap-1 px-2.5 py-1 bg-emerald-950/90 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/50"
                    >
                      <HardDrive className="w-3.5 h-3.5" />
                      <span>Downloaded</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => handleDownloadEpisode(ep)}
                      title="Download Episode Offline"
                      data-testid={`download-episode-${ep.episode_num}`}
                      className="p-1.5 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/60 rounded-lg transition-colors border border-cyan-500/30"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {historyItem && (
                  <button
                    onClick={() => removeFromHistory(itemKey)}
                    title="Remove from Watch History"
                    data-testid={`remove-history-${ep.episode_num}`}
                    className="p-1.5 text-theme-muted hover:text-red-400 hover:bg-surface-hover rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
