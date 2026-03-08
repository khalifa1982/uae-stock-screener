import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAuthContext(userId = 1) {
  const ctx: TrpcContext = {
    user: {
      id: userId,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
  return ctx;
}

function createUnauthContext() {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
  return ctx;
}

describe("notifications router", () => {
  it("notifications.list requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.notifications.list()).rejects.toThrow();
  });

  it("notifications.unreadCount requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.notifications.unreadCount()).rejects.toThrow();
  });

  it("notifications.markRead requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.notifications.markRead({ notificationId: 1 })).rejects.toThrow();
  });

  it("notifications.markAllRead requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.notifications.markAllRead()).rejects.toThrow();
  });

  it("notifications.delete requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.notifications.delete({ notificationId: 1 })).rejects.toThrow();
  });

  it("notifications.list returns array for authenticated user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.notifications.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("notifications.unreadCount returns a number for authenticated user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.notifications.unreadCount();
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("notifications.markAllRead returns success for authenticated user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.notifications.markAllRead();
    expect(result).toEqual({ success: true });
  });
});

describe("notification data structure", () => {
  it("notification schema has all required fields", async () => {
    // Verify the schema imports work correctly
    const schema = await import("../drizzle/schema");
    expect(schema.notifications).toBeDefined();
    // Check that the table object exists and has expected shape
    const notifTable = schema.notifications;
    expect(notifTable).toHaveProperty("id");
    expect(notifTable).toHaveProperty("userId");
    expect(notifTable).toHaveProperty("type");
    expect(notifTable).toHaveProperty("title");
    expect(notifTable).toHaveProperty("message");
    expect(notifTable).toHaveProperty("symbol");
    expect(notifTable).toHaveProperty("severity");
    expect(notifTable).toHaveProperty("isRead");
  });
});
