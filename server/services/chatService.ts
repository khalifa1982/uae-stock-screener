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
 * - HTTP polling fallback via tRPC for when WebSocket is blocked
 */
import WebSocket, { WebSocketServer } from "ws";
import type { Server as HTTPServer } from "http";
import type { IncomingMessage } from "http";
import { getDb } from "../db";
import { chatMessages } from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
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
  type: "message" | "image" | "heartbeat" | "typing" | "clear_all";
  content?: string;
  imageData?: string;
  imageMime?: string;
}

interface OutgoingChatMessage {
  type: "message" | "image" | "system" | "presence" | "history" | "typing" | "cleared";
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
const HEARTBEAT_INTERVAL = 15000;
const HEARTBEAT_TIMEOUT = 45000;
const AVATAR_COLORS = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#14B8A6", "#6366F1",
  "#D946EF", "#0EA5E9", "#84CC16", "#E11D48", "#7C3AED",
  "#059669", "#DC2626", "#2563EB", "#CA8A04", "#9333EA",
];

// ─── State ─────────────────────────────────────────────────────────
const onlineUsers = new Map<number, ChatUser>();
// Track HTTP polling users (userId -> last seen timestamp)
const pollingUsers = new Map<number, { userName: string; userColor: string; lastSeen: number }>();
let wss: WebSocketServer | null = null;

// ─── Helpers ───────────────────────────────────────────────────────
function getUAEDate(): string {
  const now = new Date();
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
  // Combine WebSocket users and recent polling users
  const allUsers = new Map<number, OnlineUserInfo>();
  onlineUsers.forEach(u => {
    allUsers.set(u.userId, { userId: u.userId, userName: u.userName, userColor: u.userColor });
  });
  const now = Date.now();
  pollingUsers.forEach((u, userId) => {
    // Consider polling user online if seen in last 30 seconds
    if (now - u.lastSeen < 30000) {
      allUsers.set(userId, { userId, userName: u.userName, userColor: u.userColor });
    }
  });
  return Array.from(allUsers.values());
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

    // Close existing connection for same user
    const existing = onlineUsers.get(userId);
    if (existing) {
      existing.ws.close(4002, "Connected from another tab");
    }

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

    broadcastPresence();
    const joinId = await saveMessage(userId, userName, userColor, "system", `${userName} joined the chat`, null).catch(() => 0);
    broadcast({
      type: "system",
      id: joinId,
      content: `${userName} joined the chat`,
      timestamp: getUAETimestamp(),
    });

    ws.on("message", async (raw: Buffer) => {
      try {
        const msg: IncomingChatMessage = JSON.parse(raw.toString());
        chatUser.lastHeartbeat = Date.now();

        switch (msg.type) {
          case "heartbeat":
            break;

          case "typing":
            broadcast({
              type: "typing",
              typingUser: userName,
              userId,
            }, userId);
            break;

          case "message":
            if (!msg.content?.trim()) break;
            const textContent = msg.content.trim().substring(0, 2000);
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

          case "clear_all":
            try {
              const db = await getDb();
              if (!db) break;
              const { users } = await import("../../drizzle/schema");
              const [userRecord] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
              if (userRecord?.role !== "admin") {
                ws.send(JSON.stringify({
                  type: "system",
                  content: "Only admins can clear chat history.",
                  timestamp: getUAETimestamp(),
                }));
                break;
              }
              const today = getUAEDate();
              await db.delete(chatMessages).where(eq(chatMessages.chatDate, today));
              console.log(`[Chat] Admin ${userName} cleared all messages for ${today}`);
              broadcast({
                type: "cleared",
                content: `Chat history cleared by ${userName}`,
                timestamp: getUAETimestamp(),
              });
              const clearMsgId = await saveMessage(userId, userName, userColor, "system", `${userName} cleared the chat history`, null).catch(() => 0);
              broadcast({
                type: "system",
                id: clearMsgId,
                content: `${userName} cleared the chat history`,
                timestamp: getUAETimestamp(),
              });
            } catch (err) {
              console.error("[Chat] Clear all failed:", err);
            }
            break;
        }
      } catch (err) {
        console.error("[Chat] Message parse error:", err);
      }
    });

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

  // Heartbeat checker
  setInterval(() => {
    const now = Date.now();
    onlineUsers.forEach((user, userId) => {
      if (now - user.lastHeartbeat > HEARTBEAT_TIMEOUT) {
        console.log(`[Chat] Heartbeat timeout for ${user.userName}`);
        user.ws.close(4003, "Heartbeat timeout");
        onlineUsers.delete(userId);
      }
    });
    // Clean up stale polling users
    pollingUsers.forEach((u, userId) => {
      if (now - u.lastSeen > 60000) {
        pollingUsers.delete(userId);
      }
    });
  }, HEARTBEAT_INTERVAL);

  // Daily cleanup
  scheduleCleanup();
}

