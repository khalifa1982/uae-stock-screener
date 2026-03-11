/**
 * Live Chat WebSocket Service
 * 
 * Architecture:
 * - WebSocket server on /ws/chat for real-time messaging
 * - Heartbeat-based online presence tracking
 * - Messages persisted to DB for current day only (UAE timezone)
 * - Daily auto-cleanup of old messages
 * - Image upload via S3 storage
 * - System messages for join/leave events
 */
import WebSocket, { WebSocketServer } from "ws";
import type { Server as HTTPServer } from "http";
import type { IncomingMessage } from "http";
import { getDb } from "../db";
import { chatMessages } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { storagePut } from "../storage";
import crypto from "crypto";

// ─── Types ─────────────────────────────────────────────────────────
interface ChatUser {
  userId: number;
  userName: string;
  userColor: string;
  ws: WebSocket;
  lastHeartbeat: number;
}

interface IncomingChatMessage {
  type: "message" | "image" | "heartbeat" | "typing";
  content?: string;
  imageData?: string; // base64 encoded image
  imageMime?: string; // e.g. "image/png"
}

interface OutgoingChatMessage {
  type: "message" | "image" | "system" | "presence" | "history" | "typing";
  id?: number;
  userId?: number;
  userName?: string;
  userColor?: string;
  content?: string;
  imageUrl?: string;
  timestamp?: string;
  onlineUsers?: OnlineUserInfo[];
  messages?: HistoryMessage[];
  typingUser?: string;
}

interface OnlineUserInfo {
  userId: number;
  userName: string;
  userColor: string;
}

interface HistoryMessage {
  id: number;
  userId: number;
  userName: string;
  userColor: string;
  messageType: string;
  content: string | null;
  imageUrl: string | null;
  createdAt: Date;
}

// ─── Constants ─────────────────────────────────────────────────────
const HEARTBEAT_INTERVAL = 15000; // 15s
const HEARTBEAT_TIMEOUT = 45000; // 45s - disconnect if no heartbeat
const AVATAR_COLORS = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#14B8A6", "#6366F1",
  "#D946EF", "#0EA5E9", "#84CC16", "#E11D48", "#7C3AED",
  "#059669", "#DC2626", "#2563EB", "#CA8A04", "#9333EA",
];

// ─── State ─────────────────────────────────────────────────────────
const onlineUsers = new Map<number, ChatUser>();
let wss: WebSocketServer | null = null;

// ─── Helpers ───────────────────────────────────────────────────────
function getUAEDate(): string {
  const now = new Date();
  // UAE is UTC+4
  const uaeTime = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  return uaeTime.toISOString().split("T")[0];
}

function getUAETimestamp(): string {
  const now = new Date();
  const uaeTime = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  return uaeTime.toISOString();
}

function getColorForUser(userId: number): string {
  return AVATAR_COLORS[userId % AVATAR_COLORS.length];
}

function getOnlineUserList(): OnlineUserInfo[] {
  return Array.from(onlineUsers.values()).map(u => ({
    userId: u.userId,
    userName: u.userName,
    userColor: u.userColor,
  }));
}

function broadcast(message: OutgoingChatMessage, excludeUserId?: number): void {
  const data = JSON.stringify(message);
  onlineUsers.forEach((user) => {
    if (excludeUserId && user.userId === excludeUserId) return;
    if (user.ws.readyState === WebSocket.OPEN) {
      user.ws.send(data);
    }
  });
}

function broadcastPresence(): void {
  broadcast({ type: "presence", onlineUsers: getOnlineUserList() });
}

// ─── Database Operations ───────────────────────────────────────────
async function saveMessage(
  userId: number,
  userName: string,
  userColor: string,
  messageType: "text" | "image" | "system",
  content: string | null,
  imageUrl: string | null
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.insert(chatMessages).values({
    userId,
    userName,
    userColor,
    messageType,
    content,
    imageUrl: imageUrl ?? undefined,
    chatDate: getUAEDate(),
  });
  return result[0].insertId;
}

async function getTodayMessages(): Promise<HistoryMessage[]> {
  const db = await getDb();
  if (!db) return [];
  const today = getUAEDate();
  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.chatDate, today))
    .orderBy(chatMessages.id);
  return messages;
}

// ─── Image Upload ──────────────────────────────────────────────────
async function uploadChatImage(base64Data: string, mime: string, userId: number): Promise<string> {
  const buffer = Buffer.from(base64Data, "base64");
  const ext = mime.split("/")[1] || "png";
  const randomSuffix = crypto.randomBytes(8).toString("hex");
  const key = `chat-images/${getUAEDate()}/${userId}-${randomSuffix}.${ext}`;
  const { url } = await storagePut(key, buffer, mime);
  return url;
}

// ─── WebSocket Authentication ──────────────────────────────────────
function parseAuthFromUrl(url: string | undefined): { userId: number; userName: string } | null {
  if (!url) return null;
  try {
    const params = new URLSearchParams(url.split("?")[1]);
    const userId = parseInt(params.get("userId") || "0", 10);
    const userName = params.get("userName") || "";
    if (!userId || !userName) return null;
    return { userId, userName };
  } catch {
    return null;
  }
}

