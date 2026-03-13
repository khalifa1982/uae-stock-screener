import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Phase 36 Bug Fixes", () => {
  describe("Notification dropdown background", () => {
    it("should use explicit inline background styles for notification dropdown", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "../client/src/components/NotificationCenter.tsx"),
        "utf-8"
      );
      // The dropdown panel should use inline style with oklch background, not just bg-card
      expect(content).toContain('background: "oklch(0.08 0.014 260)"');
      // Header should have explicit background
      expect(content).toContain('background: "oklch(0.10 0.014 260)"');
      // Should NOT rely solely on bg-card for the dropdown panel
      expect(content).not.toMatch(/className=.*bg-card.*z-\[200\]/);
    });

    it("should have solid background on notification items for unread state", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "../client/src/components/NotificationCenter.tsx"),
        "utf-8"
      );
      // Unread items should use explicit background instead of bg-primary/5
      expect(content).toContain('background: "oklch(0.12 0.02 260)"');
      // Should NOT use transparent bg-primary/5 for unread items
      expect(content).not.toContain("bg-primary/5");
    });

    it("should have z-index 200 on notification dropdown", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "../client/src/components/NotificationCenter.tsx"),
        "utf-8"
      );
      expect(content).toContain("z-[200]");
    });
  });

  describe("Duplicate LIVE indicator removal", () => {
    it("should NOT have MarketStatusBadge in StockDetail page", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "../client/src/pages/StockDetail.tsx"),
        "utf-8"
      );
      expect(content).not.toContain("MarketStatusBadge");
      expect(content).not.toContain('import { MarketStatusBadge }');
    });

    it("should NOT have MarketStatusBadge in Calendar page", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "../client/src/pages/Calendar.tsx"),
        "utf-8"
      );
      expect(content).not.toContain("MarketStatusBadge");
    });

    it("should NOT have duplicate LIVE badge in Heatmap page", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "../client/src/pages/Heatmap.tsx"),
        "utf-8"
      );
      // Should not have a standalone LIVE badge (the header already has one)
      expect(content).not.toMatch(/>\s*LIVE\s*</);
    });

    it("should keep MarketStatusBadge only in layout components (TerminalLayout, DashboardLayout)", () => {
      const terminalLayout = fs.readFileSync(
        path.join(__dirname, "../client/src/components/TerminalLayout.tsx"),
        "utf-8"
      );
      const dashboardLayout = fs.readFileSync(
        path.join(__dirname, "../client/src/components/DashboardLayout.tsx"),
        "utf-8"
      );
      // These layout components SHOULD have MarketStatusBadge
      expect(terminalLayout).toContain("MarketStatusBadge");
      expect(dashboardLayout).toContain("MarketStatusBadge");
    });
  });

  describe("Data connection indicator", () => {
    it("should export DataConnectionIndicator from RealtimeIndicator", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "../client/src/components/RealtimeIndicator.tsx"),
        "utf-8"
      );
      expect(content).toContain("export function DataConnectionIndicator");
    });

    it("should show Synced state when connected", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "../client/src/components/RealtimeIndicator.tsx"),
        "utf-8"
      );
      expect(content).toContain("Synced");
    });

    it("should show Live state when market is active but WS disconnected", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "../client/src/components/RealtimeIndicator.tsx"),
        "utf-8"
      );
      // Changed from "Polling" to "Live" - shows green indicator instead of alarming amber
      expect(content).toContain("Live");
    });

    it("should show Offline state with red color when market is closed", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "../client/src/components/RealtimeIndicator.tsx"),
        "utf-8"
      );
      expect(content).toContain("Offline");
      expect(content).toContain("text-red-400");
    });

    it("should use DataConnectionIndicator in StockDetail instead of old RealtimeIndicator", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "../client/src/pages/StockDetail.tsx"),
        "utf-8"
      );
      expect(content).toContain("DataConnectionIndicator");
      // Should import DataConnectionIndicator, not the old RealtimeIndicator component
      expect(content).toContain('import { DataConnectionIndicator } from "@/components/RealtimeIndicator"');
      // Should not use <RealtimeIndicator as a JSX element
      expect(content).not.toMatch(/<RealtimeIndicator\s/);
    });

    it("should have three states: Synced (green), Live (green), Offline (red)", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "../client/src/components/RealtimeIndicator.tsx"),
        "utf-8"
      );
      // Green for connected and live polling
      expect(content).toContain("text-emerald-400");
      // Red for offline
      expect(content).toContain("text-red-400");
    });
  });
});
