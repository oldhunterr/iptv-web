import { describe, it, expect, vi } from "vitest";
import React from "react";
import { SkipTimestamps, SkipTimestampSegment } from "../../src/types/iptv";

// Utility logic extractor for skip overlay segment matching & normalization
function normalizeSegment(seg: SkipTimestampSegment | null | undefined): SkipTimestampSegment | null {
  if (!seg || typeof seg.start !== "number" || typeof seg.end !== "number") return null;
  let start = seg.start;
  let end = seg.end;
  if (start > 10000 || end > 10000) {
    start = start / 1000;
    end = end / 1000;
  }
  if (end <= start) return null;
  return { start, end };
}

function getActiveSkipSegment(
  currentTime: number,
  skipData: SkipTimestamps | null
): { type: "intro" | "recap" | "credits"; segment: SkipTimestampSegment } | null {
  if (!skipData) return null;

  const intro = normalizeSegment(skipData.intro);
  const recap = normalizeSegment(skipData.recap);
  const credits = normalizeSegment(skipData.credits);

  if (intro && currentTime >= intro.start && currentTime < intro.end) {
    return { type: "intro", segment: intro };
  }
  if (recap && currentTime >= recap.start && currentTime < recap.end) {
    return { type: "recap", segment: recap };
  }
  if (credits && currentTime >= credits.start && currentTime < credits.end) {
    return { type: "credits", segment: credits };
  }

  return null;
}

describe("TheIntroDB Skip Overlay Logic Unit Tests", () => {
  const mockSkipData: SkipTimestamps = {
    tvdb_id: 121361,
    season: 1,
    episode: 1,
    recap: { start: 5, end: 25 },
    intro: { start: 90, end: 175 },
    credits: { start: 2400, end: 2520 },
  };

  const mockMsSkipData: SkipTimestamps = {
    tvdb_id: 121361,
    season: 1,
    episode: 2,
    intro: { start: 60000, end: 120000 }, // 60s to 120s in ms
  };

  it("should normalize millisecond timestamps to seconds", () => {
    const normalized = normalizeSegment(mockMsSkipData.intro);
    expect(normalized).toEqual({ start: 60, end: 120 });
  });

  it("should detect active recap segment correctly", () => {
    const matchBefore = getActiveSkipSegment(2, mockSkipData);
    expect(matchBefore).toBeNull();

    const matchActive = getActiveSkipSegment(15, mockSkipData);
    expect(matchActive).not.toBeNull();
    expect(matchActive?.type).toBe("recap");
    expect(matchActive?.segment.end).toBe(25);

    const matchAfter = getActiveSkipSegment(30, mockSkipData);
    expect(matchAfter).toBeNull();
  });

  it("should detect active intro segment correctly", () => {
    const matchActive = getActiveSkipSegment(100, mockSkipData);
    expect(matchActive).not.toBeNull();
    expect(matchActive?.type).toBe("intro");
    expect(matchActive?.segment.end).toBe(175);
  });

  it("should detect active credits segment correctly", () => {
    const matchActive = getActiveSkipSegment(2450, mockSkipData);
    expect(matchActive).not.toBeNull();
    expect(matchActive?.type).toBe("credits");
    expect(matchActive?.segment.end).toBe(2520);
  });

  it("should handle millisecond timestamps active window", () => {
    const matchActive = getActiveSkipSegment(90, mockMsSkipData);
    expect(matchActive).not.toBeNull();
    expect(matchActive?.type).toBe("intro");
    expect(matchActive?.segment.end).toBe(120);
  });

  it("should simulate seek action when skip button is clicked", () => {
    const onSeekMock = vi.fn();
    const active = getActiveSkipSegment(100, mockSkipData);

    if (active) {
      onSeekMock(active.segment.end);
    }

    expect(onSeekMock).toHaveBeenCalledWith(175);
  });
});
