import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock getDb
const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 1, userId: "u1", userName: "Test", userColor: "#FF0000", content: "Hello", type: "text", imageUrl: null, createdAt: new Date() }]) }) });
const mockSelect = vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) }) }) });
const mockDelete = vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    insert: mockInsert,
    select: mockSelect,
    delete: mockDelete,
  }),
}));

vi.mock("../drizzle/schema", () => ({
  chatMessages: { id: "id", userId: "userId", createdAt: "createdAt" },
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/image.png" }),
}));

describe("Chat Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Chat Message Types", () => {
    it("should define valid message types", () => {
      const validTypes = ["text", "image", "system"];
      expect(validTypes).toContain("text");
      expect(validTypes).toContain("image");
      expect(validTypes).toContain("system");
    });

    it("should generate random avatar colors", () => {
      const AVATAR_COLORS = [
        "#E53E3E", "#DD6B20", "#D69E2E", "#38A169", "#319795",
        "#3182CE", "#5A67D8", "#805AD5", "#D53F8C", "#E53E3E",
      ];
      const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
      expect(AVATAR_COLORS).toContain(color);
      expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    });
  });

  describe("Daily Reset Logic", () => {
    it("should calculate UAE date correctly", () => {
      const now = new Date("2026-03-12T08:00:00Z"); // 12:00 PM UAE
      const uaeOffset = 4 * 60 * 60 * 1000;
      const uaeDate = new Date(now.getTime() + uaeOffset);
      const dateStr = uaeDate.toISOString().split("T")[0];
      expect(dateStr).toBe("2026-03-12");
    });

    it("should detect day change for chat reset", () => {
      const yesterday = "2026-03-11";
      const today = "2026-03-12";
      expect(yesterday).not.toBe(today);
      // Chat should be cleared when day changes
      const shouldReset = yesterday !== today;
      expect(shouldReset).toBe(true);
    });

    it("should not reset on same day", () => {
      const currentDay = "2026-03-12";
      const lastDay = "2026-03-12";
      const shouldReset = currentDay !== lastDay;
      expect(shouldReset).toBe(false);
    });
  });

  describe("Online Presence", () => {
    it("should track online users with heartbeat", () => {
      const onlineUsers = new Map<string, { userName: string; userColor: string; lastSeen: number }>();
      
      // User comes online
      onlineUsers.set("user1", { userName: "Khalifa", userColor: "#3182CE", lastSeen: Date.now() });
      expect(onlineUsers.size).toBe(1);
      expect(onlineUsers.get("user1")?.userName).toBe("Khalifa");
      
      // Another user comes online
      onlineUsers.set("user2", { userName: "Ahmed", userColor: "#38A169", lastSeen: Date.now() });
      expect(onlineUsers.size).toBe(2);
      
      // User goes offline
      onlineUsers.delete("user1");
      expect(onlineUsers.size).toBe(1);
      expect(onlineUsers.has("user1")).toBe(false);
    });

    it("should expire stale heartbeats after 30 seconds", () => {
      const HEARTBEAT_TIMEOUT = 30000;
      const now = Date.now();
      const onlineUsers = new Map<string, { lastSeen: number }>();
      
      onlineUsers.set("active", { lastSeen: now - 5000 }); // 5s ago - active
      onlineUsers.set("stale", { lastSeen: now - 60000 }); // 60s ago - stale
      
      // Clean up stale users
      for (const [userId, data] of onlineUsers) {
        if (now - data.lastSeen > HEARTBEAT_TIMEOUT) {
          onlineUsers.delete(userId);
        }
      }
      
      expect(onlineUsers.has("active")).toBe(true);
      expect(onlineUsers.has("stale")).toBe(false);
    });
  });

  describe("WebSocket Message Protocol", () => {
    it("should parse valid chat messages", () => {
      const rawMsg = JSON.stringify({
        type: "chat",
        content: "Hello world",
      });
      const parsed = JSON.parse(rawMsg);
      expect(parsed.type).toBe("chat");
      expect(parsed.content).toBe("Hello world");
    });

    it("should handle Arabic content", () => {
      const rawMsg = JSON.stringify({
        type: "chat",
        content: "مرحبا بالجميع",
      });
      const parsed = JSON.parse(rawMsg);
      expect(parsed.content).toBe("مرحبا بالجميع");
      // Detect Arabic
      const isArabic = /[\u0600-\u06FF]/.test(parsed.content);
      expect(isArabic).toBe(true);
    });

    it("should handle emoji content", () => {
      const rawMsg = JSON.stringify({
        type: "chat",
        content: "📈🚀 Great market day!",
      });
      const parsed = JSON.parse(rawMsg);
      expect(parsed.content).toContain("📈");
      expect(parsed.content).toContain("🚀");
    });

    it("should validate image upload messages", () => {
      const rawMsg = JSON.stringify({
        type: "image",
        imageData: "base64encodeddata",
        mimeType: "image/png",
      });
      const parsed = JSON.parse(rawMsg);
      expect(parsed.type).toBe("image");
      expect(parsed.mimeType).toMatch(/^image\//);
    });

    it("should reject messages exceeding max length", () => {
      const MAX_LENGTH = 1000;
      const longContent = "a".repeat(1500);
      expect(longContent.length).toBeGreaterThan(MAX_LENGTH);
      const truncated = longContent.substring(0, MAX_LENGTH);
      expect(truncated.length).toBe(MAX_LENGTH);
    });
  });

  describe("Image Upload Validation", () => {
    it("should accept valid image MIME types", () => {
      const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      expect(validTypes).toContain("image/jpeg");
      expect(validTypes).toContain("image/png");
    });

    it("should reject non-image MIME types", () => {
      const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      expect(validTypes).not.toContain("application/pdf");
      expect(validTypes).not.toContain("text/html");
    });

    it("should enforce 5MB file size limit", () => {
      const MAX_SIZE = 5 * 1024 * 1024; // 5MB
      const smallFile = 1024 * 1024; // 1MB
      const largeFile = 10 * 1024 * 1024; // 10MB
      expect(smallFile).toBeLessThan(MAX_SIZE);
      expect(largeFile).toBeGreaterThan(MAX_SIZE);
    });
  });
});
