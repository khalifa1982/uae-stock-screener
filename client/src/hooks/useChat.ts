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
}

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

  const connect = useCallback(() => {
    if (!isAuthenticated || !user) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/chat?userId=${user.id}&userName=${encodeURIComponent(user.name || "User")}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttempts.current = 0;

        // Start heartbeat
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
              // Load today's message history
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
          }
        } catch (err) {
          console.error("[Chat] Parse error:", err);
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }

        // Reconnect with exponential backoff
        if (event.code !== 4001 && event.code !== 4002) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          reconnectRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        // onclose will handle reconnection
      };
    } catch (err) {
      console.error("[Chat] Connection error:", err);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounted");
      }
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [connect]);

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

  return {
    messages,
    onlineUsers,
    isConnected,
    typingUser,
    sendMessage,
    sendImage,
    sendTyping,
  };
}
