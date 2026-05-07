import { Hocuspocus } from "@hocuspocus/server";
import type { IncomingMessage, Server as HttpServer } from "node:http";
import { WebSocketServer } from "ws";
import * as Y from "yjs";
import { FileNode } from "../models/FileNode.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function decodeFileId(name: string): string {
  // Document names follow the pattern: "project:<pid>:file:<fid>"
  const match = name.match(/file:([^:]+)$/);
  if (match?.[1]) return match[1];
  // Fallback: last colon-separated segment
  return name.split(":").at(-1) ?? name;
}

/**
 * Detect and repair obviously-corrupted repeated content.
 *
 * The corruption pattern is: the same code block appended to itself N times.
 * We detect this by finding the smallest line-group that, when repeated,
 * reconstructs most of the content.
 *
 * This is a one-time safety net for documents corrupted before the persistence
 * rewrite. It runs only in onLoadDocument (cold start), never during editing.
 */
function repairRepeatedContent(content: string): string {
  const lines = content.split("\n");

  // Only bother for files that are suspiciously large
  if (lines.length < 15) return content;

  // Try window sizes from 3 to 60 lines
  for (let win = 3; win <= Math.min(60, Math.floor(lines.length / 2)); win++) {
    const unit = lines.slice(0, win).join("\n");
    if (unit.trim().length === 0) continue;

    const repetitions = Math.round(lines.length / win);
    if (repetitions < 2) continue;

    // Build what the content would look like if it's exactly `repetitions` copies
    const candidate = Array(repetitions).fill(unit).join("\n");

    // Allow a small trailing-whitespace margin (last repetition may be incomplete)
    if (content.startsWith(candidate.slice(0, candidate.length - win * 5))) {
      // eslint-disable-next-line no-console
      console.warn(
        `[collab] onLoadDocument: detected content repeated ×${repetitions} — auto-repaired to 1 copy.`,
      );
      return unit;
    }
  }

  return content;
}

// ---------------------------------------------------------------------------
// Collaboration server
// ---------------------------------------------------------------------------

function createCollabInstance() {
  return new Hocuspocus({
    /**
     * Called once, when the FIRST client connects to a document room that has
     * no in-memory Yjs state (i.e. no other client is currently connected).
     *
     * Authority: MongoDB is the ONLY source of truth for persisted content.
     * Redis is intentionally NOT used here because a stale or corrupted Redis
     * CRDT state was the root cause of content being multiplied on every reload.
     *
     * Mongo is written ONLY by the explicit PUT /files/:id REST call (Save button / Ctrl+S).
     */
    async onLoadDocument({ documentName, document }) {
      const yText = document.getText("monaco");

      // Guard: if yText already has content, another client must have seeded it
      // during this same server session — do not insert again.
      if (yText.length > 0) return document;

      const fileId = decodeFileId(documentName);
      const file = await FileNode.findById(fileId).lean();
      let content = file?.content ?? "";

      // Auto-repair documents that were corrupted by the old code
      // (content appended to itself on every page load).
      content = repairRepeatedContent(content);

      if (content.length > 0) {
        yText.insert(0, content);
      }

      return document;
    },

    // onChange  — intentionally omitted.
    //   We do NOT write to Redis or Mongo on every keystroke.
    //   Hocuspocus keeps the Yjs document in memory while any client is connected.
    //   Changes are only persisted when the user explicitly hits Save (PUT /files/:id).

    // onStoreDocument — intentionally omitted.
    //   We do NOT let Hocuspocus auto-save to Mongo on its own schedule.
    //   Autonomous persistence was the primary cause of the duplication bug.

    // onDisconnect — intentionally omitted.
    //   When the last client disconnects, unsaved changes are intentionally lost
    //   (matching the "save explicitly" contract the UI communicates to the user).
  });
}

export function attachCollabServer(server: HttpServer) {
  const collab = createCollabInstance();
  const wsServer = new WebSocketServer({ noServer: true });

  wsServer.on("connection", (incoming, request) => {
    incoming.setMaxListeners(Number.POSITIVE_INFINITY);
    incoming.on("error", (error) => {
      // eslint-disable-next-line no-console
      console.error("Error emitted from collab websocket instance:", error);
    });
    collab.handleConnection(incoming, request as IncomingMessage);
  });

  server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    if (pathname !== "/collab") return;

    wsServer.handleUpgrade(request, socket, head, (ws) => {
      wsServer.emit("connection", ws, request);
    });
  });

  return collab;
}
