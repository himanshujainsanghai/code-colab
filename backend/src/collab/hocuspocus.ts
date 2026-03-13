import { Server } from "@hocuspocus/server";
import { Redis } from "ioredis";
import * as Y from "yjs";
import { env } from "../config/env.js";
import { FileNode } from "../models/FileNode.js";

function decodeFileId(name: string) {
  const match = name.match(/file:([^:]+)$/);
  if (match?.[1]) {
    return match[1];
  }
  const parts = name.split(":");
  return parts.at(-1) ?? name;
}

export async function startCollabServer() {
  const redis = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    retryStrategy: () => null,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  let redisReady = false;
  const persistTimers = new Map<string, NodeJS.Timeout>();

  const getCacheKey = (documentName: string) => `collab:document:${documentName}`;

  const persistToMongo = async (documentName: string, document: Y.Doc) => {
    const fileId = decodeFileId(documentName);
    const content = document.getText("monaco").toString();
    await FileNode.findByIdAndUpdate(fileId, { content, updatedAt: new Date() });
  };

  const scheduleMongoPersistence = (documentName: string, document: Y.Doc) => {
    const previousTimer = persistTimers.get(documentName);
    if (previousTimer) {
      clearTimeout(previousTimer);
    }
    const timer = setTimeout(() => {
      persistTimers.delete(documentName);
      persistToMongo(documentName, document).catch((error) => {
        // eslint-disable-next-line no-console
        console.error("Failed to persist collaborative document:", error);
      });
    }, 30_000);
    persistTimers.set(documentName, timer);
  };

  try {
    await redis.connect();
    redisReady = true;
  } catch {
    // eslint-disable-next-line no-console
    console.warn("Redis unavailable for collab cache. Falling back to Mongo-only persistence.");
  }

  const server = new Server({
    port: env.COLLAB_PORT,
    debounce: 2_000,
    maxDebounce: 30_000,
    async onLoadDocument({ documentName, document }) {
      const fileId = decodeFileId(documentName);

      if (redisReady) {
        const cachedState = await redis.get(getCacheKey(documentName));
        if (cachedState) {
          Y.applyUpdate(document, Buffer.from(cachedState, "base64"));
          return document;
        }
      }

      const file = await FileNode.findById(fileId).lean();
      if (file?.content) {
        const yText = document.getText("monaco");
        if (yText.length === 0) {
          yText.insert(0, file.content);
        }
      }
      return document;
    },
    async onChange({ documentName, document }) {
      if (redisReady) {
        const state = Y.encodeStateAsUpdate(document);
        await redis.set(getCacheKey(documentName), Buffer.from(state).toString("base64"));
      }
      scheduleMongoPersistence(documentName, document);
    },
    async onStoreDocument({ document, documentName }) {
      await persistToMongo(documentName, document);
      if (redisReady) {
        const state = Y.encodeStateAsUpdate(document);
        await redis.set(getCacheKey(documentName), Buffer.from(state).toString("base64"));
      }
    },
    async onDisconnect({ clientsCount, documentName, document }) {
      if (clientsCount === 0) {
        const pendingTimer = persistTimers.get(documentName);
        if (pendingTimer) {
          clearTimeout(pendingTimer);
          persistTimers.delete(documentName);
        }
        await persistToMongo(documentName, document);
      }
    },
  });

  await server.listen();
  return server;
}
