import { useState, useRef, useEffect, useCallback } from "react";
import { useChat, type ChatMessageData, type OnlineUser, type ReactionData } from "@/hooks/useChat";
import { useAuth } from "@/_core/hooks/useAuth";
import { MessageCircle, X, Send, Image, Smile, Users, Wifi, WifiOff, ChevronDown, Reply, CornerDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Constants ─────────────────────────────────────────────────────
const QUICK_EMOJIS = [
  "😀", "😂", "🤣", "😍", "🥰", "😎", "🤔", "😮", "😢", "😡",
  "👍", "👎", "👏", "🙏", "💪", "🔥", "❤️", "💯", "🎉", "🚀",
  "📈", "📉", "💰", "💵", "🏦", "📊", "⚡", "✅", "❌", "⭐",
  "🇦🇪", "🏆", "💎", "🐂", "🐻", "🤝", "👀", "💡", "⏰", "🎯",
];

const REACTION_EMOJIS = ["👍", "❤️", "😂", "🔥", "📈", "📉"];

// ─── Emoji Picker ──────────────────────────────────────────────────
function EmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  return (
    <div
      className="absolute bottom-full left-0 mb-2 rounded-lg shadow-xl p-3 z-50 w-[280px] border border-border"
      style={{ backgroundColor: "oklch(0.14 0.014 260)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">Quick Emojis</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-10 gap-1">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => { onSelect(emoji); onClose(); }}
            className="w-6 h-6 flex items-center justify-center text-xs hover:bg-accent rounded transition-colors"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Reaction Bar (on hover/long-press) ────────────────────────────
function ReactionBar({
  messageId,
  onReact,
  onReply,
}: {
  messageId: number;
  onReact: (messageId: number, emoji: string) => void;
  onReply: () => void;
}) {
  return (
    <div
      className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 shadow-lg border border-border/50 animate-in fade-in zoom-in-95 duration-150"
      style={{ backgroundColor: "oklch(0.16 0.014 260)" }}
    >
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onReact(messageId, emoji)}
          className="w-6 h-6 flex items-center justify-center text-xs hover:scale-125 transition-transform rounded-full hover:bg-accent/50"
        >
          {emoji}
        </button>
      ))}
      <div className="w-px h-4 bg-border/50 mx-0.5" />
      <button
        onClick={onReply}
        className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:scale-110 transition-all rounded-full hover:bg-accent/50"
        title="Reply"
      >
        <Reply className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── Reaction Display ──────────────────────────────────────────────
function ReactionsDisplay({
  reactions,
  messageId,
  currentUserId,
  onReact,
}: {
  reactions: ReactionData[];
  messageId: number;
  currentUserId?: number;
  onReact: (messageId: number, emoji: string) => void;
}) {
  if (!reactions || reactions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {reactions.map((r) => {
        const hasReacted = r.users.some(u => u.userId === currentUserId);
        return (
          <button
            key={r.emoji}
            onClick={() => onReact(messageId, r.emoji)}
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] transition-colors border ${
              hasReacted
                ? "bg-primary/20 border-primary/40 text-primary"
                : "bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted"
            }`}
            title={r.users.map(u => u.userName).join(", ")}
          >
            <span>{r.emoji}</span>
            <span className="font-medium">{r.count}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Reply Preview (in message) ────────────────────────────────────
function ReplyPreview({ userName, content, type }: { userName?: string; content?: string; type?: string }) {
  if (!userName) return null;
  return (
    <div className="flex items-start gap-1 mb-1 pl-2 border-l-2 border-primary/40 opacity-75">
      <CornerDownRight className="w-2.5 h-2.5 mt-0.5 shrink-0 text-primary/60" />
      <div className="min-w-0">
        <span className="text-[9px] font-semibold text-primary/80">{userName}</span>
        <p className="text-[9px] truncate max-w-[180px]">
          {type === "image" ? "📷 Photo" : (content || "...")}
        </p>
      </div>
    </div>
  );
}

// ─── Avatar Component ──────────────────────────────────────────────
function UserAvatar({ name, color, size = "sm" }: { name: string; color: string; size?: "sm" | "md" }) {
  const initials = (name || "?")
    .split(" ")
    .map(w => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
  const sizeClass = size === "md" ? "w-8 h-8 text-xs" : "w-6 h-6 text-[10px]";
  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center text-white font-bold shrink-0`}
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
}

// ─── Message Bubble ────────────────────────────────────────────────
function MessageBubble({
  msg,
  isOwn,
  currentUserId,
  onReact,
  onReply,
}: {
  msg: ChatMessageData;
  isOwn: boolean;
  currentUserId?: number;
  onReact: (messageId: number, emoji: string) => void;
  onReply: (msg: ChatMessageData) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (msg.type === "system") {
    return (
      <div className="flex justify-center my-1.5">
        <span className="text-[10px] text-muted-foreground bg-muted/50 px-2.5 py-0.5 rounded-full">
          {msg.content}
        </span>
      </div>
    );
  }

  const time = msg.timestamp
    ? new Date(msg.timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Dubai",
      })
    : "";

  const isArabic = msg.content ? /[\u0600-\u06FF]/.test(msg.content) : false;

  const handleMouseEnter = () => {
    hoverTimeoutRef.current = setTimeout(() => setShowActions(true), 200);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setShowActions(false);
  };

  return (
    <div
      className={`flex gap-1.5 mb-2 group relative ${isOwn ? "flex-row-reverse" : "flex-row"}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {!isOwn && (
        <UserAvatar name={msg.userName || "?"} color={msg.userColor || "#666"} />
      )}
      <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"} relative`}>
        {!isOwn && (
          <div className="flex items-center gap-1.5 ml-1 mb-0.5">
            <span className="text-[10px] font-medium" style={{ color: msg.userColor }}>
              {msg.userName}
            </span>
            <span className="text-[9px] text-muted-foreground/50">{time}</span>
          </div>
        )}
        <div
          className={`rounded-lg px-3 py-1.5 text-[11px] break-words ${
            isOwn
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-muted text-foreground rounded-bl-sm"
          }`}
          dir={isArabic ? "rtl" : "ltr"}
        >
          {/* Reply preview */}
          {msg.replyToId && (
            <ReplyPreview
              userName={msg.replyToUserName}
              content={msg.replyToContent}
              type={msg.replyToType}
            />
          )}
          {msg.type === "image" && msg.imageUrl && (
            <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer">
              <img
                src={msg.imageUrl}
                alt="Shared image"
                className="max-w-full max-h-48 rounded mb-1 cursor-pointer hover:opacity-90 transition-opacity"
                loading="lazy"
              />
            </a>
          )}
          {msg.content && <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>}
        </div>
        {isOwn && (
          <span className="text-[9px] text-muted-foreground/50 mt-0.5 block text-right mr-1">
            {time}
          </span>
        )}
        {/* Reactions display */}
        {msg.id && (
          <ReactionsDisplay
            reactions={msg.reactions || []}
            messageId={msg.id}
            currentUserId={currentUserId}
            onReact={onReact}
          />
        )}
        {/* Action bar on hover */}
        {showActions && msg.id && (
          <div className={`absolute ${isOwn ? "left-0 -translate-x-full" : "right-0 translate-x-full"} top-0 z-10 px-1`}>
            <ReactionBar
              messageId={msg.id}
              onReact={onReact}
              onReply={() => onReply(msg)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Online Users Panel ────────────────────────────────────────────
function OnlineUsersPanel({ users, onClose }: { users: OnlineUser[]; onClose: () => void }) {
  return (
    <div
      className="absolute top-0 right-0 w-48 h-full border-l border-border z-50 flex flex-col"
      style={{ backgroundColor: "oklch(0.12 0.014 260)" }}
    >
      <div className="flex items-center justify-between p-3 border-b border-border">
        <span className="text-xs font-semibold">Online ({users.length})</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {users.map((u) => (
          <div key={u.userId} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-accent/50">
            <div className="relative">
              <UserAvatar name={u.userName} color={u.userColor} size="md" />
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-popover" />
            </div>
            <span className="text-xs font-medium truncate">{u.userName}</span>
          </div>
        ))}
        {users.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-1.5">No users online</p>
        )}
      </div>
    </div>
  );
}

// ─── Typing Indicator ──────────────────────────────────────────────
function TypingIndicator({ users }: { users: string[] }) {
  if (users.length === 0) return null;
  const text = users.length === 1
    ? `${users[0]} is typing`
    : users.length === 2
    ? `${users[0]} and ${users[1]} are typing`
    : `${users[0]} and ${users.length - 1} others are typing`;

  return (
    <div className="px-3 py-1 flex items-center gap-1.5">
      <div className="flex gap-0.5">
        <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      <span className="text-[10px] text-muted-foreground italic">{text}</span>
    </div>
  );
}

// ─── Reply Banner ──────────────────────────────────────────────────
function ReplyBanner({
  replyTo,
  onCancel,
}: {
  replyTo: ChatMessageData;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-t border-border bg-primary/5">
      <Reply className="w-3.5 h-3.5 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-semibold text-primary">{replyTo.userName}</span>
        <p className="text-[10px] text-muted-foreground truncate">
          {replyTo.type === "image" ? "📷 Photo" : (replyTo.content || "...")}
        </p>
      </div>
      <button onClick={onCancel} className="text-muted-foreground hover:text-foreground shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Main LiveChat Component ───────────────────────────────────────
export function LiveChat() {
  const { user, isAuthenticated } = useAuth();
  const {
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
  } = useChat();
  const isAdmin = user?.role === "admin";

  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [replyTo, setReplyTo] = useState<ChatMessageData | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevNewMessageFlagRef = useRef(0);

  // ─── Auto-open chat when new messages arrive while logged in ─────
  useEffect(() => {
    if (newMessageFlag > prevNewMessageFlagRef.current && !isOpen && isAuthenticated) {
      setIsOpen(true);
    }
    prevNewMessageFlagRef.current = newMessageFlag;
  }, [newMessageFlag, isOpen, isAuthenticated]);

  // ─── Auto-scroll to bottom when new messages arrive ──────────────
  useEffect(() => {
    if (!isOpen) {
      setUnreadCount(prev => prev + 1);
      return;
    }
    const container = messagesContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      setShowScrollDown(true);
    }
  }, [messages, isOpen]);

  // ─── Reset unread when opening ───────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "instant" as ScrollBehavior });
      }, 100);
    }
  }, [isOpen]);

  // ─── Scroll handler ──────────────────────────────────────────────
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setShowScrollDown(!isNearBottom);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollDown(false);
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendMessage(inputText, replyTo?.id);
    setInputText("");
    setReplyTo(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape" && replyTo) {
      setReplyTo(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => sendTyping(), 500);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be under 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      sendImage(base64, file.type);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleEmojiSelect = (emoji: string) => {
    setInputText(prev => prev + emoji);
    inputRef.current?.focus();
  };

  const handleReply = (msg: ChatMessageData) => {
    setReplyTo(msg);
    inputRef.current?.focus();
  };

  if (!isAuthenticated) return null;

  // ─── Floating chat button (when closed) ──────────────────────────
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-[90] w-12 h-12 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
      >
        <MessageCircle className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
    );
  }

  // ─── Chat panel (when open) ──────────────────────────────────────
  return (
    <div
      className="fixed bottom-0 right-0 md:bottom-4 md:right-4 z-[200] w-full md:w-[360px] h-[100dvh] md:h-[520px] md:rounded-lg border border-border shadow-2xl flex flex-col overflow-hidden"
      style={{ backgroundColor: "oklch(0.10 0.014 260)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-primary text-primary-foreground shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          <span className="font-semibold text-[11px]">Live Chat</span>
          <span className="flex items-center gap-1 text-[10px] opacity-80">
            {isConnected ? (
              <>
                <Wifi className="w-3 h-3" />
                <span>{mode === "http" ? "HTTP" : "Live"}</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 animate-pulse" />
                <span>Connecting...</span>
              </>
            )}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isAdmin && (
            <button
              onClick={() => {
                if (window.confirm("Clear all chat messages for today?")) {
                  clearMessages();
                }
              }}
              className="p-1.5 rounded hover:bg-white/20 transition-colors"
              title="Clear all messages (Admin)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          )}
          <button
            onClick={() => setShowUsers(!showUsers)}
            className="p-1.5 rounded hover:bg-white/20 transition-colors relative"
            title="Online users"
          >
            <Users className="w-4 h-4" />
            {onlineUsers.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 text-[8px] font-bold text-black rounded-full flex items-center justify-center">
                {onlineUsers.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 relative overflow-hidden">
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto px-3 py-2 scroll-smooth"
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageCircle className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-[11px] font-medium">No messages yet today</p>
              <p className="text-xs opacity-70">Be the first to say hello!</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <MessageBubble
              key={msg.id || `msg-${i}`}
              msg={msg}
              isOwn={msg.userId === user?.id}
              currentUserId={user?.id}
              onReact={sendReaction}
              onReply={handleReply}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Scroll to bottom button */}
        {showScrollDown && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground rounded-full p-1.5 shadow-lg hover:scale-105 transition-transform"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        )}

        {/* Online users panel */}
        {showUsers && (
          <OnlineUsersPanel users={onlineUsers} onClose={() => setShowUsers(false)} />
        )}
      </div>

      {/* Typing indicator */}
      <TypingIndicator users={typingUsers} />

      {/* Reply banner */}
      {replyTo && (
        <ReplyBanner replyTo={replyTo} onCancel={() => setReplyTo(null)} />
      )}

      {/* Input area */}
      <div className="shrink-0 border-t border-border px-2 py-2 relative" style={{ backgroundColor: "oklch(0.12 0.014 260)" }}>
        {showEmoji && (
          <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmoji(false)} />
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowEmoji(!showEmoji)}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Emoji"
          >
            <Smile className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Upload image"
          >
            <Image className="w-4.5 h-4.5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={replyTo ? `Reply to ${replyTo.userName}...` : "Type a message..."}
            className="flex-1 bg-muted/50 border border-border rounded-full px-3 py-1.5 text-[11px] outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/60"
            dir="auto"
            autoComplete="off"
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="rounded-full w-8 h-8 shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
