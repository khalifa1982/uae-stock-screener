/**
 * Live Chat WebSocket Service
 * 
 * Architecture:
 * - WebSocket server on /ws/chat for real-time messaging
 * - Heartbeat-based online presence tracking
 * - Messages persisted to DB for current day only (UAE timezone)
 * - Daily auto-cleanup at midnight UAE time + startup check
 * - Image upload via S3 storage
 * - System messages for join/leave events
 * - Emoji reactions on messages
 * - Reply/quote messages
 * - Typing indicators (multi-user)
 * - HTTP polling fallback via tRPC for when WebSocket is blocked
 */
import WebSocket, { WebSocketServer } from "ws";
import type { Server as HTTPServer } from "http";
import type { IncomingMessage } from "http";
import { getDb } from "../db";
import { chatMessages, chatMessageReactions } from "../../drizzle/schema";
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
  type: "message" | "image" | "heartbeat" | "typing" | "clear_all" | "reaction" | "reply";
  content?: string;
  imageData?: string;
  imageMime?: string;
  // Reaction fields
  messageId?: number;
  emoji?: string;
  // Reply fields
  replyToId?: number;
}

interface OutgoingChatMessage {
  type: "message" | "image" | "system" | "presence" | "history" | "typing" | "cleared" | "reaction" | "reaction_removed";
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
  // Reaction fields
  messageId?: number;
  emoji?: string;
  reactions?: ReactionData[];
  // Reply fields
  replyToId?: number;
  replyToContent?: string;
  replyToUserName?: string;
  replyToType?: string;
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
  replyToId: number | null;
  createdAt: Date;
}

