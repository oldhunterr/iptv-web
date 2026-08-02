"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { SkipTimestamps } from "@/types/iptv";
import { getWatchProgress, saveWatchProgress } from "@/lib/storage";
import { ControlsOverlay } from "./ControlsOverlay";
import { SkipOverlay } from "./SkipOverlay";
import { ResumeBanner } from "./ResumeBanner";

export interface VideoPlayerProps {
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
  customSkipData?: SkipTimestamps | null;
  onClose?: () => void;
  autoPlay?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  title,
  itemKey,
  streamId,
  section,
  poster,
  backdrop,
  containerExtension = "mp4",
  tvdbId,
  tmdbId,
  seasonNum,
  episodeNum,
  seriesId,
  customSkipData,
  onClose,
  autoPlay = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<any>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [savedResumePosition, setSavedResumePosition] = useState<number | null>(null);
  const [hasPromptedResume, setHasPromptedResume] = useState(false);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check saved progress for ResumeBanner on initial mount
  useEffect(() => {
    const saved = getWatchProgress(itemKey);
    if (saved && saved.lastPosition > 10 && saved.duration > 0 && saved.duration - saved.lastPosition > 20) {
      setSavedResumePosition(saved.lastPosition);
    }
  }, [itemKey]);

  // HLS / HTML5 Video initialization
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    const isOfflineLocalFile = src.includes("/api/download");
    const isHls = !isOfflineLocalFile && (src.includes(".m3u8") || containerExtension === "m3u8");
    const isTs = !isOfflineLocalFile && (src.includes(".ts") || containerExtension === "ts");

