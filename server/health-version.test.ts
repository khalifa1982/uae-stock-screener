import { describe, expect, it } from "vitest";
import { APP_VERSION } from "../shared/const";
import { createHealthStatus } from "./_core/health";

describe("health endpoint payload", () => {
  it("reports the canonical shared application version", () => {
    const result = createHealthStatus(1_000, 4_500);

    expect(result).toEqual({
      status: "ok",
      uptime: "3s",
      version: APP_VERSION,
      timestamp: new Date(4_500).toISOString(),
    });
    expect(result.version).toBe("v17.2.0");
  });
});
