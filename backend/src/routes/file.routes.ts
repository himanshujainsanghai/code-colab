import { Router } from "express";
import {
  createFileNode,
  deleteFileNode,
  getFileNode,
  listProjectFiles,
  updateFileNode,
} from "../controllers/file.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireFileRole, requireProjectRole } from "../middleware/project-role.middleware.js";

export const fileRouter = Router();

fileRouter.use(requireAuth);
fileRouter.get("/projects/:id/files", requireProjectRole("viewer"), listProjectFiles);
fileRouter.post("/projects/:id/files", requireProjectRole("editor"), createFileNode);
fileRouter.get("/files/:id", requireFileRole("viewer"), getFileNode);
fileRouter.put("/files/:id", requireFileRole("editor"), updateFileNode);
fileRouter.delete("/files/:id", requireFileRole("editor"), deleteFileNode);
