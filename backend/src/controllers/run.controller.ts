import type { Request, Response } from "express";
import { z } from "zod";
import { runCode } from "../services/judge0.service.js";

const runSchema = z.object({
  sourceCode: z.string().min(1),
  languageId: z.number().int().positive(),
  stdin: z.string().optional(),
});

export async function runHandler(request: Request, response: Response) {
  const input = runSchema.parse(request.body);
  const result = await runCode(input);
  return response.json({ data: result });
}
