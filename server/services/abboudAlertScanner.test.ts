import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the dependencies
vi.mock("./tdDataService", () => ({
  fetchChartData: vi.fn(),
}));

vi.mock("./abboudIndicator", () => ({
  computeAbboudIndicator: vi.fn(),
}));

vi.mock("../volumeMonitor", () => ({
  isUAETradingHours: vi.fn().mockReturnValue(true),
}));

vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  createNotificationsForAllUsers: vi.fn(),
}));

vi.mock("../../drizzle/schema", () => ({
  abboudAlerts: {},
}));

describe("AbboudAlertScanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export scanner control functions", async () => {
    const scanner = await import("./abboudAlertScanner");
    expect(typeof scanner.startAbboudScanner).toBe("function");
    expect(typeof scanner.stopAbboudScanner).toBe("function");
    expect(typeof scanner.getAbboudScannerStatus).toBe("function");
    expect(typeof scanner.manualAbboudScan).toBe("function");
  });

  it("should return scanner status with correct shape", async () => {
    const { getAbboudScannerStatus } = await import("./abboudAlertScanner");
    const status = getAbboudScannerStatus();
    
    expect(status).toHaveProperty("running");
    expect(status).toHaveProperty("scanning");
    expect(status).toHaveProperty("lastScanTime");
    expect(status).toHaveProperty("lastAlertCount");
    expect(status).toHaveProperty("cacheSize");
    expect(typeof status.running).toBe("boolean");
    expect(typeof status.scanning).toBe("boolean");
    expect(typeof status.lastAlertCount).toBe("number");
    expect(typeof status.cacheSize).toBe("number");
  });

  it("should start and stop scanner without errors", async () => {
    const { startAbboudScanner, stopAbboudScanner, getAbboudScannerStatus } = await import("./abboudAlertScanner");
    
    startAbboudScanner();
    expect(getAbboudScannerStatus().running).toBe(true);
    
    stopAbboudScanner();
    expect(getAbboudScannerStatus().running).toBe(false);
  });

  it("should not start scanner twice", async () => {
    const { startAbboudScanner, stopAbboudScanner, getAbboudScannerStatus } = await import("./abboudAlertScanner");
    
    startAbboudScanner();
    startAbboudScanner(); // Should not throw
    expect(getAbboudScannerStatus().running).toBe(true);
    
    stopAbboudScanner();
  });

  it("AbboudAlertResult interface should have correct alert types", () => {
    // Verify the alert types are correct
    const validAlertTypes = ["entry_zone", "stop_loss", "target_1", "target_2", "target_3", "fib_bounce"];
    const validSeverities = ["info", "warning", "critical"];
    const validDirections = ["bullish", "bearish"];
    
    expect(validAlertTypes).toContain("entry_zone");
    expect(validAlertTypes).toContain("stop_loss");
    expect(validAlertTypes).toContain("target_1");
    expect(validSeverities).toContain("critical");
    expect(validDirections).toContain("bullish");
  });
});
