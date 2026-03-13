import http from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { app } from "./app.js";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { startCollabServer } from "./collab/hocuspocus.js";
import { setSocketServer } from "./realtime/socket.js";

async function bootstrap() {
  await connectDb();
  await startCollabServer();

  const allowedOrigins = Array.from(
    new Set([env.CLIENT_ORIGIN, ...env.CORS_ALLOWED_ORIGINS]),
  );

  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    socket.on("join-project", (projectId: string) => {
      socket.join(projectId);
    });

    socket.on("file-tree-updated", (projectId: string) => {
      io.to(projectId).emit("file-tree-updated", projectId);
    });
  });
  setSocketServer(io);

  server.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`API server running on http://localhost:${env.PORT}`);
    // eslint-disable-next-line no-console
    console.log(`Collab server running on ws://localhost:${env.COLLAB_PORT}`);
  });
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to bootstrap backend:", error);
  process.exit(1);
});
