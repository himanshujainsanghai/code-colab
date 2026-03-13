import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { env } from "../config/env.js";
import { Session } from "../models/Session.js";
import { User } from "../models/User.js";
import { sendResetPasswordMail } from "../services/mail.service.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../services/token.service.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  username: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const resetSchema = z.object({
  token: z.string().min(8),
  password: z.string().min(6),
});

const refreshTtlMs = 7 * 24 * 60 * 60 * 1000;
const resetTokenTtlMs = 15 * 60 * 1000;
const accessTtlMs = 15 * 60 * 1000;

function authCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: env.COOKIE_SAME_SITE,
    secure: env.COOKIE_SECURE,
    maxAge,
  } as const;
}

function setAuthCookies(response: Response, accessToken: string, refreshToken: string) {
  response.cookie("accessToken", accessToken, authCookieOptions(accessTtlMs));
  response.cookie("refreshToken", refreshToken, authCookieOptions(refreshTtlMs));
}

function clearAuthCookies(response: Response) {
  response.clearCookie("accessToken", {
    httpOnly: true,
    sameSite: env.COOKIE_SAME_SITE,
    secure: env.COOKIE_SECURE,
  });
  response.clearCookie("refreshToken", {
    httpOnly: true,
    sameSite: env.COOKIE_SAME_SITE,
    secure: env.COOKIE_SECURE,
  });
}

async function createSessionTokens(userId: string) {
  const accessToken = signAccessToken(userId);
  const refreshToken = signRefreshToken(userId);
  await Session.create({
    userId,
    token: refreshToken,
    expiresAt: new Date(Date.now() + refreshTtlMs),
  });
  return { accessToken, refreshToken };
}

export async function register(request: Request, response: Response) {
  const input = registerSchema.parse(request.body);
  const existing = await User.findOne({ email: input.email });
  if (existing) {
    return response.status(409).json({ message: "Email already exists" });
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await User.create({
    email: input.email,
    username: input.username,
    passwordHash,
    techStack: [],
  });

  const { accessToken, refreshToken } = await createSessionTokens(user._id.toString());
  setAuthCookies(response, accessToken, refreshToken);

  return response.status(201).json({
    data: { id: user._id, email: user.email, username: user.username },
  });
}

export async function login(request: Request, response: Response) {
  const input = loginSchema.parse(request.body);
  const user = await User.findOne({ email: input.email });
  if (!user) {
    return response.status(401).json({ message: "Invalid credentials" });
  }
  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    return response.status(401).json({ message: "Invalid credentials" });
  }

  const { accessToken, refreshToken } = await createSessionTokens(user._id.toString());
  setAuthCookies(response, accessToken, refreshToken);

  return response.json({
    data: { id: user._id, email: user.email, username: user.username },
  });
}

export async function refresh(request: Request, response: Response) {
  const cookieToken = request.cookies?.refreshToken as string | undefined;
  if (!cookieToken) {
    return response.status(401).json({ message: "Missing refresh token" });
  }

  try {
    const session = await Session.findOne({ token: cookieToken });
    if (!session) {
      return response.status(401).json({ message: "Session expired" });
    }

    const payload = verifyRefreshToken(cookieToken) as { userId: string };
    await Session.findByIdAndDelete(session._id);
    const { accessToken, refreshToken } = await createSessionTokens(payload.userId);
    setAuthCookies(response, accessToken, refreshToken);
    return response.json({ data: { accessToken } });
  } catch {
    clearAuthCookies(response);
    return response.status(401).json({ message: "Invalid refresh token" });
  }
}

export async function me(request: Request, response: Response) {
  const userId = request.user?.userId;
  const user = await User.findById(userId).select("_id email username avatar techStack");
  if (!user) {
    return response.status(404).json({ message: "User not found" });
  }
  return response.json({
    data: {
      id: user._id,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      techStack: user.techStack,
    },
  });
}

export async function updateMe(request: Request, response: Response) {
  const input = z
    .object({
      username: z.string().min(2).optional(),
      avatar: z.string().optional(),
      techStack: z.array(z.string().min(1)).max(20).optional(),
    })
    .parse(request.body);

  const userId = request.user?.userId;
  const user = await User.findByIdAndUpdate(userId, input, { new: true }).select(
    "_id email username avatar techStack",
  );
  if (!user) {
    return response.status(404).json({ message: "User not found" });
  }
  return response.json({
    data: {
      id: user._id,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      techStack: user.techStack,
    },
  });
}

export async function logout(request: Request, response: Response) {
  const cookieToken = request.cookies?.refreshToken as string | undefined;
  if (cookieToken) {
    await Session.findOneAndDelete({ token: cookieToken });
  }
  clearAuthCookies(response);
  return response.json({ message: "Logged out successfully" });
}

export async function forgotPassword(request: Request, response: Response) {
  const email = z.object({ email: z.string().email() }).parse(request.body).email;
  const user = await User.findOne({ email });
  if (user) {
    const token = crypto.randomBytes(24).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    user.resetPasswordTokenHash = tokenHash;
    user.resetPasswordExpiresAt = new Date(Date.now() + resetTokenTtlMs);
    await user.save();
    const resetLink = `${env.CLIENT_ORIGIN}/reset-password?token=${token}`;
    await sendResetPasswordMail(user.email, resetLink);
  }
  return response.json({ message: "If an account exists, a reset link has been sent." });
}

export async function resetPassword(request: Request, response: Response) {
  const { token, password } = resetSchema.parse(request.body);
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    resetPasswordTokenHash: tokenHash,
    resetPasswordExpiresAt: { $gt: new Date() },
  });
  if (!user) {
    return response.status(400).json({ message: "Invalid or expired reset token" });
  }
  user.passwordHash = await bcrypt.hash(password, 10);
  user.resetPasswordTokenHash = undefined;
  user.resetPasswordExpiresAt = undefined;
  await user.save();
  return response.json({ message: "Password reset successfully" });
}
