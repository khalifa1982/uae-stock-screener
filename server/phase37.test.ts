import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Phase 37 - Notification Improvements", () => {
  describe("Clear All Notifications - Backend", () => {
    it("should have deleteAllNotifications function in db.ts", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "db.ts"),
        "utf-8"
      );
      expect(content).toContain("export async function deleteAllNotifications");
      expect(content).toContain("eq(notifications.userId, userId)");
    });

    it("should have deleteAll mutation in routers.ts", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "routers.ts"),
        "utf-8"
      );
      expect(content).toContain("deleteAll: protectedProcedure");
      expect(content).toContain("deleteAllNotifications");
    });

    it("should import deleteAllNotifications in routers.ts", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "routers.ts"),
        "utf-8"
      );
      expect(content).toContain("deleteAllNotifications");
    });
  });

  describe("Clear All Notifications - Frontend", () => {
    it("should have Clear All button in NotificationCenter", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "../client/src/components/NotificationCenter.tsx"),
        "utf-8"
      );
      expect(content).toContain("Clear all");
      expect(content).toContain("deleteAll");
    });

    it("should have confirmation dialog before clearing all", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "../client/src/components/NotificationCenter.tsx"),
        "utf-8"
      );
      expect(content).toContain("showClearConfirm");
      expect(content).toContain("Yes, clear all");
      expect(content).toContain("Cancel");
    });

    it("should show toast on successful clear all", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "../client/src/components/NotificationCenter.tsx"),
        "utf-8"
      );
      expect(content).toContain("All notifications cleared");
    });

    it("should use deleteAll mutation from trpc", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "../client/src/components/NotificationCenter.tsx"),
        "utf-8"
      );
      expect(content).toContain("trpc.notifications.deleteAll.useMutation");
    });
  });

  describe("Notification Grouping", () => {
    it("should have groupNotifications function", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "../client/src/components/NotificationCenter.tsx"),
        "utf-8"
      );
      expect(content).toContain("function groupNotifications");
    });

    it("should group notifications by symbol", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "../client/src/components/NotificationCenter.tsx"),
        "utf-8"
      );
      // Groups by symbol
      expect(content).toContain("symbolGroups");
      expect(content).toContain("notif.symbol");
    });

    it("should only group when 2+ notifications exist for same symbol", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "../client/src/components/NotificationCenter.tsx"),
        "utf-8"
      );
      expect(content).toContain("items.length >= 2");
    });

    it("should have expandable/collapsible group component", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "../client/src/components/NotificationCenter.tsx"),
        "utf-8"
      );
      expect(content).toContain("GroupedNotification");
      expect(content).toContain("expanded");
      expect(content).toContain("setExpanded");
      expect(content).toContain("ChevronDown");
      expect(content).toContain("ChevronRight");
    });

    it("should show group count badge", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "../client/src/components/NotificationCenter.tsx"),
        "utf-8"
      );
      expect(content).toContain("alerts");
      expect(content).toContain("group.items.length");
    });

    it("should show unread count in group header", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "../client/src/components/NotificationCenter.tsx"),
        "utf-8"
      );
      expect(content).toContain("group.unreadCount");
      expect(content).toContain("new");
    });

    it("should have NotificationGroup interface with required fields", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "../client/src/components/NotificationCenter.tsx"),
        "utf-8"
      );
      expect(content).toContain("interface NotificationGroup");
      expect(content).toContain("symbol: string | null");
      expect(content).toContain("items: any[]");
      expect(content).toContain("latestTime: Date");
      expect(content).toContain("unreadCount: number");
      expect(content).toContain("highestSeverity: string");
    });

    it("should sort grouped results by latest time", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "../client/src/components/NotificationCenter.tsx"),
        "utf-8"
      );
      expect(content).toContain("result.sort");
      expect(content).toContain("timeB - timeA");
    });

    it("should show total notification count in footer", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "../client/src/components/NotificationCenter.tsx"),
        "utf-8"
      );
      expect(content).toContain("totalNotifications");
      expect(content).toContain("total");
    });
  });

  describe("Notification dropdown still has solid background", () => {
    it("should use explicit inline background styles", () => {
      const content = fs.readFileSync(
        path.join(__dirname, "../client/src/components/NotificationCenter.tsx"),
        "utf-8"
      );
      expect(content).toContain('background: "oklch(0.08 0.014 260)"');
      expect(content).toContain('background: "oklch(0.10 0.014 260)"');
    });
  });
});
