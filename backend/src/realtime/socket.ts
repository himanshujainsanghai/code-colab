import type { Server as SocketIOServer } from "socket.io";

let io: SocketIOServer | null = null;

export function setSocketServer(server: SocketIOServer) {
  io = server;
}

export function emitProjectFileTreeUpdated(projectId: string) {
  io?.to(projectId).emit("file-tree-updated", projectId);
}
