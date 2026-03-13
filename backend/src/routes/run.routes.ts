import { Router } from "express";
import { runHandler } from "../controllers/run.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const runRouter = Router();

runRouter.use(requireAuth);
runRouter.post("/", runHandler);
