import { APP_VERSION } from "../../shared/const";

export function createHealthStatus(startedAt: number, now = Date.now()) {
  const uptimeMs = Math.max(0, now - startedAt);
  return {
    status: "ok" as const,
    uptime: `${Math.floor(uptimeMs / 1000)}s`,
    version: APP_VERSION,
    timestamp: new Date(now).toISOString(),
  };
}
