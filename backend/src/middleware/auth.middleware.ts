import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../services/token.service.js";

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  try {
    const header = request.headers.authorization;
    const bearerToken = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    const cookieToken = request.cookies?.accessToken as string | undefined;
    const token = bearerToken ?? cookieToken;
    if (!token) {
      return response.status(401).json({ message: "Unauthorized" });
    }
    request.user = verifyAccessToken(token) as Request["user"];
    return next();
  } catch {
    return response.status(401).json({ message: "Invalid token" });
  }
}
