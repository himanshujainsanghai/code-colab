import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function notFoundHandler(_request: Request, response: Response) {
  return response.status(404).json({ message: "Route not found" });
}

export function errorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    return response.status(400).json({
      message: "Validation failed",
      issues: error.issues,
    });
  }
  const message = error instanceof Error ? error.message : "Unexpected server error";
  return response.status(500).json({ message });
}
