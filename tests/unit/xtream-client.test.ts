import { describe, it, expect } from "vitest";
import {
  getXtreamConfig,
  buildUpstreamPlayerUrl,
  buildUpstreamStreamUrl,
} from "../../src/lib/xtream-client";

describe("Xtream Client Helper Unit Tests", () => {
  it("should retrieve default Xtream configuration from environment", () => {
    const config = getXtreamConfig();
    expect(config.host).toBeDefined();
    expect(config.username).toBeDefined();
    expect(config.password).toBeDefined();
  });

  it("should build correct upstream player API URL and exclude client-passed credentials", () => {
    const urlString = buildUpstreamPlayerUrl("get_live_categories", {
      username: "malicious_user",
      password: "malicious_password",
      extra: "param1",
    });

    const url = new URL(urlString);
    expect(url.searchParams.get("action")).toBe("get_live_categories");
    expect(url.searchParams.get("username")).toBe("66764023");
    expect(url.searchParams.get("password")).toBe("13715132950979");
    expect(url.searchParams.get("extra")).toBe("param1");
  });

  it("should build correct upstream stream URL for Live TV, Movies, and Series", () => {
    const liveUrl = buildUpstreamStreamUrl("live", "10045", "ts");
    expect(liveUrl).toContain("/live/66764023/13715132950979/10045.ts");

    const movieUrl = buildUpstreamStreamUrl("movie", "45012.mp4");
    expect(movieUrl).toContain("/movie/66764023/13715132950979/45012.mp4");

    const seriesUrl = buildUpstreamStreamUrl("series", "78101", "mkv");
    expect(seriesUrl).toContain("/series/66764023/13715132950979/78101.mkv");
  });
});
