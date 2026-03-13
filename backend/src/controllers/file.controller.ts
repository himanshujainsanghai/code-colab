import type { Request, Response } from "express";
import { z } from "zod";
import { FileNode } from "../models/FileNode.js";
import { emitProjectFileTreeUpdated } from "../realtime/socket.js";

const createFileSchema = z.object({
  parentId: z.string().nullable().optional(),
  name: z.string().min(1),
  type: z.enum(["file", "folder"]),
  content: z.string().optional(),
  language: z.string().optional(),
});

const updateFileSchema = z.object({
  name: z.string().optional(),
  content: z.string().optional(),
  language: z.string().optional(),
  parentId: z.string().nullable().optional(),
});

export async function listProjectFiles(request: Request, response: Response) {
  const files = await FileNode.find({ projectId: request.params.id }).sort({ type: 1, name: 1 });
  return response.json({ data: files });
}

export async function createFileNode(request: Request, response: Response) {
  const input = createFileSchema.parse(request.body);
  const projectId = String(request.params.id);
  const fileNode = await FileNode.create({
    projectId,
    ...input,
    content: input.content ?? "",
    language: input.language ?? "plaintext",
  });
  emitProjectFileTreeUpdated(projectId);
  return response.status(201).json({ data: fileNode });
}

export async function getFileNode(request: Request, response: Response) {
  const file = await FileNode.findById(request.params.id);
  if (!file) return response.status(404).json({ message: "File not found" });
  return response.json({ data: file });
}

export async function updateFileNode(request: Request, response: Response) {
  const input = updateFileSchema.parse(request.body);
  const file = await FileNode.findByIdAndUpdate(request.params.id, input, { new: true });
  if (!file) return response.status(404).json({ message: "File not found" });
  if (typeof input.name !== "undefined" || typeof input.parentId !== "undefined") {
    emitProjectFileTreeUpdated(file.projectId.toString());
  }
  return response.json({ data: file });
}

export async function deleteFileNode(request: Request, response: Response) {
  const file = await FileNode.findByIdAndDelete(request.params.id);
  if (file) {
    emitProjectFileTreeUpdated(file.projectId.toString());
  }
  return response.status(204).send();
}
