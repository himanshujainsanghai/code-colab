import { Router } from "express";
import {
  acceptInvitation,
  validateInvitation,
} from "../controllers/invitation.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const invitationRouter = Router();

invitationRouter.get("/validate", validateInvitation);
invitationRouter.post("/accept", requireAuth, acceptInvitation);
