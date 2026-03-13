import { Router } from "express";
import { searchUsers } from "../controllers/user.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const userRouter = Router();

userRouter.use(requireAuth);
userRouter.get("/search", searchUsers);
