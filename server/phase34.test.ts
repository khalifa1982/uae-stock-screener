import { describe, it, expect } from "vitest";
import { getChatMessages, getOnlineUsersList, registerPollingUser } from "./services/chatService";

describe("Phase 34 - Chat HTTP Polling", () => {
  it("getChatMessages returns an array", async () => {
    const messages = await getChatMessages();
    expect(Array.isArray(messages)).toBe(true);
  });

  it("getChatMessages with sinceId returns an array", async () => {
    const messages = await getChatMessages(0);
    expect(Array.isArray(messages)).toBe(true);
  });

  it("getOnlineUsersList returns an array", () => {
    const users = getOnlineUsersList();
    expect(Array.isArray(users)).toBe(true);
  });

  it("registerPollingUser adds user to online list", () => {
    registerPollingUser(999, "TestUser");
    const users = getOnlineUsersList();
    const found = users.find((u: any) => u.userId === 999);
    expect(found).toBeTruthy();
    expect(found?.userName).toBe("TestUser");
  });
});
