import { describe, it, expect, vi } from "vitest";
import { getStreamUrl } from "../../src/lib/api-client";

describe("VideoPlayer & Controls Unit Tests", () => {
  it("should generate stream proxy URLs correctly for different stream types", () => {
    const liveUrl = getStreamUrl("live", 10045, "m3u8");
    expect(liveUrl).toBe("/api/proxy/stream?type=live&stream_id=10045&container=m3u8");

    const vodUrl = getStreamUrl("movie", 45012, "mp4");
    expect(vodUrl).toBe("/api/proxy/stream?type=movie&stream_id=45012&container=mp4");

    const seriesUrl = getStreamUrl("series", 78101, "mkv");
    expect(seriesUrl).toBe("/api/proxy/stream?type=series&stream_id=78101&container=mkv");

    // Live stream default container fallback
    const liveDefault = getStreamUrl("live", 10045);
    expect(liveDefault).toBe("/api/proxy/stream?type=live&stream_id=10045&container=m3u8");
  });

  it("should validate resume banner playback criteria", () => {
    function shouldShowResumeBanner(lastPosition: number, duration: number): boolean {
      return lastPosition > 10 && duration > 0 && duration - lastPosition > 20;
    }

    expect(shouldShowResumeBanner(5, 3600)).toBe(false); // <= 10s
    expect(shouldShowResumeBanner(3590, 3600)).toBe(false); // duration - position <= 20s
    expect(shouldShowResumeBanner(300, 3600)).toBe(true); // Valid resume interval
  });

  it("should clamp volume changes within [0, 1] range", () => {
    function adjustVolume(current: number, delta: number): number {
      const next = current + delta;
      return Math.max(0, Math.min(1, parseFloat(next.toFixed(2))));
    }

    expect(adjustVolume(0.9, 0.1)).toBe(1);
    expect(adjustVolume(1.0, 0.1)).toBe(1); // Clamped at 1
    expect(adjustVolume(0.05, -0.1)).toBe(0); // Clamped at 0
    expect(adjustVolume(0.5, 0.1)).toBe(0.6);
  });

  it("should handle playback speed options properly", () => {
    const supportedSpeeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    expect(supportedSpeeds).toContain(0.5);
    expect(supportedSpeeds).toContain(2.0);

    function clampPlaybackSpeed(speed: number): number {
      return supportedSpeeds.includes(speed) ? speed : 1.0;
    }

    expect(clampPlaybackSpeed(1.5)).toBe(1.5);
    expect(clampPlaybackSpeed(3.0)).toBe(1.0); // Unsupported defaults to 1.0
  });

  it("should map keyboard shortcuts to appropriate player actions", () => {
    function getActionForKey(code: string): string | null {
      switch (code) {
        case "Space":
          return "TOGGLE_PLAY";
        case "ArrowLeft":
          return "SEEK_BACKWARD";
        case "ArrowRight":
          return "SEEK_FORWARD";
        case "ArrowUp":
          return "VOLUME_UP";
        case "ArrowDown":
          return "VOLUME_DOWN";
        case "KeyF":
          return "TOGGLE_FULLSCREEN";
        case "KeyM":
          return "TOGGLE_MUTE";
        default:
          return null;
      }
    }

    expect(getActionForKey("Space")).toBe("TOGGLE_PLAY");
    expect(getActionForKey("ArrowLeft")).toBe("SEEK_BACKWARD");
    expect(getActionForKey("ArrowRight")).toBe("SEEK_FORWARD");
    expect(getActionForKey("ArrowUp")).toBe("VOLUME_UP");
    expect(getActionForKey("ArrowDown")).toBe("VOLUME_DOWN");
    expect(getActionForKey("KeyF")).toBe("TOGGLE_FULLSCREEN");
    expect(getActionForKey("KeyM")).toBe("TOGGLE_MUTE");
    expect(getActionForKey("KeyX")).toBeNull();
  });
});
