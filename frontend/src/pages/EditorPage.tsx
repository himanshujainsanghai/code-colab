import type { OnMount } from "@monaco-editor/react";
import { HocuspocusProvider } from "@hocuspocus/provider";
import type { editor as MonacoEditor } from "monaco-editor";
import { MonacoBinding } from "y-monaco";
import { io, type Socket } from "socket.io-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import * as Y from "yjs";
import { EditorShell } from "../components/editor/EditorShell";
import { useAuth } from "../lib/auth";
import api from "../lib/api";
import { languageMap } from "../lib/mock";
import type { FileNode, RunResult } from "../lib/types";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function flattenFiles(nodes: FileNode[]): FileNode[] {
  return nodes.flatMap((node) =>
    node.type === "file" ? [node] : flattenFiles(node.children ?? []),
  );
}

interface FileApiNode {
  _id: string;
  projectId: string;
  parentId?: string | null;
  name: string;
  type: "file" | "folder";
  content?: string;
  language?: string;
}

interface ProjectMember {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  role: "owner" | "viewer" | "editor" | "admin";
}

function buildTree(flatNodes: FileApiNode[]): FileNode[] {
  const map = new Map<string, FileNode>();
  flatNodes.forEach((node) => {
    map.set(node._id, {
      id: node._id,
      parentId: node.parentId ?? null,
      name: node.name,
      type: node.type,
      content: node.content ?? "",
      language: node.language ?? "plaintext",
      children: [],
    });
  });

  const roots: FileNode[] = [];
  map.forEach((node) => {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children!.push(node);
      return;
    }
    roots.push(node);
  });

  const sortNodes = (nodes: FileNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((node) => {
      if (node.children) sortNodes(node.children);
    });
  };
  sortNodes(roots);
  return roots;
}

