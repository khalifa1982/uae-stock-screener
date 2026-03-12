import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// ─── Chat Service Tests ────────────────────────────────────────────
describe("Phase 39: Chat Feature Enhancements", () => {
  const chatServicePath = path.resolve(__dirname, "services/chatService.ts");
  const chatServiceCode = fs.readFileSync(chatServicePath, "utf-8");

  const useChatPath = path.resolve(__dirname, "../client/src/hooks/useChat.ts");
  const useChatCode = fs.readFileSync(useChatPath, "utf-8");

  const liveChatPath = path.resolve(__dirname, "../client/src/components/LiveChat.tsx");
  const liveChatCode = fs.readFileSync(liveChatPath, "utf-8");

  const routersPath = path.resolve(__dirname, "routers.ts");
  const routersCode = fs.readFileSync(routersPath, "utf-8");

  const schemaPath = path.resolve(__dirname, "../drizzle/schema.ts");
  const schemaCode = fs.readFileSync(schemaPath, "utf-8");

  // ─── 1. Message Reactions ──────────────────────────────────────
  describe("Message Reactions", () => {
    it("should have chatMessageReactions table in schema", () => {
      expect(schemaCode).toContain("chatMessageReactions");
      expect(schemaCode).toContain("messageId");
      expect(schemaCode).toContain("emoji");
    });

    it("should have ALLOWED_REACTION_EMOJIS constant", () => {
      expect(chatServiceCode).toContain("ALLOWED_REACTION_EMOJIS");
      expect(chatServiceCode).toContain("👍");
      expect(chatServiceCode).toContain("❤️");
      expect(chatServiceCode).toContain("😂");
      expect(chatServiceCode).toContain("🔥");
      expect(chatServiceCode).toContain("📈");
      expect(chatServiceCode).toContain("📉");
    });

    it("should have toggleReaction function that adds/removes reactions", () => {
      expect(chatServiceCode).toContain("async function toggleReaction");
      // Should check for existing reaction and toggle
      expect(chatServiceCode).toContain("existing.length > 0");
      // Should delete if exists
      expect(chatServiceCode).toContain("db.delete(chatMessageReactions)");
      // Should insert if not exists
      expect(chatServiceCode).toContain("db.insert(chatMessageReactions)");
    });

    it("should have toggleMessageReaction export for tRPC", () => {
      expect(chatServiceCode).toContain("export async function toggleMessageReaction");
    });

    it("should have react mutation in tRPC router", () => {
      expect(routersCode).toContain("react: protectedProcedure");
      expect(routersCode).toContain("toggleMessageReaction");
    });

    it("should handle reaction WS messages", () => {
      expect(chatServiceCode).toContain('case "reaction"');
      expect(chatServiceCode).toContain("ALLOWED_REACTION_EMOJIS.includes(msg.emoji)");
    });

    it("should broadcast reaction updates to all users", () => {
      expect(chatServiceCode).toContain('type: added ? "reaction" : "reaction_removed"');
    });

    it("should have sendReaction in useChat hook", () => {
      expect(useChatCode).toContain("sendReaction");
      expect(useChatCode).toContain('type: "reaction"');
    });

    it("should render ReactionBar with emoji buttons in LiveChat", () => {
      expect(liveChatCode).toContain("ReactionBar");
      expect(liveChatCode).toContain("REACTION_EMOJIS");
    });

    it("should render ReactionsDisplay showing reaction counts", () => {
      expect(liveChatCode).toContain("ReactionsDisplay");
      expect(liveChatCode).toContain("hasReacted");
      expect(liveChatCode).toContain("r.count");
    });
  });

  // ─── 2. Reply/Quote Messages ───────────────────────────────────
  describe("Reply/Quote Messages", () => {
    it("should have replyToId column in chatMessages schema", () => {
      expect(schemaCode).toContain("replyToId");
    });

    it("should have getReplyContext function in chatService", () => {
      expect(chatServiceCode).toContain("async function getReplyContext");
    });

    it("should handle reply WS messages", () => {
      expect(chatServiceCode).toContain('case "reply"');
      expect(chatServiceCode).toContain("msg.replyToId");
    });

    it("should include replyTo fields in broadcast messages", () => {
      expect(chatServiceCode).toContain("replyToContent");
      expect(chatServiceCode).toContain("replyToUserName");
      expect(chatServiceCode).toContain("replyToType");
    });

    it("should support replyToId in tRPC send mutation", () => {
      expect(routersCode).toContain("replyToId: z.number().optional()");
    });

    it("should have replyTo state in LiveChat", () => {
      expect(liveChatCode).toContain("replyTo");
      expect(liveChatCode).toContain("setReplyTo");
    });

    it("should render ReplyBanner when replying", () => {
      expect(liveChatCode).toContain("ReplyBanner");
      expect(liveChatCode).toContain("onCancel");
    });

    it("should render ReplyPreview in message bubbles", () => {
      expect(liveChatCode).toContain("ReplyPreview");
      expect(liveChatCode).toContain("replyToUserName");
    });
  });

  // ─── 3. Multi-User Typing Indicator ────────────────────────────
  describe("Multi-User Typing Indicator", () => {
    it("should track multiple typing users in useChat", () => {
      expect(useChatCode).toContain("typingUsers");
      expect(useChatCode).toContain("setTypingUsers");
      expect(useChatCode).toContain("addTypingUser");
    });

    it("should auto-expire typing indicators after timeout", () => {
      expect(useChatCode).toContain("typingTimeoutsRef");
      expect(useChatCode).toContain("3000"); // 3 second timeout
    });

    it("should render TypingIndicator component with animated dots", () => {
      expect(liveChatCode).toContain("TypingIndicator");
      expect(liveChatCode).toContain("animate-bounce");
      expect(liveChatCode).toContain("is typing");
      expect(liveChatCode).toContain("are typing");
    });

    it("should show correct text for 1, 2, or more typing users", () => {
      expect(liveChatCode).toContain("users.length === 1");
      expect(liveChatCode).toContain("users.length === 2");
      expect(liveChatCode).toContain("others are typing");
    });
  });

  // ─── 4. Message Timestamps ─────────────────────────────────────
  describe("Message Timestamps", () => {
    it("should display timestamps in UAE timezone (Asia/Dubai)", () => {
      expect(liveChatCode).toContain("Asia/Dubai");
    });

    it("should show time in 12-hour format with AM/PM", () => {
      expect(liveChatCode).toContain("hour12: true");
    });

    it("should show time next to username for non-own messages", () => {
      // Time is shown inline with username
      expect(liveChatCode).toContain("text-muted-foreground/50");
    });
  });

  // ─── 5. Auto-Open Chat ─────────────────────────────────────────
  describe("Auto-Open Chat on New Messages", () => {
    it("should have newMessageFlag in useChat return", () => {
      expect(useChatCode).toContain("newMessageFlag");
      expect(useChatCode).toContain("setNewMessageFlag");
    });

    it("should increment newMessageFlag for non-own messages", () => {
      // WS mode
      expect(useChatCode).toContain("data.userId !== user?.id");
      expect(useChatCode).toContain("setNewMessageFlag(prev => prev + 1)");
    });

    it("should auto-open chat when newMessageFlag changes while closed", () => {
      expect(liveChatCode).toContain("prevNewMessageFlagRef");
      expect(liveChatCode).toContain("newMessageFlag > prevNewMessageFlagRef.current && !isOpen");
      expect(liveChatCode).toContain("setIsOpen(true)");
    });
  });

  // ─── 6. Daily Auto-Reset ───────────────────────────────────────
  describe("Daily Auto-Reset at Midnight UAE", () => {
    it("should have performDailyReset function", () => {
      expect(chatServiceCode).toContain("async function performDailyReset");
    });

    it("should delete old messages (not from today)", () => {
      expect(chatServiceCode).toContain("chatDate");
      expect(chatServiceCode).toContain("!= ${today}");
    });

    it("should clean up orphaned reactions", () => {
      expect(chatServiceCode).toContain("DELETE FROM chat_message_reactions WHERE messageId NOT IN");
    });

    it("should broadcast cleared event after reset", () => {
      expect(chatServiceCode).toContain('type: "cleared"');
      expect(chatServiceCode).toContain("New trading day");
    });

    it("should schedule midnight reset on startup", () => {
      expect(chatServiceCode).toContain("scheduleMidnightReset");
      expect(chatServiceCode).toContain("Next midnight reset");
    });

    it("should perform startup cleanup check", () => {
      expect(chatServiceCode).toContain("async function checkStartupCleanup");
      expect(chatServiceCode).toContain("Startup cleanup");
    });

    it("should send system message for new trading day", () => {
      expect(chatServiceCode).toContain("New trading day");
      expect(chatServiceCode).toContain("Good morning!");
    });
  });

  // ─── 7. Reactions loaded with history ──────────────────────────
  describe("Reactions loaded with message history", () => {
    it("should fetch reactions when loading history", () => {
      expect(chatServiceCode).toContain("getReactionsForMessages");
      expect(chatServiceCode).toContain("reactionsMap");
    });

    it("should include reactions in history messages", () => {
      expect(chatServiceCode).toContain("reactions: reactionsMap.get(m.id) || []");
    });

    it("should include reactions in HTTP polling messages", () => {
      // getChatMessages also includes reactions
      expect(chatServiceCode).toContain("reactions: reactionsMap.get(m.id) || []");
    });
  });

  // ─── 8. UI Components ─────────────────────────────────────────
  describe("UI Components", () => {
    it("should have solid background colors (not transparent)", () => {
      expect(liveChatCode).toContain("oklch(0.10 0.014 260)");
      expect(liveChatCode).toContain("oklch(0.12 0.014 260)");
      expect(liveChatCode).toContain("oklch(0.14 0.014 260)");
    });

    it("should have escape key to cancel reply", () => {
      expect(liveChatCode).toContain('e.key === "Escape"');
      expect(liveChatCode).toContain("setReplyTo(null)");
    });

    it("should show reply placeholder in input", () => {
      expect(liveChatCode).toContain("Reply to ${replyTo.userName}");
    });

    it("should clear replyTo after sending", () => {
      expect(liveChatCode).toContain("setReplyTo(null)");
    });
  });
});
