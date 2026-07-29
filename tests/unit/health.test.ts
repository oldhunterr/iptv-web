import { describe, it, expect } from "vitest";
import { GET, OPTIONS } from "../../src/app/api/health/route";

describe("Health API Route Unit Tests", () => {
  it("GET /api/health should return status 200 with status ok and timestamp", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("OPTIONS /api/health should return status 200 with CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });
});
