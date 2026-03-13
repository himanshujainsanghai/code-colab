import type { Request, Response } from "express";
import { z } from "zod";
import { Collaborator } from "../models/Collaborator.js";
import { Project } from "../models/Project.js";

const createProjectSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
});

export async function listProjects(request: Request, response: Response) {
  const userId = request.user?.userId;
  const owned = await Project.find({ ownerId: userId }).sort({ updatedAt: -1 }).lean();
  const collaborations = await Collaborator.find({ userId }).lean();

  const collaborationProjectIds = collaborations
    .map((item) => item.projectId?.toString())
    .filter((id): id is string => Boolean(id));

  const collaboratedProjects = collaborationProjectIds.length
    ? await Project.find({ _id: { $in: collaborationProjectIds } }).lean()
    : [];

  const mergedById = new Map<string, (typeof owned)[number]>();
  owned.forEach((project) => mergedById.set(project._id.toString(), project));
  collaboratedProjects.forEach((project) => mergedById.set(project._id.toString(), project));

  const roleByProjectId = new Map(
    collaborations.map((item) => [item.projectId.toString(), item.role]),
  );

  const projects = Array.from(mergedById.values())
    .map((project) => ({
      ...project,
      role: roleByProjectId.get(project._id.toString()) ?? (project.ownerId.toString() === userId ? "admin" : "viewer"),
    }))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return response.json({ data: { projects } });
}

export async function createProject(request: Request, response: Response) {
  const input = createProjectSchema.parse(request.body);
  const project = await Project.create({
    name: input.name,
    description: input.description ?? "",
    isPublic: input.isPublic ?? false,
    ownerId: request.user!.userId,
  });
  await Collaborator.create({
    projectId: project._id,
    userId: request.user!.userId,
    role: "admin",
  });
  return response.status(201).json({ data: project });
}

export async function getProject(request: Request, response: Response) {
  const project = await Project.findById(request.params.id);
  if (!project) return response.status(404).json({ message: "Project not found" });
  return response.json({ data: project });
}

export async function updateProject(request: Request, response: Response) {
  const input = createProjectSchema.partial().parse(request.body);
  const project = await Project.findByIdAndUpdate(request.params.id, input, { new: true });
  if (!project) return response.status(404).json({ message: "Project not found" });
  return response.json({ data: project });
}

export async function deleteProject(request: Request, response: Response) {
  await Project.findByIdAndDelete(request.params.id);
  await Collaborator.deleteMany({ projectId: request.params.id });
  return response.status(204).send();
}

export async function addCollaborator(request: Request, response: Response) {
  const body = z
    .object({
      userId: z.string(),
      role: z.enum(["viewer", "editor", "admin"]).default("viewer"),
    })
    .parse(request.body);

  const collaborator = await Collaborator.findOneAndUpdate(
    { projectId: request.params.id, userId: body.userId },
    { role: body.role },
    { upsert: true, new: true },
  );

  return response.status(201).json({ data: collaborator });
}

export async function removeCollaborator(request: Request, response: Response) {
  await Collaborator.findOneAndDelete({
    projectId: request.params.id,
    userId: request.params.userId,
  });
  return response.status(204).send();
}
