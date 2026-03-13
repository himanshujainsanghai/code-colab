import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";
import { authRouter } from "./routes/auth.routes.js";
import { fileRouter } from "./routes/file.routes.js";
import { invitationRouter } from "./routes/invitation.routes.js";
import { projectRouter } from "./routes/project.routes.js";
import { runRouter } from "./routes/run.routes.js";
import { userRouter } from "./routes/user.routes.js";

export const app = express();

const allowedOrigins = Array.from(
  new Set([env.CLIENT_ORIGIN, ...env.CORS_ALLOWED_ORIGINS]),
);

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/$/, "");
      if (allowedOrigins.includes(normalized)) {
        return callback(null, true);
      }
      return callback(new Error("Origin not allowed by CORS"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(morgan("dev"));

app.get("/health", (_request, response) => response.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/projects", projectRouter);
app.use("/api/invitations", invitationRouter);
app.use("/api", fileRouter);
app.use("/api/run", runRouter);

app.use(notFoundHandler);
app.use(errorHandler);
