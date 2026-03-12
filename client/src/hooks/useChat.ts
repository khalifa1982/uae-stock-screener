import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

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
}

const MAX_RECONNECT_DELAY = 15000;
const INITIAL_RECONNECT_DELAY = 2000;
const HEARTBEAT_INTERVAL = 10000;

export function useChat(): UseChatReturn {
  const { user, isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const mountedRef = useRef(true);
  const connectingRef = useRef(false);

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
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current || !isAuthenticated || !user) return;
    if (reconnectRef.current) clearTimeout(reconnectRef.current);

    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts.current),
      MAX_RECONNECT_DELAY
    );
    reconnectAttempts.current++;
    console.log(`[Chat] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectAttempts.current})`);
    reconnectRef.current = setTimeout(() => {
      if (mountedRef.current) connect();
    }, delay);
  }, [isAuthenticated, user]);

  const connect = useCallback(() => {
    if (!isAuthenticated || !user || !mountedRef.current) return;
    if (connectingRef.current) return;

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
          try { ws.close(); } catch {}
        }
      }, 10000);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        connectingRef.current = false;
        setIsConnected(true);
        reconnectAttempts.current = 0;
        console.log("[Chat] Connected");

        // Start heartbeat
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
              // Admin cleared all messages
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

        // ALWAYS reconnect regardless of close code (4001, 4002, etc.)
        // The only exception is if the component is unmounted
        if (mountedRef.current && isAuthenticated) {
          console.log(`[Chat] Disconnected (code: ${event.code}), scheduling reconnect...`);
          scheduleReconnect();
        }
      };

      ws.onerror = (err) => {
        clearTimeout(connectionTimeout);
        connectingRef.current = false;
        console.error("[Chat] WebSocket error:", err);
        // onclose will handle reconnection
      };
    } catch (err) {
      connectingRef.current = false;
      console.error("[Chat] Connection error:", err);
      if (mountedRef.current) scheduleReconnect();
    }
  }, [isAuthenticated, user, scheduleReconnect]);

  // Also reconnect on visibility change (tab becomes active again)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && mountedRef.current && isAuthenticated) {
        // If not connected, reconnect immediately
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          reconnectAttempts.current = 0;
          connect();
        }
      }
    };

    const handleOnline = () => {
      if (mountedRef.current && isAuthenticated) {
        reconnectAttempts.current = 0;
        connect();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
    };
  }, [connect, isAuthenticated]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
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
  }, [connect, cleanup]);

  const sendMessage = useCallback((content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && content.trim()) {
      wsRef.current.send(JSON.stringify({ type: "message", content }));
    }
  }, []);

  const sendImage = useCallback((base64Data: string, mime: string, caption?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "image",
        imageData: base64Data,
        imageMime: mime,
        content: caption,
      }));
    }
  }, []);

  const sendTyping = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing" }));
    }
  }, []);

  const clearMessages = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "clear_all" }));
    }
  }, []);

  return {
    messages,
    onlineUsers,
    isConnected,
    typingUser,
    sendMessage,
    sendImage,
    sendTyping,
    clearMessages,
  };
}