// ─── WebSocket Server ──────────────────────────────────────────────
export function initChatWebSocket(server: HTTPServer): void {
  wss = new WebSocketServer({
    server,
    path: "/ws/chat",
  });
  console.log("[Chat] WebSocket server initialized on /ws/chat");

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    const auth = parseAuthFromUrl(req.url);
    if (!auth) {
      ws.close(4001, "Authentication required");
      return;
    }

    const { userId, userName } = auth;
    const userColor = getColorForUser(userId);

    // Close existing connection for same user (prevent duplicates)
    const existing = onlineUsers.get(userId);
    if (existing) {
      existing.ws.close(4002, "Connected from another tab");
    }

    // Register user
    const chatUser: ChatUser = {
      userId,
      userName,
      userColor,
      ws,
      lastHeartbeat: Date.now(),
    };
    onlineUsers.set(userId, chatUser);

    console.log(`[Chat] ${userName} (${userId}) connected. Online: ${onlineUsers.size}`);

    // Send today's message history
    try {
      const history = await getTodayMessages();
      ws.send(JSON.stringify({
        type: "history",
        messages: history.map(m => ({
          id: m.id,
          userId: m.userId,
          userName: m.userName,
          userColor: m.userColor,
          messageType: m.messageType,
          content: m.content,
          imageUrl: m.imageUrl,
          timestamp: m.createdAt.toISOString(),
        })),
      }));
    } catch (err) {
      console.error("[Chat] Failed to load history:", err);
    }

    // Broadcast join
    broadcastPresence();
    const joinId = await saveMessage(userId, userName, userColor, "system", `${userName} joined the chat`, null).catch(() => 0);
    broadcast({
      type: "system",
      id: joinId,
      content: `${userName} joined the chat`,
      timestamp: getUAETimestamp(),
    });

    // Handle messages
    ws.on("message", async (raw: Buffer) => {
      try {
        const msg: IncomingChatMessage = JSON.parse(raw.toString());
        chatUser.lastHeartbeat = Date.now();

        switch (msg.type) {
          case "heartbeat":
            // Just update lastHeartbeat (already done above)
            break;

          case "typing":
            // Broadcast typing indicator to others
            broadcast({
              type: "typing",
              typingUser: userName,
              userId,
            }, userId);
            break;

          case "message":
            if (!msg.content?.trim()) break;
            const textContent = msg.content.trim().substring(0, 2000); // limit length
            const msgId = await saveMessage(userId, userName, userColor, "text", textContent, null);
            broadcast({
              type: "message",
              id: msgId,
              userId,
              userName,
              userColor,
              content: textContent,
              timestamp: getUAETimestamp(),
            });
            break;

          case "image":
            if (!msg.imageData || !msg.imageMime) break;
            try {
              const imageUrl = await uploadChatImage(msg.imageData, msg.imageMime, userId);
              const imgId = await saveMessage(userId, userName, userColor, "image", msg.content || null, imageUrl);
              broadcast({
                type: "image",
                id: imgId,
                userId,
                userName,
                userColor,
                content: msg.content || undefined,
                imageUrl,
                timestamp: getUAETimestamp(),
              });
            } catch (err) {
              console.error("[Chat] Image upload failed:", err);
              ws.send(JSON.stringify({
                type: "system",
                content: "Failed to upload image. Please try again.",
                timestamp: getUAETimestamp(),
              }));
            }
            break;
        }
      } catch (err) {
        console.error("[Chat] Message parse error:", err);
      }
    });

    // Handle disconnect
    ws.on("close", async () => {
      onlineUsers.delete(userId);
      console.log(`[Chat] ${userName} (${userId}) disconnected. Online: ${onlineUsers.size}`);
      broadcastPresence();
      await saveMessage(userId, userName, userColor, "system", `${userName} left the chat`, null).catch(() => {});
      broadcast({
        type: "system",
        content: `${userName} left the chat`,
        timestamp: getUAETimestamp(),
      });
    });

    ws.on("error", (err) => {
      console.error(`[Chat] WebSocket error for ${userName}:`, err.message);
    });
  });

  // Heartbeat checker - disconnect stale connections
  setInterval(() => {
    const now = Date.now();
    onlineUsers.forEach((user, userId) => {
      if (now - user.lastHeartbeat > HEARTBEAT_TIMEOUT) {
        console.log(`[Chat] Heartbeat timeout for ${user.userName}`);
        user.ws.close(4003, "Heartbeat timeout");
        onlineUsers.delete(userId);
      }
    });
  }, HEARTBEAT_INTERVAL);

  // Daily cleanup - remove old messages at midnight UAE time
  scheduleCleanup();
}

function scheduleCleanup(): void {
  // Calculate time until next midnight UAE (UTC+4)
  const now = new Date();
  const uaeNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const tomorrow = new Date(uaeNow);
  tomorrow.setUTCHours(0, 0, 0, 0);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  // Convert back to UTC
  const midnightUAE = new Date(tomorrow.getTime() - 4 * 60 * 60 * 1000);
  const msUntilMidnight = midnightUAE.getTime() - now.getTime();

  setTimeout(async () => {
    try {
      const db = await getDb();
      if (!db) return;
      const today = getUAEDate();
      // Delete all messages NOT from today
      const { sql } = await import("drizzle-orm");
      await db.delete(chatMessages).where(
        sql`${chatMessages.chatDate} != ${today}`
      );
      console.log("[Chat] Daily cleanup: removed old messages");
    } catch (err) {
      console.error("[Chat] Cleanup failed:", err);
    }
    // Schedule next cleanup
    scheduleCleanup();
  }, msUntilMidnight);

  console.log(`[Chat] Next cleanup in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`);
}

// ─── Exports for tRPC ──────────────────────────────────────────────
export function getOnlineUsersCount(): number {
  return onlineUsers.size;
}

export function getOnlineUsersList(): OnlineUserInfo[] {
  return getOnlineUserList();
}