function findFirstFolderId(nodes: FileNode[]): string | null {
  for (const node of nodes) {
    if (node.type === "folder") return node.id;
    if (node.children?.length) {
      const nested = findFirstFolderId(node.children);
      if (nested) return nested;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EditorPage() {
  const { projectId = "colab-code" } = useParams();
  const { user } = useAuth();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [project, setProject] = useState<{ _id: string; name: string } | null>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [openFileIds, setOpenFileIds] = useState<string[]>([]);
  const [activeFileId, setActiveFileId] = useState("");
  const [running, setRunning] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [editorReady, setEditorReady] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);

  // ── Dirty tracking — Set of file IDs with unsaved changes ─────────────────
  // This is the single source of truth for "has this file been modified since
  // the last save?" It lives here because the Yjs doc lives here.
  // It's a Set inside a ref to avoid re-renders on every keystroke, but we
  // also maintain a parallel React state copy so the UI rerenders when dirty
  // status changes (we batch updates using a small debounce).
  const dirtySetRef = useRef<Set<string>>(new Set());
  const [dirtyFileIds, setDirtyFileIds] = useState<Set<string>>(new Set());

  // Flush the dirtySetRef → React state. Batches rapid keystrokes into a
  // single state update so we don't rerender on every character.
  const dirtyFlushTimerRef = useRef<number | null>(null);
  const flushDirty = useCallback(() => {
    if (dirtyFlushTimerRef.current !== null) return;
    dirtyFlushTimerRef.current = window.setTimeout(() => {
      dirtyFlushTimerRef.current = null;
      setDirtyFileIds(new Set(dirtySetRef.current));
    }, 150);
  }, []);

  const markDirty = useCallback((fileId: string) => {
    if (!dirtySetRef.current.has(fileId)) {
      dirtySetRef.current.add(fileId);
      flushDirty();
    }
  }, [flushDirty]);

  const markClean = useCallback((fileId: string) => {
    if (dirtySetRef.current.has(fileId)) {
      dirtySetRef.current.delete(fileId);
      setDirtyFileIds(new Set(dirtySetRef.current));
    }
  }, []);

  // ── Refs (stable — never cause re-renders) ────────────────────────────────
  const activeFileIdRef = useRef("");
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const collabRef = useRef<{
    provider: HocuspocusProvider;
    doc: Y.Doc;
    binding: MonacoBinding;
    fileId: string;
  } | null>(null);

  // ── Derived state ─────────────────────────────────────────────────────────
  const files = useMemo(() => flattenFiles(fileTree), [fileTree]);
  const activeFile = useMemo(
    () => files.find((f) => f.id === activeFileId),
    [files, activeFileId],
  );
  const language = activeFile?.language ?? "javascript";

  useEffect(() => {
    activeFileIdRef.current = activeFileId;
  }, [activeFileId]);

  // ── Browser close guard: warn if any dirty files ──────────────────────────
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtySetRef.current.size > 0) {
        e.preventDefault();
        // Modern browsers show their own message; the string is ignored.
        return "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // ---------------------------------------------------------------------------
  // Data loaders (stable callbacks)
  // ---------------------------------------------------------------------------

  const loadFileTree = useCallback(async () => {
    if (!projectId) return;
    setLoadingFiles(true);
    try {
      const response = await api.get(`/projects/${projectId}/files`);
      const items = response.data.data as FileApiNode[];

      if (items.length === 0) {
        await api.post(`/projects/${projectId}/files`, {
          name: "src",
          type: "folder",
          parentId: null,
        });
        const srcResponse = await api.get(`/projects/${projectId}/files`);
        const srcItems = srcResponse.data.data as FileApiNode[];
        const srcFolder = srcItems.find(
          (item) => item.name === "src" && item.type === "folder",
        );
        if (srcFolder) {
          await api.post(`/projects/${projectId}/files`, {
            name: "main.js",
            type: "file",
            parentId: srcFolder._id,
            language: "javascript",
            content: 'console.log("Hello from Colab Code");\n',
          });
        }
        const finalResponse = await api.get(`/projects/${projectId}/files`);
        const finalItems = finalResponse.data.data as FileApiNode[];
        setFileTree(buildTree(finalItems));
        const firstFile = finalItems.find((item) => item.type === "file");
        if (firstFile) {
          setActiveFileId(firstFile._id);
          setOpenFileIds([firstFile._id]);
        }
        return;
      }

      setFileTree(buildTree(items));
      const firstFile = items.find((item) => item.type === "file");
      const currentId = activeFileIdRef.current;
      const preferredActiveId =
        items.some((item) => item._id === currentId) && currentId
          ? currentId
          : (firstFile?._id ?? "");

      setActiveFileId(preferredActiveId);
      if (preferredActiveId) {
        setOpenFileIds((prev) => {
          const merged = new Set(prev);
          if (merged.size === 0) merged.add(preferredActiveId);
          return Array.from(merged).filter((id) =>
            items.some((item) => item._id === id),
          );
        });
      }
    } finally {
      setLoadingFiles(false);
    }
  }, [projectId]);

  const loadProject = useCallback(async () => {
    if (!projectId) return;
    try {
      const response = await api.get(`/projects/${projectId}`);
      setProject(response.data.data);
    } catch {
      // Ignored
    }
  }, [projectId]);

  const loadMembers = useCallback(async () => {
    if (!projectId) return;
    try {
      const response = await api.get(`/projects/${projectId}/members`);
      const payload = response.data.data as {
        owner: ProjectMember | null;
        collaborators: ProjectMember[];
      };
      const normalized = [
        ...(payload.owner ? [payload.owner] : []),
        ...(payload.collaborators ?? []),
      ];
      setMembers(normalized);
    } catch {
      setMembers([]);
    }
  }, [projectId]);

  // ---------------------------------------------------------------------------
  // Bootstrap effects (run once per projectId)
  // ---------------------------------------------------------------------------

  useEffect(() => { void loadFileTree(); }, [loadFileTree]);
  useEffect(() => { void loadProject(); }, [loadProject]);
  useEffect(() => { void loadMembers(); }, [loadMembers]);

  // ---------------------------------------------------------------------------
  // Socket — stable: only depends on projectId
  // ---------------------------------------------------------------------------

  const loadFileTreeRef = useRef(loadFileTree);
  useEffect(() => { loadFileTreeRef.current = loadFileTree; }, [loadFileTree]);

  useEffect(() => {
    if (!projectId) return;
    const socketUrl = (() => {
      const collabUrl = import.meta.env.VITE_COLLAB_URL as string | undefined;
      if (collabUrl) {
        try {
          return new URL(collabUrl, window.location.origin).origin;
        } catch {
          // fall through
        }
      }

      const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
      try {
        return new URL(apiBase, window.location.origin).origin;
      } catch {
        return window.location.origin;
      }
    })();

    const socket = io(socketUrl, {
      withCredentials: true,
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => { socket.emit("join-project", projectId); });
    socket.on("file-tree-updated", (pid: string) => {
      if (pid === projectId) void loadFileTreeRef.current();
    });

    return () => {
      socket.off("file-tree-updated");
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [projectId]);

  // ---------------------------------------------------------------------------
  // Collab (Yjs + Hocuspocus) — runs when active file or editor readiness changes
  // ---------------------------------------------------------------------------

  // We keep a ref to markDirty so the Yjs observer can call it without being
  // in the effect's dep array.
  const markDirtyRef = useRef(markDirty);
  useEffect(() => { markDirtyRef.current = markDirty; }, [markDirty]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editorReady || !editor || !activeFile?.id || activeFile.type !== "file") {
      return;
    }

    const model = editor.getModel();
    if (!model) return;

    // Tear down previous session cleanly.
    collabRef.current?.binding.destroy();
    collabRef.current?.provider.destroy();
    collabRef.current?.doc.destroy();
    collabRef.current = null;

    const fileId = activeFile.id;
    const doc = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: import.meta.env.VITE_COLLAB_URL ?? "ws://localhost:4000/collab",
      name: `project:${projectId}:file:${fileId}`,
      document: doc,
      token: null,
    });

    const palette = ["#4ec9b0", "#f44747", "#dcdcaa", "#c586c0", "#9cdcfe"];
    const username = user?.username ?? "Guest";
    const color = palette[username.length % palette.length];
    provider.setAwarenessField("user", { name: username, color });
    provider.setAwarenessField("cursorColor", color);

    const yText = doc.getText("monaco");

    // Track dirty state via Yjs update observer.
    //
    // HOW YJS ORIGINS WORK:
    // - When MonacoBinding applies a local keystroke, origin = the MonacoBinding instance.
    // - When Hocuspocus syncs a remote change, origin = the HocuspocusProvider instance.
    // - Initial document load sync also uses origin = provider.
    //
    // So: if origin is the provider → remote/sync → NOT a user edit → don't mark dirty.
    // If origin is anything else (MonacoBinding, null, undefined) → local edit → mark dirty.
    const onYjsUpdate = (_update: Uint8Array, origin: unknown) => {
      if (origin !== provider) {
        // Local edit from this client — mark as unsaved.
        markDirtyRef.current(fileId);
      }
    };
    doc.on("update", onYjsUpdate);

    const binding = new MonacoBinding(
      yText,
      model,
      new Set([editor]),
      provider.awareness,
    );
    collabRef.current = { provider, doc, binding, fileId };

    return () => {
      doc.off("update", onYjsUpdate);
      binding.destroy();
      provider.destroy();
      doc.destroy();
      collabRef.current = null;
    };
  }, [activeFile?.id, activeFile?.type, editorReady, projectId, user?.username]);

  // Global cleanup on unmount.
  useEffect(
    () => () => {
      collabRef.current?.binding.destroy();
      collabRef.current?.provider.destroy();
      collabRef.current?.doc.destroy();
      collabRef.current = null;
      socketRef.current?.disconnect();
      socketRef.current = null;
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Editor mount
  // ---------------------------------------------------------------------------

  const onEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    const model = editor.getModel();
    if (model && activeFile) {
      monaco.editor.setModelLanguage(model, activeFile.language ?? "javascript");
    }
    setEditorReady(true);
  };

  // ---------------------------------------------------------------------------
  // File actions
  // ---------------------------------------------------------------------------

  const openFile = useCallback(
    (fileId: string) => {
      const next = files.find((f) => f.id === fileId);
      if (!next) return;
      setActiveFileId(next.id);
      setOpenFileIds((prev) => prev.includes(fileId) ? prev : [...prev, fileId]);
    },
    [files],
  );

  // Hard close — no dialog, just remove from open set.
  // Called after the user explicitly chose "Don't Save" or "Save" in the dialog.
  const forceCloseFile = useCallback(
    (fileId: string) => {
      markClean(fileId);
      setOpenFileIds((prev) => {
        const remaining = prev.filter((item) => item !== fileId);
        if (activeFileIdRef.current === fileId) {
          const fallback = remaining[0] ?? files.find((f) => f.type === "file")?.id;
          if (fallback) openFile(fallback);
        }
        return remaining;
      });
    },
    [files, markClean, openFile],
  );

  const onAddFile = useCallback(async () => {
    if (!projectId) return;
    const fileName = window.prompt("Enter file name", "newFile.js");
    if (!fileName) return;

    const extension = fileName.split(".").pop()?.toLowerCase();
    const languageGuess =
      extension === "py" ? "python"
      : extension === "ts" ? "typescript"
      : extension === "cpp" ? "cpp"
      : extension === "md" ? "markdown"
      : "javascript";

    const parentId = findFirstFolderId(fileTree);
    const response = await api.post(`/projects/${projectId}/files`, {
      name: fileName,
      type: "file",
      parentId,
      language: languageGuess,
      content: "",
    });
    const created = response.data.data as FileApiNode;
    await loadFileTree();
    setOpenFileIds((prev) => [...new Set([...prev, created._id])]);
    setActiveFileId(created._id);
  }, [fileTree, loadFileTree, projectId]);

  const onAddFolder = useCallback(async () => {
    if (!projectId) return;
    const folderName = window.prompt("Enter folder name", "new-folder");
    if (!folderName) return;
    await api.post(`/projects/${projectId}/files`, {
      name: folderName,
      type: "folder",
      parentId: null,
    });
    await loadFileTree();
  }, [loadFileTree, projectId]);

  const onRefreshExplorer = useCallback(() => {
    void loadFileTree();
  }, [loadFileTree]);

  // ---------------------------------------------------------------------------
  // Save — reads live content from Yjs doc, marks file clean on success
  // ---------------------------------------------------------------------------

  const onSave = useCallback(async (fileIdOverride?: string) => {
    const fileId = fileIdOverride ?? activeFileIdRef.current;
    if (!fileId) return;

    const isActiveFile = fileId === collabRef.current?.fileId;
    const content = isActiveFile
      ? (collabRef.current?.doc.getText("monaco").toString() ?? editorRef.current?.getModel()?.getValue() ?? "")
      : (editorRef.current?.getModel()?.getValue() ?? "");

    const currentFile = flattenFiles(fileTree).find((f) => f.id === fileId);
    const lang = currentFile?.language ?? "javascript";

    try {
      await api.put(`/files/${fileId}`, { content, language: lang });
      markClean(fileId);
    } catch (err: any) {
      console.error("Failed to save document:", err);
      if (err.response?.status === 401) {
        alert("Session expired or unauthorized. Please refresh the page or log in again to save.");
      } else if (err.response?.status === 403) {
        alert("You do not have permission to edit this file.");
      } else {
        alert("Failed to save the file. Please try again.");
      }
    }
  }, [fileTree, markClean]);

  // ---------------------------------------------------------------------------
  // Run
  // ---------------------------------------------------------------------------

  const onRun = useCallback(async () => {
    const fileId = activeFileIdRef.current;
    if (!fileId) return;

    const content =
      collabRef.current?.doc.getText("monaco").toString() ??
      editorRef.current?.getModel()?.getValue() ??
      "";

    const currentFile = flattenFiles(fileTree).find((f) => f.id === fileId);
    const lang = currentFile?.language ?? "javascript";

    setRunning(true);
    try {
      const response = await api.post("/run", {
        sourceCode: content,
        languageId: languageMap[lang] ?? 63,
      });
      setRunResult(response.data.data);
    } catch {
      setRunResult({
        stderr: "Execution service unavailable. Configure backend .env and Judge0.",
        status: { id: 13, description: "Internal Error" },
      });
    } finally {
      setRunning(false);
    }
  }, [fileTree]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loadingFiles) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111315] text-vscode-muted">
        Loading workspace...
      </div>
    );
  }

  return (
    <EditorShell
      activeFileId={activeFileId}
      dirtyFileIds={dirtyFileIds}
      fileTree={fileTree}
      language={language}
      onAddFile={onAddFile}
      onAddFolder={onAddFolder}
      onCloseFile={forceCloseFile}
      onEditorMount={onEditorMount}
      onOpenFile={openFile}
      onRefreshExplorer={onRefreshExplorer}
      onRun={onRun}
      onSave={onSave}
      openFileIds={openFileIds}
      collaborators={members}
      projectName={project?.name || projectId}
      runResult={runResult}
      running={running}
    />
  );
}