function scheduleCleanup(): void {
  const now = new Date();
  const uaeNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const tomorrow = new Date(uaeNow);
  tomorrow.setUTCHours(0, 0, 0, 0);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const midnightUAE = new Date(tomorrow.getTime() - 4 * 60 * 60 * 1000);
  const msUntilMidnight = midnightUAE.getTime() - now.getTime();

  setTimeout(async () => {
    try {
      const db = await getDb();
      if (!db) return;
      const today = getUAEDate();
      const { sql } = await import("drizzle-orm");
      await db.delete(chatMessages).where(
        sql`${chatMessages.chatDate} != ${today}`
      );
      console.log("[Chat] Daily cleanup: removed old messages");
    } catch (err) {
      console.error("[Chat] Cleanup failed:", err);
    }
    scheduleCleanup();
  }, msUntilMidnight);

  console.log(`[Chat] Next cleanup in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`);
}

// ─── Exports for tRPC (HTTP polling fallback) ─────────────────────
export function getOnlineUsersCount(): number {
  return onlineUsers.size;
}

export function getOnlineUsersList(): OnlineUserInfo[] {
  return getOnlineUserList();
}

export async function getChatMessages(sinceId?: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  const today = getUAEDate();
  let query;
  if (sinceId && sinceId > 0) {
    query = await db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.chatDate, today), sql`${chatMessages.id} > ${sinceId}`))
      .orderBy(chatMessages.id);
  } else {
    query = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.chatDate, today))
      .orderBy(chatMessages.id);
  }
  return query.map(m => ({
    id: m.id,
    userId: m.userId,
    userName: m.userName,
    userColor: m.userColor,
    messageType: m.messageType,
    content: m.content,
    imageUrl: m.imageUrl,
    timestamp: m.createdAt?.toISOString?.() || new Date().toISOString(),
  }));
}

export async function postChatMessage(
  userId: number,
  userName: string,
  content: string
): Promise<{ id: number; timestamp: string }> {
  const userColor = getColorForUser(userId);
  const textContent = content.trim().substring(0, 2000);
  const msgId = await saveMessage(userId, userName, userColor, "text", textContent, null);
  const timestamp = getUAETimestamp();
  broadcast({
    type: "message",
    id: msgId,
    userId,
    userName,
    userColor,
    content: textContent,
    timestamp,
  });
  return { id: msgId, timestamp };
}

export async function postChatImage(
  userId: number,
  userName: string,
  base64Data: string,
  mime: string,
  caption?: string
): Promise<{ id: number; imageUrl: string; timestamp: string }> {
  const userColor = getColorForUser(userId);
  const imageUrl = await uploadChatImage(base64Data, mime, userId);
  const imgId = await saveMessage(userId, userName, userColor, "image", caption || null, imageUrl);
  const timestamp = getUAETimestamp();
  broadcast({
    type: "image",
    id: imgId,
    userId,
    userName,
    userColor,
    content: caption || undefined,
    imageUrl,
    timestamp,
  });
  return { id: imgId, imageUrl, timestamp };
}

export async function clearAllChatMessages(userId: number, userName: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const { users } = await import("../../drizzle/schema");
  const [userRecord] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (userRecord?.role !== "admin") return false;
  const today = getUAEDate();
  await db.delete(chatMessages).where(eq(chatMessages.chatDate, today));
  broadcast({ type: "cleared", content: `Chat history cleared by ${userName}`, timestamp: getUAETimestamp() });
  return true;
}

export function registerPollingUser(userId: number, userName: string): void {
  pollingUsers.set(userId, {
    userName,
    userColor: getColorForUser(userId),
    lastSeen: Date.now(),
  });
}
