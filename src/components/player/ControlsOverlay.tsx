"use client";

import React, { useEffect, useState } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  X,
  Settings,
} from "lucide-react";

interface ControlsOverlayProps {
  title: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackSpeed: number;
  isFullscreen: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onSpeedChange: (speed: number) => void;
  onToggleFullscreen: () => void;
  onClose?: () => void;
  visible?: boolean;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  }
  return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
}

export const ControlsOverlay: React.FC<ControlsOverlayProps> = ({
  title,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  playbackSpeed,
  isFullscreen,
  onTogglePlay,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onSpeedChange,
  onToggleFullscreen,
  onClose,
  visible = true,
}) => {
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <div
      data-testid="controls-overlay"
      className={`absolute inset-0 z-30 flex flex-col justify-between p-4 bg-gradient-to-t from-black/90 via-black/20 to-black/80 transition-opacity duration-300 pointer-events-auto ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between text-white">
        <h2 className="text-base sm:text-lg font-semibold truncate max-w-[80%]" data-testid="player-title">
          {title}
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            data-testid="close-player-button"
            className="p-2 bg-slate-900/60 hover:bg-red-600/80 rounded-full text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Center Stage Flash Play/Pause */}
      <div
        className="flex-1 flex items-center justify-center cursor-pointer"
        onClick={onTogglePlay}
        data-testid="center-stage-toggle"
      >
        {!isPlaying && (
          <div className="p-5 bg-cyan-600/90 rounded-full text-white shadow-2xl backdrop-blur-md transform transition-transform hover:scale-110">
            <Play className="w-10 h-10 fill-current translate-x-0.5" />
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="flex flex-col gap-2 text-white bg-slate-900/80 p-3 rounded-2xl border border-slate-800 backdrop-blur-md shadow-2xl">
        {/* Seek Bar */}
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            data-testid="seek-bar"
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
            style={{
              background: `linear-gradient(to right, #22d3ee ${progressPercent}%, #334155 ${progressPercent}%)`,
            }}
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Play/Pause Button */}
            <button
              onClick={onTogglePlay}
              data-testid="play-pause-button"
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-200 hover:text-cyan-400 transition-colors"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
            </button>

            {/* Rewind / Fast-Forward */}
            <button
              onClick={() => onSeek(Math.max(0, currentTime - 5))}
              data-testid="seek-minus-button"
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"
              title="Rewind 5s"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => onSeek(Math.min(duration, currentTime + 5))}
              data-testid="seek-plus-button"
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"
              title="Forward 5s"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Volume Controls */}
            <div className="flex items-center gap-1 group">
              <button
                onClick={onToggleMute}
                data-testid="mute-button"
                className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                data-testid="volume-slider"
                className="w-16 sm:w-20 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Current Time / Duration */}
            <span className="text-xs font-mono text-slate-300 select-none" data-testid="time-display">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Speed Selector */}
            <div className="relative">
              <select
                value={playbackSpeed}
                onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
                data-testid="speed-select"
                className="bg-slate-800 text-xs font-medium text-slate-200 border border-slate-700 rounded-lg px-2 py-1 focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                {speeds.map((s) => (
                  <option key={s} value={s}>
                    {s}x
                  </option>
                ))}
              </select>
            </div>

            {/* Fullscreen Button */}
            <button
              onClick={onToggleFullscreen}
              data-testid="fullscreen-button"
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-cyan-400 transition-colors"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
