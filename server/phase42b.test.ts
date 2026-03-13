import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Phase 42b: Chart Zoom & Aboood.AI Overlay Visual Improvements", () => {
  const overlayPath = join(__dirname, "../client/src/components/AbboudIndicatorOverlay.tsx");
  const chartPath = join(__dirname, "../client/src/components/AdvancedChart.tsx");
  const overlayCode = readFileSync(overlayPath, "utf-8");
  const chartCode = readFileSync(chartPath, "utf-8");

  describe("Overlay Visual Enhancements", () => {
    it("should have SVG glow filter defined for line effects", () => {
      expect(overlayCode).toContain("feGaussianBlur");
      expect(overlayCode).toContain("feMerge");
      expect(overlayCode).toContain("abood-overlay");
    });

    it("should have drop shadow filter for label boxes", () => {
      expect(overlayCode).toContain("feDropShadow");
      expect(overlayCode).toContain("abood-overlay");
      expect(overlayCode).toContain("-shadow");
    });

    it("should have entry zone gradient fill", () => {
      expect(overlayCode).toContain("entry-grad");
      expect(overlayCode).toContain("linearGradient");
    });

    it("should have animated pulsing border on entry zone", () => {
      expect(overlayCode).toContain("abboud-pulse");
      expect(overlayCode).toContain("abboud-entry-border");
      expect(overlayCode).toContain("animation:");
    });

    it("should have thicker fibonacci lines (1.8px)", () => {
      expect(overlayCode).toContain('strokeWidth={1.8}');
    });

    it("should have glow effect behind fib lines", () => {
      // Fib lines should have a wider glow line behind them
      expect(overlayCode).toContain('strokeWidth={4}');
      expect(overlayCode).toContain('opacity={0.15}');
    });

    it("should have stop loss line with 3px width", () => {
      // Stop loss uses drawLabeledLine with lineWidth 3
      expect(overlayCode).toMatch(/stopLoss[\s\S]*?3,\s*\n\s*"12 6"/);
    });

    it("should have target lines with 2.5px width", () => {
      // Targets use drawLabeledLine with lineWidth 2.5
      expect(overlayCode).toMatch(/target[\s\S]*?2\.5,\s*\n\s*"10 5"/);
    });

    it("should have swing high triangle marker", () => {
      expect(overlayCode).toContain("polygon");
      expect(overlayCode).toContain("swing-high");
    });

    it("should have swing low inverted triangle marker", () => {
      expect(overlayCode).toContain("swing-low");
    });

    it("should have current price marker with arrow", () => {
      expect(overlayCode).toContain("current-price-marker");
      expect(overlayCode).toContain("currentPrice");
    });

    it("should have projection path with gradient stroke", () => {
      expect(overlayCode).toContain("proj-grad");
      expect(overlayCode).toContain("projectionBright");
    });

    it("should have animated projection dots", () => {
      expect(overlayCode).toContain("abboud-proj-dot");
      expect(overlayCode).toContain("abboud-dot-pulse");
    });

    it("should have larger label boxes (100px for stop/target)", () => {
      // drawLabeledLine is called with labelWidth 100
      expect(overlayCode).toContain("100,");
    });
  });

  describe("Chart Zoom Controls", () => {
    it("should have ZoomIn and ZoomOut buttons in toolbar", () => {
      expect(chartCode).toContain("onZoomIn");
      expect(chartCode).toContain("onZoomOut");
      expect(chartCode).toContain("ZoomIn");
      expect(chartCode).toContain("ZoomOut");
    });

    it("should have handleZoomIn function that narrows visible range", () => {
      expect(chartCode).toContain("handleZoomIn");
      expect(chartCode).toContain("visibleLen * 0.15");
    });

    it("should have handleZoomOut function that widens visible range", () => {
      expect(chartCode).toContain("handleZoomOut");
      expect(chartCode).toContain("visibleLen * 0.2");
    });

    it("should have mouse wheel zoom with Ctrl/Cmd support", () => {
      expect(chartCode).toContain("e.ctrlKey");
      expect(chartCode).toContain("e.metaKey");
      expect(chartCode).toContain("e.deltaY");
      expect(chartCode).toContain("chartContainerRef");
    });

    it("should have reset zoom button", () => {
      expect(chartCode).toContain("handleResetZoom");
      expect(chartCode).toContain("RotateCcw");
    });
  });

  describe("Aboood.AI Naming", () => {
    it("should use Aboood.AI Thoughts in signal card", () => {
      expect(overlayCode).toContain("Aboood.AI Thoughts");
    });

    it("should use Aboood.AI in toggle button", () => {
      expect(chartCode).toContain('"Aboood.AI"');
    });

    it("should NOT contain old Abboud AI display text", () => {
      expect(overlayCode).not.toContain('"Abboud AI"');
      expect(chartCode).not.toContain('"Abboud AI"');
    });
  });
});