    if (isHls && Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoPlay) {
          video.play().catch((e) => console.warn("Autoplay blocked:", e));
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });
    } else if (isTs) {
      import("mpegts.js").then((mpegtsModule) => {
        const mpegts = mpegtsModule.default || mpegtsModule;
        if (!mpegts.isSupported()) {
          video.src = src;
          if (autoPlay) {
            video.play().catch((e) => console.warn("Autoplay blocked:", e));
          }
          return;
        }
        
        if (mpegtsRef.current) {
          mpegtsRef.current.destroy();
        }
        const player = mpegts.createPlayer({
          type: 'mpegts',
          isLive: section === 'live',
          url: src,
        });
        mpegtsRef.current = player;
        player.attachMediaElement(video);
        player.load();
        if (autoPlay) {
          const playPromise = player.play();
          if (playPromise !== undefined) {
            playPromise.catch((e: any) => console.warn("Autoplay blocked:", e));
          }
        }
      }).catch(err => {
        console.error("Failed to load mpegts.js", err);
        video.src = src;
      });
    } else {
      video.src = src;
      if (autoPlay) {
        video.play().catch((e) => console.warn("Autoplay blocked:", e));
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (mpegtsRef.current) {
        mpegtsRef.current.destroy();
        mpegtsRef.current = null;
      }
    };
  }, [src, section, containerExtension, autoPlay]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration || 0);
    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("durationchange", handleDurationChange);
    video.addEventListener("volumechange", handleVolumeChange);

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", handleDurationChange);
      video.removeEventListener("volumechange", handleVolumeChange);
    };
  }, []);

  // Watch progress saving interval (every 4 seconds) and cleanup
  useEffect(() => {
    const saveProgress = () => {
      const video = videoRef.current;
      if (video && video.duration > 0 && video.currentTime > 2) {
        saveWatchProgress({
          key: itemKey,
          id: streamId,
          section,
          title,
          poster,
          backdrop,
          lastPosition: Math.floor(video.currentTime),
          duration: Math.floor(video.duration),
          streamUrl: src,
          streamId,
          containerExtension,
          seriesId,
          seasonNum,
          episodeNum,
          tvdbId,
        });
      }
    };

    const intervalId = setInterval(saveProgress, 4000);
    return () => {
      clearInterval(intervalId);
      saveProgress();
    };
  }, [itemKey, streamId, section, title, poster, backdrop, src, containerExtension, seriesId, seasonNum, episodeNum, tvdbId]);

  // Controls auto-hide on mouse inactivity
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        !!(
          document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement ||
          (document as any).msFullscreenElement
        )
      );
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, []);

  // Keyboard Shortcuts Handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;

      // Ignore shortcut key triggers when typing in text fields
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      switch (e.code) {
        case "Space":
          e.preventDefault();
          if (video.paused) video.play();
          else video.pause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 5);
          break;
        case "ArrowRight":
          e.preventDefault();
          video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
          break;
        case "ArrowUp":
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          break;
        case "ArrowDown":
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          break;
        case "KeyF":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "KeyM":
          e.preventDefault();
          video.muted = !video.muted;
          break;
        default:
          break;
      }
    },
    []
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  };

  const handleSeek = (time: number) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    const video = videoRef.current;
    if (video) {
      video.volume = newVol;
      video.muted = newVol === 0;
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (video) {
      video.muted = !video.muted;
    }
  };

  const handleSpeedChange = (speed: number) => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = speed;
      setPlaybackSpeed(speed);
    }
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current as any;
    const video = videoRef.current as any;
    if (!container) return;

    const isFullscreen =
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement;

    if (!isFullscreen) {
      try {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
          container.webkitRequestFullscreen();
        } else if (container.mozRequestFullScreen) {
          container.mozRequestFullScreen();
        } else if (container.msRequestFullscreen) {
          container.msRequestFullscreen();
        } else if (video && video.webkitEnterFullscreen) {
          // Fallback for iOS Safari which only allows fullscreen on video elements
          video.webkitEnterFullscreen();
        }
      } catch (err) {
        console.error("Container fullscreen failed, trying fallback:", err);
        if (video) {
          try {
            if (video.requestFullscreen) {
              await video.requestFullscreen();
            } else if (video.webkitEnterFullscreen) {
              video.webkitEnterFullscreen();
            }
          } catch (fallbackErr) {
            console.error("Fallback fullscreen also failed:", fallbackErr);
          }
        }
      }
    } else {
      const doc = document as any;
      try {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          doc.msExitFullscreen();
        }
      } catch (err) {
        console.error("Exit fullscreen error:", err);
      }
    }
  };

  const handleDoubleClickContainer = () => {
    toggleFullscreen();
  };

  const handleResumeClick = () => {
    if (savedResumePosition !== null) {
      handleSeek(savedResumePosition);
    }
    setHasPromptedResume(true);
  };

  const handleStartOverClick = () => {
    handleSeek(0);
    setHasPromptedResume(true);
  };

  return (
    <div
      ref={containerRef}
      data-testid="video-player-container"
      onMouseMove={handleMouseMove}
      onDoubleClick={handleDoubleClickContainer}
      className="relative w-full h-full bg-black overflow-hidden select-none group"
    >
      <video
        ref={videoRef}
        data-testid="video-element"
        poster={poster}
        className="w-full h-full object-contain"
        playsInline
      />

      {/* Resume Playback Banner */}
      {savedResumePosition !== null && !hasPromptedResume && (
        <ResumeBanner
          savedPosition={savedResumePosition}
          duration={duration}
          onResume={handleResumeClick}
          onStartOver={handleStartOverClick}
          onDismiss={() => setHasPromptedResume(true)}
        />
      )}

      {/* Skip Intro Overlays */}
      <SkipOverlay
        currentTime={currentTime}
        tvdbId={tvdbId}
        tmdbId={tmdbId}
        season={seasonNum}
        episode={episodeNum}
        onSeek={handleSeek}
        customSkipData={customSkipData}
      />

      {/* Custom Player Controls Overlay */}
      <ControlsOverlay
        title={title}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        isMuted={isMuted}
        playbackSpeed={playbackSpeed}
        isFullscreen={isFullscreen}
        isOfflineLocalFile={src.includes("/api/download")}
        onTogglePlay={togglePlay}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onToggleMute={toggleMute}
        onSpeedChange={handleSpeedChange}
        onToggleFullscreen={toggleFullscreen}
        onClose={onClose}
        visible={showControls || !isPlaying}
      />
    </div>
  );
};
