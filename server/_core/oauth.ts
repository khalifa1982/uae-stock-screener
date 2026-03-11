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
 */
export function registerOAuthRoutes(app: Express) {
  // ─── Register (signup) ─────────────────────────────────────────────
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: "Email and password are required" });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({ error: "Password must be at least 6 characters" });
        return;
      }

      // Check if user already exists by email
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

      // Hash password and create user
      const passwordHash = await bcrypt.hash(password, 12);
      const openId = randomUUID(); // Generate a unique ID for the user

      await db.upsertUser({
        openId,
        name: name || email.split("@")[0],
        email,
        passwordHash,
        loginMethod: "email",
        lastSignedIn: new Date(),
      });

      // Create session
      const sessionToken = await sdk.createSessionToken(openId, {
        name: name || email.split("@")[0],
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({ success: true, message: "Account created successfully" });
    } catch (error) {
      console.error("[Auth] Registration failed:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // ─── Login ─────────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
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

      // Update last signed in
      await db.upsertUser({
        openId: user.openId,
        lastSignedIn: new Date(),
      });

      // Create session
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({ success: true, message: "Login successful" });
    } catch (error) {
      console.error("[Auth] Login failed:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // ─── Forgot Password (request reset) ──────────────────────────────
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
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

      // Generate a secure reset token (48 bytes = 64 hex chars)
      const resetToken = randomBytes(48).toString("hex");
      // Token expires in 1 hour
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

      // Store token in database
      await dbInstance.update(users)
        .set({ resetToken, resetTokenExpiry })
        .where(eq(users.id, user.id));

      console.log(`[Auth] Password reset token generated for ${email}`);

      // Return the token - in production you'd email this as a link
      // For now we return it so the frontend can show the reset link
      res.json({
        success: true,
        message: "If an account exists with this email, a reset link has been generated.",
        // Include token in response for self-hosted deployment (no email service)
        resetToken,
      });
    } catch (error) {
      console.error("[Auth] Forgot password failed:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  });

  // ─── Reset Password (with token) ──────────────────────────────────
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
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

      // Find user with valid, non-expired token
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

      // Hash new password and clear reset token
      const passwordHash = await bcrypt.hash(password, 12);
      await dbInstance.update(users)
        .set({ passwordHash, resetToken: null, resetTokenExpiry: null })
        .where(eq(users.id, user.id));

      console.log(`[Auth] Password reset successful for user ${user.email}`);

      res.json({ success: true, message: "Password has been reset successfully. You can now sign in." });
    } catch (error) {
      console.error("[Auth] Reset password failed:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // ─── Legacy OAuth callback (kept for backward compatibility) ───────
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    // Redirect to login page since we no longer use Manus OAuth
    res.redirect(302, "/login");
  });
}
