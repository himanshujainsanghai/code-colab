import { Router } from "express";
import {
  addCollaborator,
  createProject,
  deleteProject,
  getProject,
  listProjects,
  removeCollaborator,
  updateProject,
} from "../controllers/project.controller.js";
import {
  createInvitation,
  listPendingInvitations,
  listProjectMembers,
} from "../controllers/invitation.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireProjectOwner, requireProjectRole } from "../middleware/project-role.middleware.js";

export const projectRouter = Router();

projectRouter.use(requireAuth);
projectRouter.get("/", listProjects);
projectRouter.post("/", createProject);
projectRouter.get("/:id", requireProjectRole("viewer"), getProject);
projectRouter.put("/:id", requireProjectOwner, updateProject);
projectRouter.delete("/:id", requireProjectOwner, deleteProject);
projectRouter.get("/:id/members", requireProjectRole("viewer"), listProjectMembers);
projectRouter.get("/:id/invitations", requireProjectRole("admin"), listPendingInvitations);
projectRouter.post("/:id/invitations", requireProjectRole("admin"), createInvitation);
projectRouter.post("/:id/collaborators", requireProjectRole("admin"), addCollaborator);
projectRouter.delete("/:id/collaborators/:userId", requireProjectRole("admin"), removeCollaborator);
