import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ─── Helper to read source files ──────────────────────────────────
function readSrc(relPath: string): string {
  return readFileSync(resolve(__dirname, "..", relPath), "utf-8");
}

describe("Phase 41 — Bottom Toolbar Gap Fix", () => {
  it("TerminalLayout adds bottom padding for mobile to prevent content behind fixed nav", () => {
    const src = readSrc("client/src/components/TerminalLayout.tsx");
    // Should have pb-20 or similar bottom padding for mobile
    expect(src).toMatch(/pb-2[0-9]|pb-\[|paddingBottom/);
  });

  it("DashboardLayout adds bottom padding for mobile", () => {
    const src = readSrc("client/src/components/DashboardLayout.tsx");
    expect(src).toMatch(/pb-2[0-9]|pb-\[|paddingBottom/);
  });
});

describe("Phase 41 — User Profile Page", () => {
  it("Profile page component exists", () => {
    const src = readSrc("client/src/pages/Profile.tsx");
    expect(src).toContain("Profile");
    expect(src).toContain("trpc.auth.getProfile");
    expect(src).toContain("trpc.auth.updateProfile");
  });

  it("Profile page shows name, email, mobile fields", () => {
    const src = readSrc("client/src/pages/Profile.tsx");
    expect(src).toContain("Display Name");
    expect(src).toContain("Email Address");
    expect(src).toContain("Mobile Number");
  });

  it("Profile page allows editing name", () => {
    const src = readSrc("client/src/pages/Profile.tsx");
    expect(src).toContain("handleSaveName");
    expect(src).toContain("editName");
  });

  it("Profile page allows editing mobile number", () => {
    const src = readSrc("client/src/pages/Profile.tsx");
    expect(src).toContain("handleSaveMobile");
    expect(src).toContain("editMobile");
  });

  it("Profile page has avatar emoji picker", () => {
    const src = readSrc("client/src/pages/Profile.tsx");
    expect(src).toContain("AVATAR_EMOJIS");
    expect(src).toContain("handleSelectEmoji");
    expect(src).toContain("showEmojiPicker");
  });

  it("Profile route is registered in App.tsx", () => {
    const src = readSrc("client/src/App.tsx");
    expect(src).toContain('path={"/profile"}');
    expect(src).toContain("Profile");
  });

  it("Profile link exists in TerminalLayout user dropdown", () => {
    const src = readSrc("client/src/components/TerminalLayout.tsx");
    expect(src).toContain('"/profile"');
    expect(src).toContain("UserCircle");
    expect(src).toContain("Profile");
  });

  it("Backend has updateProfile endpoint", () => {
    const src = readSrc("server/routers.ts");
    expect(src).toContain("updateProfile");
    expect(src).toContain("updateUserProfile");
  });

  it("Backend has getProfile endpoint", () => {
    const src = readSrc("server/routers.ts");
    expect(src).toContain("getProfile");
    expect(src).toContain("mobileNumber");
    expect(src).toContain("avatarEmoji");
  });

  it("Database schema has mobileNumber and avatarEmoji fields", () => {
    const src = readSrc("drizzle/schema.ts");
    expect(src).toContain("mobileNumber");
    expect(src).toContain("avatarEmoji");
  });

  it("db.ts has updateUserProfile function", () => {
    const src = readSrc("server/db.ts");
    expect(src).toContain("updateUserProfile");
    expect(src).toContain("mobileNumber");
    expect(src).toContain("avatarEmoji");
  });
});

describe("Phase 41 — Chat Emoji Avatars", () => {
  it("LiveChat has AVATAR_EMOJIS array for deterministic emoji avatars", () => {
    const src = readSrc("client/src/components/LiveChat.tsx");
    expect(src).toContain("AVATAR_EMOJIS");
    expect(src).toContain("getEmojiForUser");
  });

  it("UserAvatar component accepts userId prop", () => {
    const src = readSrc("client/src/components/LiveChat.tsx");
    expect(src).toContain("userId?: number");
    expect(src).toContain("getEmojiForUser(userId)");
  });

  it("UserAvatar renders emoji instead of text initials", () => {
    const src = readSrc("client/src/components/LiveChat.tsx");
    // Should NOT contain initials logic
    expect(src).not.toMatch(/\.split\(" "\)\s*\.map\(w => w\[0\]\)/);
    // Should contain emoji rendering
    expect(src).toContain("{emoji}");
  });

  it("UserAvatar passes userId in message bubbles", () => {
    const src = readSrc("client/src/components/LiveChat.tsx");
    expect(src).toContain("userId={msg.userId}");
  });

  it("UserAvatar passes userId in online users list", () => {
    const src = readSrc("client/src/components/LiveChat.tsx");
    expect(src).toContain("userId={u.userId}");
  });

  it("getEmojiForUser returns robot emoji for system messages (userId 0)", () => {
    const src = readSrc("client/src/components/LiveChat.tsx");
    expect(src).toContain('return "🤖"');
  });

  it("AVATAR_EMOJIS has enough variety (at least 30 emojis)", () => {
    const src = readSrc("client/src/components/LiveChat.tsx");
    const match = src.match(/const AVATAR_EMOJIS = \[([\s\S]*?)\];/);
    expect(match).toBeTruthy();
    const emojis = match![1].match(/"[^"]+"/g);
    expect(emojis!.length).toBeGreaterThanOrEqual(30);
  });
});
