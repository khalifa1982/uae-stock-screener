import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

export interface ReactionData {
  emoji: string;
  count: number;
  users: { userId: number; userName: string }[];
}

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
  reactions?: ReactionData[];
  replyToId?: number;
  replyToContent?: string;
  replyToUserName?: string;
  replyToType?: string;
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
  typingUsers: string[];
  sendMessage: (content: string, replyToId?: number) => void;
  sendImage: (base64Data: string, mime: string, caption?: string) => void;
  sendTyping: () => void;
  sendReaction: (messageId: number, emoji: string) => void;
  clearMessages: () => void;
  mode: "ws" | "http";
  newMessageFlag: number; // increments on each new non-own message for auto-open
}

const HTTP_POLL_INTERVAL = 3000;
const WS_CONNECT_TIMEOUT = 5000;
const WS_MAX_RETRIES = 2;

export function useChat(): UseChatReturn {
  const { user, isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [mode, setMode] = useState<"ws" | "http">("ws");
  const [newMessageFlag, setNewMessageFlag] = useState(0);

  const modeRef = useRef<"ws" | "http">("ws");
  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);
  const wsRetryCount = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastMessageIdRef = useRef(0);
  const connectingRef = useRef(false);
  const lastClearedAtRef = useRef(0);

  const sendMutation = trpc.chat.send.useMutation();
  const sendImageMutation = trpc.chat.sendImage.useMutation();
  const clearMutation = trpc.chat.clearAll.useMutation();
  const reactMutation = trpc.chat.react.useMutation();
  const utils = trpc.useUtils();

  // ─── Helper: update reactions on a message ───────────────────────
  const updateMessageReactions = useCallback((messageId: number, reactions: ReactionData[]) => {
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, reactions } : m
    ));
  }, []);

  // ─── Helper: add typing user with auto-expire ────────────────────
  const addTypingUser = useCallback((userName: string) => {
    setTypingUsers(prev => {
      if (prev.includes(userName)) return prev;
      return [...prev, userName];
    });
    // Clear existing timeout for this user
    const existing = typingTimeoutsRef.current.get(userName);
    if (existing) clearTimeout(existing);
    // Set new timeout to remove after 3s
    const timeout = setTimeout(() => {
      setTypingUsers(prev => prev.filter(u => u !== userName));
      typingTimeoutsRef.current.delete(userName);
    }, 3000);
    typingTimeoutsRef.current.set(userName, timeout);
  }, []);

  // ─── Cleanup ──────────────────────────────────────────────────────
  const cleanupAll = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    typingTimeoutsRef.current.forEach(t => clearTimeout(t));
    typingTimeoutsRef.current.clear();
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
    if (pollTimerRef.current) return;
    console.log("[Chat] Starting HTTP polling mode");
    modeRef.current = "http";
    setMode("http");
    setIsConnected(true);

    const fetchMessages = async () => {
      if (!mountedRef.current || !isAuthenticated) return;
      try {
        const msgs = await utils.chat.messages.fetch(
          { sinceId: undefined },
          { staleTime: 0 }
        );
        if (!mountedRef.current || !msgs) return;

        const mapped = msgs.map((m: any) => ({
          id: m.id,
          type: (m.messageType === "image" ? "image" : m.messageType === "system" ? "system" : "message") as "message" | "image" | "system",
          userId: m.userId,
          userName: m.userName,
          userColor: m.userColor,
          content: m.content,
          imageUrl: m.imageUrl,
          timestamp: m.timestamp,
          reactions: m.reactions || [],
          replyToId: m.replyToId,
        }));

        setMessages(mapped);

        if (msgs.length > 0) {
          const maxId = Math.max(...msgs.map((m: any) => m.id || 0));
          if (maxId > lastMessageIdRef.current) {
            setNewMessageFlag(prev => prev + 1);
          }
          lastMessageIdRef.current = maxId;
        } else {
          lastMessageIdRef.current = 0;
        }
      } catch (err) {
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

    const checkChatCleared = async () => {
      if (!mountedRef.current || !isAuthenticated) return;
      try {
        const result = await utils.chat.clearedAt.fetch(undefined, { staleTime: 0 });
        if (!mountedRef.current || !result) return;
        if (result.clearedAt > lastClearedAtRef.current) {
          lastClearedAtRef.current = result.clearedAt;
          setMessages([]);
          lastMessageIdRef.current = 0;
        }
      } catch {}
    };

    fetchMessages();
    fetchOnlineUsers();

    pollTimerRef.current = setInterval(() => {
      fetchMessages();
      fetchOnlineUsers();
      checkChatCleared();
    }, HTTP_POLL_INTERVAL);
  }, [isAuthenticated, utils]);

  // ─── WebSocket Mode ───────────────────────────────────────────────
  const connectWebSocket = useCallback(() => {
    if (!isAuthenticated || !user || !mountedRef.current) return;
    if (connectingRef.current) return;
    if (modeRef.current === "http") return;

    connectingRef.current = true;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/chat?userId=${user.id}&userName=${encodeURIComponent(user.name || "User")}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          connectingRef.current = false;
          wsRetryCount.current++;
          try { ws.close(); } catch {}
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
      }, WS_CONNECT_TIMEOUT);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        connectingRef.current = false;
        wsRetryCount.current = 0;
        modeRef.current = "ws";
        setMode("ws");
        setIsConnected(true);

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
                  reactions: m.reactions || [],
                  replyToId: m.replyToId,
                  replyToContent: m.replyToContent,
                  replyToUserName: m.replyToUserName,
                  replyToType: m.replyToType,
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
                reactions: [],
                replyToId: data.replyToId,
                replyToContent: data.replyToContent,
                replyToUserName: data.replyToUserName,
                replyToType: data.replyToType,
              }]);
              // Signal new message for auto-open (only for non-own messages)
              if (data.userId !== user?.id && data.type !== "system") {
                setNewMessageFlag(prev => prev + 1);
              }
              // Remove typing indicator for this user
              if (data.userName) {
                setTypingUsers(prev => prev.filter(u => u !== data.userName));
              }
              break;
            case "presence":
              if (data.onlineUsers) setOnlineUsers(data.onlineUsers);
              break;
            case "typing":
              if (data.typingUser && data.userId !== user?.id) {
                addTypingUser(data.typingUser);
              }
              break;
            case "cleared":
              setMessages([]);
              lastMessageIdRef.current = 0;
              break;
            case "reaction":
            case "reaction_removed":
              if (data.messageId && data.reactions) {
                updateMessageReactions(data.messageId, data.reactions);
              }
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
      };
    } catch (err) {
      connectingRef.current = false;
      wsRetryCount.current++;
      if (wsRetryCount.current >= WS_MAX_RETRIES) {
        startHttpPolling();
      }
    }
  }, [isAuthenticated, user, startHttpPolling, addTypingUser, updateMessageReactions]);

  // ─── Initialize connection ────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    if (isAuthenticated && user) {
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
          if (!pollTimerRef.current) startHttpPolling();
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
  const sendMessage = useCallback((content: string, replyToId?: number) => {
    if (!content.trim()) return;
    if (modeRef.current === "ws" && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: replyToId ? "reply" : "message",
        content,
        replyToId,
      }));
    } else {
      sendMutation.mutate({ content, replyToId });
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

  const sendReaction = useCallback((messageId: number, emoji: string) => {
    if (modeRef.current === "ws" && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "reaction", messageId, emoji }));
    } else {
      reactMutation.mutate({ messageId, emoji });
    }
  }, [reactMutation]);

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
    typingUsers,
    sendMessage,
    sendImage,
    sendTyping,
    sendReaction,
    clearMessages,
    mode,
    newMessageFlag,
  };
}
