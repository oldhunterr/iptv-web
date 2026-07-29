"use client";

import React from "react";
import { RotateCcw, Play, X } from "lucide-react";

interface ResumeBannerProps {
  savedPosition: number;
  duration: number;
  onResume: () => void;
  onStartOver: () => void;
  onDismiss?: () => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  }
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export const ResumeBanner: React.FC<ResumeBannerProps> = ({
  savedPosition,
  duration,
  onResume,
  onStartOver,
  onDismiss,
}) => {
  return (
    <div
      data-testid="resume-banner"
      className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md border border-cyan-500/40 text-white px-5 py-3.5 rounded-xl shadow-2xl flex flex-col sm:flex-row items-center gap-4 transition-all duration-300 max-w-md w-[90%]"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="p-2.5 bg-cyan-500/10 rounded-lg text-cyan-400">
          <RotateCcw className="w-5 h-5 animate-pulse" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100">Resume Playback?</p>
          <p className="text-xs text-slate-400 truncate">
            You previously stopped at <span className="text-cyan-400 font-medium">{formatTime(savedPosition)}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
        <button
          onClick={onResume}
          data-testid="resume-button"
          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-md hover:shadow-cyan-500/25"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          Resume ({formatTime(savedPosition)})
        </button>
        <button
          onClick={onStartOver}
          data-testid="start-over-button"
          className="flex-1 sm:flex-none px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors border border-slate-700"
        >
          Start Over
        </button>
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Close resume prompt"
            className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
