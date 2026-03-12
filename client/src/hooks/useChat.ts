import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

export interface ChatMessageData {
  id?: number;
  type: "message" | "image" | "system";
  userId?: number;
  userName?: string;
  userColor?: string;
  content?: string;
  imageUrl?: string;
  timestamp?: string;
  messageType?: string;
}

export interface OnlineUser {
  userId: number;
  userName: string;
  userColor: string;
}

interface UseChatReturn {
  messages: ChatMessageData[];
  onlineUsers: OnlineUser[];
  isConnected: boolean;
  typingUser: string | null;
  sendMessage: (content: string) => void;
  sendImage: (base64Data: string, mime: string, caption?: string) => void;
  sendTyping: () => void;
  clearMessages: () => void;
  mode: "ws" | "http";
}

const MAX_RECONNECT_DELAY = 15000;
const INITIAL_RECONNECT_DELAY = 2000;
const HEARTBEAT_INTERVAL = 10000;
const HTTP_POLL_INTERVAL = 3000; // Poll every 3 seconds
const WS_FAIL_THRESHOLD = 3; // Switch to HTTP after 3 WS failures

export function useChat(): UseChatReturn {
  const { user, isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [mode, setMode] = useState<"ws" | "http">("ws");
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const wsFailCount = useRef(0);
  const mountedRef = useRef(true);
  const connectingRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMessageIdRef = useRef(0);

  // tRPC mutations for HTTP mode
  const sendMutation = trpc.chat.send.useMutation();
  const sendImageMutation = trpc.chat.sendImage.useMutation();
  const clearMutation = trpc.chat.clearAll.useMutation();
  const utils = trpc.useUtils();

  const cleanup = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // ─── HTTP Polling Mode ─────────────────────────────────────────────
  const startHttpPolling = useCallback(() => {
    if (pollTimerRef.current) return; // Already polling
    console.log("[Chat] Switching to HTTP polling mode");
    setMode("http");
    setIsConnected(true); // HTTP mode is always "connected"

    // Initial full fetch
    const fetchMessages = async () => {
      if (!mountedRef.current || !isAuthenticated) return;
      try {
        const msgs = await utils.chat.messages.fetch({ sinceId: lastMessageIdRef.current > 0 ? lastMessageIdRef.current : undefined });
        if (!mountedRef.current) return;
        if (msgs && msgs.length > 0) {
          if (lastMessageIdRef.current === 0) {
            // First load - replace all
            setMessages(msgs.map((m: any) => ({
              id: m.id,
              type: m.messageType === "image" ? "image" : m.messageType === "system" ? "system" : "message",
              userId: m.userId,
              userName: m.userName,
              userColor: m.userColor,
              content: m.content,
              imageUrl: m.imageUrl,
              timestamp: m.timestamp,
            })));
          } else {
            // Incremental - append new
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id));
              const newMsgs = msgs
                .filter((m: any) => !existingIds.has(m.id))
                .map((m: any) => ({
                  id: m.id,
                  type: m.messageType === "image" ? "image" : m.messageType === "system" ? "system" : "message" as const,
                  userId: m.userId,
                  userName: m.userName,
                  userColor: m.userColor,
                  content: m.content,
                  imageUrl: m.imageUrl,
                  timestamp: m.timestamp,
                }));
              return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev;
            });
          }
          const maxId = Math.max(...msgs.map((m: any) => m.id || 0));
          if (maxId > lastMessageIdRef.current) {
            lastMessageIdRef.current = maxId;
          }
        }
      } catch (err) {
        console.error("[Chat] HTTP poll error:", err);
      }
    };

    // Fetch online users
    const fetchOnlineUsers = async () => {
      if (!mountedRef.current || !isAuthenticated) return;
      try {
        const users = await utils.chat.onlineUsers.fetch();
        if (mountedRef.current && users) {
          setOnlineUsers(users);
        }
      } catch {}
    };

    // Initial fetch
    fetchMessages();
    fetchOnlineUsers();

    // Start polling
    pollTimerRef.current = setInterval(() => {
      fetchMessages();
      fetchOnlineUsers();
    }, HTTP_POLL_INTERVAL);
  }, [isAuthenticated, utils]);

  // ─── WebSocket Mode ────────────────────────────────────────────────
  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current || !isAuthenticated || !user) return;
    if (reconnectRef.current) clearTimeout(reconnectRef.current);

    // If too many WS failures, switch to HTTP
    if (wsFailCount.current >= WS_FAIL_THRESHOLD) {
      console.log("[Chat] Too many WS failures, switching to HTTP polling");
      startHttpPolling();
      return;
    }

    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts.current),
      MAX_RECONNECT_DELAY
    );
    reconnectAttempts.current++;
    console.log(`[Chat] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectAttempts.current})`);
    reconnectRef.current = setTimeout(() => {
      if (mountedRef.current) connect();
    }, delay);
  }, [isAuthenticated, user, startHttpPolling]);

  const connect = useCallback(() => {
    if (!isAuthenticated || !user || !mountedRef.current) return;
    if (connectingRef.current) return;
    // Don't try WS if already in HTTP mode
    if (mode === "http") return;

    // Close existing connection cleanly
    if (wsRef.current) {
      try {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    connectingRef.current = true;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/chat?userId=${user.id}&userName=${encodeURIComponent(user.name || "User")}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.log("[Chat] Connection timeout, closing...");
          wsFailCount.current++;
          try { ws.close(); } catch {}
        }
      }, 8000);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        connectingRef.current = false;
        setIsConnected(true);
        setMode("ws");
        reconnectAttempts.current = 0;
        wsFailCount.current = 0;
        console.log("[Chat] WebSocket connected");

        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "heartbeat" }));
          }
        }, HEARTBEAT_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case "history":
              if (data.messages) {
                setMessages(data.messages.map((m: any) => ({
                  id: m.id,
                  type: m.messageType === "image" ? "image" : m.messageType === "system" ? "system" : "message",
                  userId: m.userId,
                  userName: m.userName,
                  userColor: m.userColor,
                  content: m.content,
                  imageUrl: m.imageUrl,
                  timestamp: m.timestamp || m.createdAt,
                })));
              }
              break;

            case "message":
            case "image":
            case "system":
              setMessages(prev => [...prev, {
                id: data.id,
                type: data.type,
                userId: data.userId,
                userName: data.userName,
                userColor: data.userColor,
                content: data.content,
                imageUrl: data.imageUrl,
                timestamp: data.timestamp,
              }]);
              break;

            case "presence":
              if (data.onlineUsers) {
                setOnlineUsers(data.onlineUsers);
              }
              break;

            case "typing":
              if (data.typingUser && data.userId !== user.id) {
                setTypingUser(data.typingUser);
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 3000);
              }
              break;

            case "cleared":
              setMessages([]);
              break;
          }
        } catch (err) {
          console.error("[Chat] Parse error:", err);
        }
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        connectingRef.current = false;
        setIsConnected(false);
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }

        if (mountedRef.current && isAuthenticated) {
          wsFailCount.current++;
          console.log(`[Chat] Disconnected (code: ${event.code}), fail count: ${wsFailCount.current}`);
          scheduleReconnect();
        }
      };

      ws.onerror = () => {
        clearTimeout(connectionTimeout);
        connectingRef.current = false;
        wsFailCount.current++;
        // onclose will handle reconnection
      };
    } catch (err) {
      connectingRef.current = false;
      wsFailCount.current++;
      console.error("[Chat] Connection error:", err);
      if (mountedRef.current) scheduleReconnect();
    }
  }, [isAuthenticated, user, scheduleReconnect, mode]);

  // Reconnect on visibility change
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && mountedRef.current && isAuthenticated) {
        if (mode === "ws" && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
          reconnectAttempts.current = 0;
          connect();
        }
      }
    };

    const handleOnline = () => {
      if (mountedRef.current && isAuthenticated) {
        if (mode === "ws") {
          reconnectAttempts.current = 0;
          connect();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
    };
  }, [connect, isAuthenticated, mode]);

  useEffect(() => {
    mountedRef.current = true;
    if (isAuthenticated && user) {
      connect();
    }
    return () => {
      mountedRef.current = false;
      cleanup();
      if (wsRef.current) {
        try {
          wsRef.current.onclose = null;
          wsRef.current.close(1000, "Component unmounted");
        } catch {}
      }
    };
  }, [connect, cleanup, isAuthenticated, user]);

  // ─── Send functions (work in both modes) ───────────────────────────
  const sendMessage = useCallback((content: string) => {
    if (!content.trim()) return;
    if (mode === "ws" && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "message", content }));
    } else {
      // HTTP fallback
      sendMutation.mutate({ content }, {
        onSuccess: () => {
          // Messages will appear on next poll
        },
      });
    }
  }, [mode, sendMutation]);

  const sendImage = useCallback((base64Data: string, mime: string, caption?: string) => {
    if (mode === "ws" && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "image",
        imageData: base64Data,
        imageMime: mime,
        content: caption,
      }));
    } else {
      sendImageMutation.mutate({ base64Data, mime, caption });
    }
  }, [mode, sendImageMutation]);

  const sendTyping = useCallback(() => {
    if (mode === "ws" && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing" }));
    }
    // No typing indicator in HTTP mode
  }, [mode]);

  const clearMessages = useCallback(() => {
    if (mode === "ws" && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "clear_all" }));
    } else {
      clearMutation.mutate(undefined, {
        onSuccess: () => {
          setMessages([]);
          lastMessageIdRef.current = 0;
        },
      });
    }
  }, [mode, clearMutation]);

  return {
    messages,
    onlineUsers,
    isConnected,
    typingUser,
    sendMessage,
    sendImage,
    sendTyping,
    clearMessages,
    mode,
  };
}
