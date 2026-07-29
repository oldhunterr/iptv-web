"use client";

import React, { useEffect, useState } from "react";
import { SkipForward } from "lucide-react";
import { SkipTimestamps, SkipTimestampSegment } from "@/types/iptv";
import { fetchSkipTimestamps } from "@/lib/api-client";

interface SkipOverlayProps {
  currentTime: number;
  tvdbId?: string | number;
  tmdbId?: string | number;
  season?: string | number;
  episode?: string | number;
  onSeek: (targetTime: number) => void;
  customSkipData?: SkipTimestamps | null;
}

function normalizeSegment(segRaw: any): SkipTimestampSegment | null {
  if (!segRaw) return null;
  const seg = Array.isArray(segRaw) ? segRaw[0] : segRaw;
  if (!seg) return null;
  let start = seg.start_ms !== undefined ? seg.start_ms : seg.start;
  let end = seg.end_ms !== undefined ? seg.end_ms : seg.end;
  if (typeof start !== "number" || typeof end !== "number") return null;
  // If values are in milliseconds (e.g., > 10000), convert to seconds
  if (start > 10000 || end > 10000 || seg.start_ms !== undefined) {
    start = start / 1000;
    end = end / 1000;
  }
  if (end <= start) return null;
  return { start, end };
}

export const SkipOverlay: React.FC<SkipOverlayProps> = ({
  currentTime,
  tvdbId,
  tmdbId,
  season,
  episode,
  onSeek,
  customSkipData,
}) => {
  const [skipData, setSkipData] = useState<SkipTimestamps | null>(customSkipData || null);

  useEffect(() => {
    if (customSkipData) {
      setSkipData(customSkipData);
      return;
    }

    const idToUse = tmdbId !== undefined && tmdbId !== null && String(tmdbId).trim() !== "" ? tmdbId : tvdbId;
    const idType = tmdbId !== undefined && tmdbId !== null && String(tmdbId).trim() !== "" ? "tmdb" : "tvdb";

    if (idToUse !== undefined && season !== undefined && episode !== undefined) {
      let isMounted = true;
      fetchSkipTimestamps(idToUse, season, episode, idType)
        .then((data) => {
          if (isMounted) setSkipData(data);
        })
        .catch(() => {
          if (isMounted) setSkipData(null);
        });
      return () => {
        isMounted = false;
      };
    }
  }, [tvdbId, tmdbId, season, episode, customSkipData]);

  if (!skipData) return null;

  const intro = normalizeSegment(skipData.intro);
  const recap = normalizeSegment(skipData.recap);
  const credits = normalizeSegment(skipData.credits);

  let activeType: "intro" | "recap" | "credits" | null = null;
  let activeSegment: SkipTimestampSegment | null = null;

  if (intro && currentTime >= intro.start && currentTime < intro.end) {
    activeType = "intro";
    activeSegment = intro;
  } else if (recap && currentTime >= recap.start && currentTime < recap.end) {
    activeType = "recap";
    activeSegment = recap;
  } else if (credits && currentTime >= credits.start && currentTime < credits.end) {
    activeType = "credits";
    activeSegment = credits;
  }

  if (!activeType || !activeSegment) return null;

  const label =
    activeType === "intro"
      ? "Skip Intro"
      : activeType === "recap"
      ? "Skip Recap"
      : "Skip Outro";

  return (
    <div
      data-testid="skip-overlay-container"
      className="absolute bottom-32 right-10 z-40 animate-fade-in"
    >
      <button
        onClick={() => onSeek(activeSegment!.end)}
        data-testid={`skip-${activeType}-button`}
        className="flex items-center gap-2 px-4 py-2.5 bg-slate-900/90 hover:bg-cyan-600 text-white font-medium text-sm rounded-xl border border-cyan-500/50 shadow-lg shadow-black/50 backdrop-blur-md transition-all duration-200 hover:scale-105"
      >
        <SkipForward className="w-4 h-4 fill-current text-cyan-400" />
        <span>{label}</span>
      </button>
    </div>
  );
};
