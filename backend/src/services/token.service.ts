import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function signAccessToken(userId: string) {
  const expiresIn = env.ACCESS_TOKEN_TTL as jwt.SignOptions["expiresIn"];
  return jwt.sign({ userId }, env.JWT_ACCESS_SECRET, {
    expiresIn,
  });
}

export function signRefreshToken(userId: string) {
  const expiresIn = env.REFRESH_TOKEN_TTL as jwt.SignOptions["expiresIn"];
  return jwt.sign({ userId }, env.JWT_REFRESH_SECRET, {
    expiresIn,
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}
