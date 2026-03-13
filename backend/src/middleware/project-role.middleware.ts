import type { NextFunction, Request, Response } from "express";
import { Collaborator } from "../models/Collaborator.js";
import { FileNode } from "../models/FileNode.js";
import { Project } from "../models/Project.js";

const hierarchy: Array<"viewer" | "editor" | "admin"> = ["viewer", "editor", "admin"];

function getProjectId(request: Request) {
  return request.params.id || request.params.projectId || request.body.projectId;
}

export function requireProjectRole(minRole: "viewer" | "editor" | "admin") {
  return async (request: Request, response: Response, next: NextFunction) => {
    const projectId = getProjectId(request);
    const userId = request.user?.userId;

    if (!projectId || !userId) {
      return response.status(400).json({ message: "Project context missing" });
    }

    const project = await Project.findById(projectId).select("_id ownerId").lean();
    if (!project) {
      return response.status(404).json({ message: "Project not found" });
    }

    if (project.ownerId.toString() === userId) {
      return next();
    }

    const collaborator = await Collaborator.findOne({ projectId, userId }).lean();
    if (!collaborator) {
      return response.status(403).json({ message: "Insufficient permissions" });
    }

    if (hierarchy.indexOf(collaborator.role) < hierarchy.indexOf(minRole)) {
      return response.status(403).json({ message: "Insufficient permissions" });
    }

    return next();
  };
}

export async function requireProjectOwner(request: Request, response: Response, next: NextFunction) {
  const projectId = getProjectId(request);
  const userId = request.user?.userId;

  if (!projectId || !userId) {
    return response.status(400).json({ message: "Project context missing" });
  }

  const project = await Project.findById(projectId).select("_id ownerId").lean();
  if (!project) {
    return response.status(404).json({ message: "Project not found" });
  }

  if (project.ownerId.toString() !== userId) {
    return response.status(403).json({ message: "Owner permission required" });
  }

  return next();
}

export function requireFileRole(minRole: "viewer" | "editor" | "admin") {
  return async (request: Request, response: Response, next: NextFunction) => {
    const fileId = request.params.id;
    const userId = request.user?.userId;
    if (!fileId || !userId) {
      return response.status(400).json({ message: "File context missing" });
    }

    const file = await FileNode.findById(fileId).select("_id projectId").lean();
    if (!file) {
      return response.status(404).json({ message: "File not found" });
    }

    const project = await Project.findById(file.projectId).select("_id ownerId").lean();
    if (!project) {
      return response.status(404).json({ message: "Project not found" });
    }

    if (project.ownerId.toString() === userId) {
      return next();
    }

    const collaborator = await Collaborator.findOne({
      projectId: project._id,
      userId,
    }).lean();

    if (!collaborator) {
      return response.status(403).json({ message: "Insufficient permissions" });
    }

    if (hierarchy.indexOf(collaborator.role) < hierarchy.indexOf(minRole)) {
      return response.status(403).json({ message: "Insufficient permissions" });
    }

    return next();
  };
}
