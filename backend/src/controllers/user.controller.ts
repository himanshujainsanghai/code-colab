import type { Request, Response } from "express";
import { z } from "zod";
import { User } from "../models/User.js";

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function searchUsers(request: Request, response: Response) {
  const q = z.string().min(1).max(100).parse(request.query.q ?? "");
  const normalized = q.trim();
  if (!normalized) {
    return response.json({ data: [] });
  }

  const emailLike = normalized.includes("@");
  const exactEmail = normalized.toLowerCase();

  let users;
  if (emailLike) {
    users = await User.find({ email: exactEmail })
      .limit(5)
      .select("_id username avatar email")
      .lean();
  } else {
    const regex = new RegExp(`^${escapeRegex(normalized)}`, "i");
    users = await User.find({ username: regex })
      .limit(5)
      .select("_id username avatar")
      .lean();
  }

  return response.json({
    data: users.map((user) => ({
      id: user._id,
      username: user.username,
      avatar: user.avatar,
      email: "email" in user ? user.email : undefined,
    })),
  });
}
