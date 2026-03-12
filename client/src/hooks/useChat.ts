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

const HTTP_POLL_INTERVAL = 3000;
const WS_CONNECT_TIMEOUT = 5000;
const WS_MAX_RETRIES = 2; // Try WS only twice before falling back to HTTP

export function useChat(): UseChatReturn {
  const { user, isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [mode, setMode] = useState<"ws" | "http">("ws");

  // Use refs to avoid stale closure issues
  const modeRef = useRef<"ws" | "http">("ws");
  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);
  const wsRetryCount = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMessageIdRef = useRef(0);
  const connectingRef = useRef(false);

  // tRPC mutations for HTTP mode
  const sendMutation = trpc.chat.send.useMutation();
  const sendImageMutation = trpc.chat.sendImage.useMutation();
  const clearMutation = trpc.chat.clearAll.useMutation();
  const utils = trpc.useUtils();

  // ─── Cleanup ──────────────────────────────────────────────────────
  const cleanupAll = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
  }, []);

  // ─── HTTP Polling Mode ────────────────────────────────────────────
  const startHttpPolling = useCallback(() => {
    if (pollTimerRef.current) return; // Already polling
    console.log("[Chat] Starting HTTP polling mode");
    modeRef.current = "http";
    setMode("http");
    setIsConnected(true);

    const fetchMessages = async () => {
      if (!mountedRef.current || !isAuthenticated) return;
      try {
        const msgs = await utils.chat.messages.fetch(
          { sinceId: lastMessageIdRef.current > 0 ? lastMessageIdRef.current : undefined },
          { staleTime: 0 }
        );
        if (!mountedRef.current || !msgs) return;
        if (msgs.length > 0) {
          const mapped = msgs.map((m: any) => ({
            id: m.id,
            type: (m.messageType === "image" ? "image" : m.messageType === "system" ? "system" : "message") as "message" | "image" | "system",
            userId: m.userId,
            userName: m.userName,
            userColor: m.userColor,
            content: m.content,
            imageUrl: m.imageUrl,
            timestamp: m.timestamp,
          }));

          if (lastMessageIdRef.current === 0) {
            setMessages(mapped);
          } else {
            setMessages(prev => {
              const existingIds = new Set(prev.map(p => p.id));
              const newMsgs = mapped.filter((m: any) => !existingIds.has(m.id));
              return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev;
            });
          }
          const maxId = Math.max(...msgs.map((m: any) => m.id || 0));
          if (maxId > lastMessageIdRef.current) {
            lastMessageIdRef.current = maxId;
          }
        }
      } catch (err) {
        // Silently handle - will retry on next poll
        console.debug("[Chat] Poll error:", err);
      }
    };

    const fetchOnlineUsers = async () => {
      if (!mountedRef.current || !isAuthenticated) return;
      try {
        const users = await utils.chat.onlineUsers.fetch(undefined, { staleTime: 0 });
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

  // ─── WebSocket Mode ───────────────────────────────────────────────
  const connectWebSocket = useCallback(() => {
    if (!isAuthenticated || !user || !mountedRef.current) return;
    if (connectingRef.current) return;
    if (modeRef.current === "http") return; // Already switched to HTTP

    connectingRef.current = true;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/chat?userId=${user.id}&userName=${encodeURIComponent(user.name || "User")}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.log("[Chat] WS connection timeout");
          connectingRef.current = false;
          wsRetryCount.current++;
          try { ws.close(); } catch {}
          
          if (wsRetryCount.current >= WS_MAX_RETRIES) {
            console.log("[Chat] WS failed after retries, switching to HTTP");
            startHttpPolling();
          } else {
            // Try again after a short delay
            setTimeout(() => {
              if (mountedRef.current && modeRef.current === "ws") {
                connectWebSocket();
              }
            }, 2000);
          }
        }
      }, WS_CONNECT_TIMEOUT);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        connectingRef.current = false;
        wsRetryCount.current = 0;
        modeRef.current = "ws";
        setMode("ws");
        setIsConnected(true);
        console.log("[Chat] WebSocket connected");

        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "heartbeat" }));
          }
        }, 10000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case "history":
              if (data.messages) {
                setMessages(data.messages.map((m: any) => ({
                  id: m.id,
                  type: (m.messageType === "image" ? "image" : m.messageType === "system" ? "system" : "message") as "message" | "image" | "system",
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
              if (data.onlineUsers) setOnlineUsers(data.onlineUsers);
              break;
            case "typing":
              if (data.typingUser && data.userId !== user?.id) {
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

      ws.onclose = () => {
        clearTimeout(connectionTimeout);
        connectingRef.current = false;
        setIsConnected(false);
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }

        if (mountedRef.current && isAuthenticated && modeRef.current === "ws") {
          wsRetryCount.current++;
          console.log(`[Chat] WS disconnected, retry count: ${wsRetryCount.current}`);
          if (wsRetryCount.current >= WS_MAX_RETRIES) {
            startHttpPolling();
          } else {
            setTimeout(() => {
              if (mountedRef.current && modeRef.current === "ws") {
                connectWebSocket();
              }
            }, 2000);
          }
        }
      };

      ws.onerror = () => {
        clearTimeout(connectionTimeout);
        connectingRef.current = false;
        // onclose will handle the retry/fallback logic
      };
    } catch (err) {
      connectingRef.current = false;
      wsRetryCount.current++;
      console.error("[Chat] WS connection error:", err);
      if (wsRetryCount.current >= WS_MAX_RETRIES) {
        startHttpPolling();
      }
    }
  }, [isAuthenticated, user, startHttpPolling]);

  // ─── Initialize connection ────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    if (isAuthenticated && user) {
      // Reset state
      wsRetryCount.current = 0;
      modeRef.current = "ws";
      connectWebSocket();
    }
    return () => {
      mountedRef.current = false;
      cleanupAll();
    };
  }, [isAuthenticated, user, connectWebSocket, cleanupAll]);

  // ─── Reconnect on visibility change ───────────────────────────────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && mountedRef.current && isAuthenticated) {
        if (modeRef.current === "http") {
          // In HTTP mode, just make sure polling is running
          if (!pollTimerRef.current) {
            startHttpPolling();
          }
        } else if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          wsRetryCount.current = 0;
          connectWebSocket();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [isAuthenticated, connectWebSocket, startHttpPolling]);

  // ─── Send functions ───────────────────────────────────────────────
  const sendMessage = useCallback((content: string) => {
    if (!content.trim()) return;
    if (modeRef.current === "ws" && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "message", content }));
    } else {
      sendMutation.mutate({ content });
    }
  }, [sendMutation]);

  const sendImage = useCallback((base64Data: string, mime: string, caption?: string) => {
    if (modeRef.current === "ws" && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "image", imageData: base64Data, imageMime: mime, content: caption }));
    } else {
      sendImageMutation.mutate({ base64Data, mime, caption });
    }
  }, [sendImageMutation]);

  const sendTyping = useCallback(() => {
    if (modeRef.current === "ws" && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing" }));
    }
  }, []);

  const clearMessages = useCallback(() => {
    if (modeRef.current === "ws" && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "clear_all" }));
    } else {
      clearMutation.mutate(undefined, {
        onSuccess: () => {
          setMessages([]);
          lastMessageIdRef.current = 0;
        },
      });
    }
  }, [clearMutation]);

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
