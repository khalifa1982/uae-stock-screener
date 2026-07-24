import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import bcrypt from "bcryptjs";
import { randomUUID, randomBytes } from "crypto";
import { users } from "../../drizzle/schema";
import { eq, and, gt } from "drizzle-orm";

/**
 * Standalone auth routes - replaces Manus OAuth with username/password auth.
 * Includes forgot password / reset password flow.
 *
 * Express 5 natively catches rejected promises from async route handlers
 * and forwards them to the global error handler. No manual try/catch needed.
 */
export function registerOAuthRoutes(app: Express) {
  // ─── Register (signup) ─────────────────────────────────────────────
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const { email, password, name } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    const dbInstance = await db.getDb();
    if (!dbInstance) {
      res.status(500).json({ error: "Database not available" });
      return;
    }

    const existing = await dbInstance.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const openId = randomUUID();

    await db.upsertUser({
      openId,
      name: name || email.split("@")[0],
      email,
      passwordHash,
      loginMethod: "email",
      lastSignedIn: new Date(),
    });

    const sessionToken = await sdk.createSessionToken(openId, {
      name: name || email.split("@")[0],
      expiresInMs: ONE_YEAR_MS,
    });

    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
    res.json({ success: true, message: "Account created successfully" });
  });

  // ─── Login ─────────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const dbInstance = await db.getDb();
    if (!dbInstance) {
      res.status(500).json({ error: "Database not available" });
      return;
    }

    const result = await dbInstance.select().from(users).where(eq(users.email, email)).limit(1);
    const user = result[0];

    if (!user || !user.passwordHash) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    await db.upsertUser({
      openId: user.openId,
      lastSignedIn: new Date(),
    });

    const sessionToken = await sdk.createSessionToken(user.openId, {
      name: user.name || "",
      expiresInMs: ONE_YEAR_MS,
    });

    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
    res.json({ success: true, message: "Login successful" });
  });

  // ─── Forgot Password (request reset) ──────────────────────────────
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    const dbInstance = await db.getDb();
    if (!dbInstance) {
      res.status(500).json({ error: "Database not available" });
      return;
    }

    const result = await dbInstance.select().from(users).where(eq(users.email, email)).limit(1);
    const user = result[0];

    // Always return success to prevent email enumeration
    if (!user) {
      res.json({ success: true, message: "If an account exists with this email, a reset link has been generated." });
      return;
    }

    const resetToken = randomBytes(48).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

    await dbInstance.update(users)
      .set({ resetToken, resetTokenExpiry })
      .where(eq(users.id, user.id));

    console.log(`[Auth] Password reset token generated for ${email}`);

    res.json({
      success: true,
      message: "If an account exists with this email, a reset link has been generated.",
      resetToken,
    });
  });

  // ─── Reset Password (with token) ──────────────────────────────────
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    const { token, password } = req.body;

    if (!token || !password) {
      res.status(400).json({ error: "Token and new password are required" });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    const dbInstance = await db.getDb();
    if (!dbInstance) {
      res.status(500).json({ error: "Database not available" });
      return;
    }

    const result = await dbInstance.select().from(users)
      .where(
        and(
          eq(users.resetToken, token),
          gt(users.resetTokenExpiry, new Date())
        )
      )
      .limit(1);

    const user = result[0];

    if (!user) {
      res.status(400).json({ error: "Invalid or expired reset token. Please request a new one." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await dbInstance.update(users)
      .set({ passwordHash, resetToken: null, resetTokenExpiry: null })
      .where(eq(users.id, user.id));

    console.log(`[Auth] Password reset successful for user ${user.email}`);
    res.json({ success: true, message: "Password has been reset successfully. You can now sign in." });
  });

  // ─── Legacy OAuth callback (kept for backward compatibility) ───────
  app.get("/api/oauth/callback", async (_req: Request, res: Response) => {
    res.redirect(302, "/login");
  });
}