interface ReactionData {
  emoji: string;
  count: number;
  users: { userId: number; userName: string }[];
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

const ALLOWED_REACTION_EMOJIS = ["👍", "❤️", "😂", "🔥", "📈", "📉"];

// ─── State ─────────────────────────────────────────────────────────
const onlineUsers = new Map<number, ChatUser>();
const pollingUsers = new Map<number, { userName: string; userColor: string; lastSeen: number }>();
let wss: WebSocketServer | null = null;
let chatClearedAt: number = 0;

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
  const allUsers = new Map<number, OnlineUserInfo>();
  onlineUsers.forEach(u => {
    allUsers.set(u.userId, { userId: u.userId, userName: u.userName, userColor: u.userColor });
  });
  const now = Date.now();
  pollingUsers.forEach((u, userId) => {
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
  imageUrl: string | null,
  replyToId?: number | null
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
    replyToId: replyToId ?? undefined,
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

async function getReactionsForMessages(messageIds: number[]): Promise<Map<number, ReactionData[]>> {
  const db = await getDb();
  const result = new Map<number, ReactionData[]>();
  if (!db || messageIds.length === 0) return result;
  
  const reactions = await db
    .select()
    .from(chatMessageReactions)
    .where(sql`${chatMessageReactions.messageId} IN (${sql.join(messageIds.map(id => sql`${id}`), sql`, `)})`);
  
  // Group by messageId then by emoji
  const grouped = new Map<number, Map<string, { userId: number; userName: string }[]>>();
  for (const r of reactions) {
    if (!grouped.has(r.messageId)) grouped.set(r.messageId, new Map());
    const emojiMap = grouped.get(r.messageId)!;
    if (!emojiMap.has(r.emoji)) emojiMap.set(r.emoji, []);
    emojiMap.get(r.emoji)!.push({ userId: r.userId, userName: r.userName });
  }
  
  Array.from(grouped.entries()).forEach(([msgId, emojiMap]) => {
    const reactionList: ReactionData[] = [];
    Array.from(emojiMap.entries()).forEach(([emoji, users]) => {
      reactionList.push({ emoji, count: users.length, users });
    });
    result.set(msgId, reactionList);
  });
  
  return result;
}

async function toggleReaction(messageId: number, userId: number, userName: string, emoji: string): Promise<{ added: boolean; reactions: ReactionData[] }> {
  const db = await getDb();
  if (!db) return { added: false, reactions: [] };
  
  // Check if reaction exists
  const existing = await db
    .select()
    .from(chatMessageReactions)
    .where(and(
      eq(chatMessageReactions.messageId, messageId),
      eq(chatMessageReactions.userId, userId),
      eq(chatMessageReactions.emoji, emoji)
    ))
    .limit(1);
  
  let added = false;
  if (existing.length > 0) {
    // Remove reaction
    await db.delete(chatMessageReactions).where(
      and(
        eq(chatMessageReactions.messageId, messageId),
        eq(chatMessageReactions.userId, userId),
        eq(chatMessageReactions.emoji, emoji)
      )
    );
  } else {
    // Add reaction
    await db.insert(chatMessageReactions).values({
      messageId,
      userId,
      userName,
      emoji,
    });
    added = true;
  }
  
  // Get updated reactions for this message
  const reactionsMap = await getReactionsForMessages([messageId]);
  return { added, reactions: reactionsMap.get(messageId) || [] };
}

async function getReplyContext(replyToId: number): Promise<{ content: string | null; userName: string; messageType: string } | null> {
  const db = await getDb();
  if (!db) return null;
  const [msg] = await db
    .select({ content: chatMessages.content, userName: chatMessages.userName, messageType: chatMessages.messageType })
    .from(chatMessages)
    .where(eq(chatMessages.id, replyToId))
    .limit(1);
  return msg || null;
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

// ─── Daily Auto-Reset ──────────────────────────────────────────────
async function performDailyReset(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  try {
    const today = getUAEDate();
    // Delete all messages that are NOT from today
    await db.delete(chatMessages).where(sql`${chatMessages.chatDate} != ${today}`);
    // Also delete all reactions for deleted messages (orphaned reactions)
    await db.execute(sql`DELETE FROM chat_message_reactions WHERE messageId NOT IN (SELECT id FROM chat_messages)`);
    
    console.log("[Chat] Daily reset: removed old messages and reactions");
    
    // Update cleared timestamp
    chatClearedAt = Date.now();
    
    // Broadcast cleared event to all WS clients
    broadcast({
      type: "cleared",
      content: "Chat history has been reset for a new trading day.",
      timestamp: getUAETimestamp(),
    });
    
    // Save a system message for the new day
    const sysId = await saveMessage(0, "System", "#6B7280", "system", "🌅 New trading day — chat history has been reset. Good morning!", null);
    broadcast({
      type: "system",
      id: sysId,
      content: "🌅 New trading day — chat history has been reset. Good morning!",
      timestamp: getUAETimestamp(),
    });
  } catch (err) {
    console.error("[Chat] Daily reset failed:", err);
  }
}

async function checkStartupCleanup(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  try {
    const today = getUAEDate();
    // Check if there are messages from previous days
    const oldMessages = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(chatMessages)
      .where(sql`${chatMessages.chatDate} != ${today}`);
    
    if (oldMessages[0]?.count > 0) {
      console.log(`[Chat] Startup cleanup: found ${oldMessages[0].count} old messages, cleaning up...`);
      await performDailyReset();
    }
  } catch (err) {
    console.error("[Chat] Startup cleanup check failed:", err);
  }
}

function scheduleMidnightReset(): void {
  const now = new Date();
  const uaeNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const tomorrow = new Date(uaeNow);
  tomorrow.setUTCHours(0, 0, 0, 0);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const midnightUAE = new Date(tomorrow.getTime() - 4 * 60 * 60 * 1000);
  const msUntilMidnight = midnightUAE.getTime() - now.getTime();

  setTimeout(async () => {
    console.log("[Chat] Midnight UAE time reached — performing daily reset");
    await performDailyReset();
    scheduleMidnightReset(); // Schedule next day's reset
  }, msUntilMidnight);

  console.log(`[Chat] Next midnight reset in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`);
}

// ─── WebSocket Server ──────────────────────────────────────────────
export function initChatWebSocket(server: HTTPServer): void {
  wss = new WebSocketServer({
    server,
    path: "/ws/chat",
  });
  console.log("[Chat] WebSocket server initialized on /ws/chat");

  // Startup cleanup check
  checkStartupCleanup();
  // Schedule midnight reset
  scheduleMidnightReset();

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

    // Send today's message history with reactions
    try {
      const history = await getTodayMessages();
      const messageIds = history.map(m => m.id);
      const reactionsMap = await getReactionsForMessages(messageIds);
      
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
          replyToId: m.replyToId,
          timestamp: m.createdAt.toISOString(),
          reactions: reactionsMap.get(m.id) || [],
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

          case "message": {
            if (!msg.content?.trim()) break;
            const textContent = msg.content.trim().substring(0, 2000);
            let replyContext = null;
            if (msg.replyToId) {
              replyContext = await getReplyContext(msg.replyToId);
            }
            const msgId = await saveMessage(userId, userName, userColor, "text", textContent, null, msg.replyToId);
            broadcast({
              type: "message",
              id: msgId,
              userId,
              userName,
              userColor,
              content: textContent,
              timestamp: getUAETimestamp(),
              replyToId: msg.replyToId || undefined,
              replyToContent: replyContext?.content || undefined,
              replyToUserName: replyContext?.userName || undefined,
              replyToType: replyContext?.messageType || undefined,
            });
            break;
          }

          case "reply": {
            // Same as message but always has replyToId
            if (!msg.content?.trim() || !msg.replyToId) break;
            const replyText = msg.content.trim().substring(0, 2000);
            const replyCtx = await getReplyContext(msg.replyToId);
            const replyMsgId = await saveMessage(userId, userName, userColor, "text", replyText, null, msg.replyToId);
            broadcast({
              type: "message",
              id: replyMsgId,
              userId,
              userName,
              userColor,
              content: replyText,
              timestamp: getUAETimestamp(),
              replyToId: msg.replyToId,
              replyToContent: replyCtx?.content || undefined,
              replyToUserName: replyCtx?.userName || undefined,
              replyToType: replyCtx?.messageType || undefined,
            });
            break;
          }

          case "image": {
            if (!msg.imageData || !msg.imageMime) break;
            try {
              const imageUrl = await uploadChatImage(msg.imageData, msg.imageMime, userId);
              const imgId = await saveMessage(userId, userName, userColor, "image", msg.content || null, imageUrl, msg.replyToId);
              let replyCtx = null;
              if (msg.replyToId) {
                replyCtx = await getReplyContext(msg.replyToId);
              }
              broadcast({
                type: "image",
                id: imgId,
                userId,
                userName,
                userColor,
                content: msg.content || undefined,
                imageUrl,
                timestamp: getUAETimestamp(),
                replyToId: msg.replyToId || undefined,
                replyToContent: replyCtx?.content || undefined,
                replyToUserName: replyCtx?.userName || undefined,
                replyToType: replyCtx?.messageType || undefined,
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

          case "reaction": {
            if (!msg.messageId || !msg.emoji) break;
            if (!ALLOWED_REACTION_EMOJIS.includes(msg.emoji)) break;
            try {
              const { added, reactions } = await toggleReaction(msg.messageId, userId, userName, msg.emoji);
              // Broadcast reaction update to all users
              broadcast({
                type: added ? "reaction" : "reaction_removed",
                messageId: msg.messageId,
                emoji: msg.emoji,
                userId,
                userName,
                reactions,
              });
            } catch (err) {
              console.error("[Chat] Reaction toggle failed:", err);
            }
            break;
          }

          case "clear_all": {
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
              // Clean up orphaned reactions
              await db.execute(sql`DELETE FROM chat_message_reactions WHERE messageId NOT IN (SELECT id FROM chat_messages)`);
              chatClearedAt = Date.now();
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
  
  // Get reactions for these messages
  const messageIds = query.map(m => m.id);
  const reactionsMap = await getReactionsForMessages(messageIds);
  
  return query.map(m => ({
    id: m.id,
    userId: m.userId,
    userName: m.userName,
    userColor: m.userColor,
    messageType: m.messageType,
    content: m.content,
    imageUrl: m.imageUrl,
    replyToId: m.replyToId,
    timestamp: m.createdAt?.toISOString?.() || new Date().toISOString(),
    reactions: reactionsMap.get(m.id) || [],
  }));
}

export async function postChatMessage(
  userId: number,
  userName: string,
  content: string,
  replyToId?: number
): Promise<{ id: number; timestamp: string }> {
  const userColor = getColorForUser(userId);
  const textContent = content.trim().substring(0, 2000);
  let replyContext = null;
  if (replyToId) {
    replyContext = await getReplyContext(replyToId);
  }
  const msgId = await saveMessage(userId, userName, userColor, "text", textContent, null, replyToId);
  const timestamp = getUAETimestamp();
  broadcast({
    type: "message",
    id: msgId,
    userId,
    userName,
    userColor,
    content: textContent,
    timestamp,
    replyToId: replyToId || undefined,
    replyToContent: replyContext?.content || undefined,
    replyToUserName: replyContext?.userName || undefined,
    replyToType: replyContext?.messageType || undefined,
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
  await db.execute(sql`DELETE FROM chat_message_reactions WHERE messageId NOT IN (SELECT id FROM chat_messages)`);
  chatClearedAt = Date.now();
  broadcast({ type: "cleared", content: `Chat history cleared by ${userName}`, timestamp: getUAETimestamp() });
  return true;
}

export async function toggleMessageReaction(
  messageId: number,
  userId: number,
  userName: string,
  emoji: string
): Promise<{ added: boolean; reactions: ReactionData[] }> {
  if (!ALLOWED_REACTION_EMOJIS.includes(emoji)) {
    return { added: false, reactions: [] };
  }
  const result = await toggleReaction(messageId, userId, userName, emoji);
  // Broadcast to WS users
  broadcast({
    type: result.added ? "reaction" : "reaction_removed",
    messageId,
    emoji,
    userId,
    userName,
    reactions: result.reactions,
  });
  return result;
}

export function getChatClearedAt(): number {
  return chatClearedAt;
}

export function registerPollingUser(userId: number, userName: string): void {
  pollingUsers.set(userId, {
    userName,
    userColor: getColorForUser(userId),
    lastSeen: Date.now(),
  });
}

export { ALLOWED_REACTION_EMOJIS };
