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

function flattenFiles(nodes: FileNode[]): FileNode[] {
  return nodes.flatMap((node) => (node.type === "file" ? [node] : flattenFiles(node.children ?? [])));
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

function updateFileContent(
  nodes: FileNode[],
  fileId: string,
  content: string,
): { nodes: FileNode[]; changed: boolean } {
  let changed = false;
  const next = nodes.map((node) => {
    if (node.id === fileId && node.type === "file") {
      if ((node.content ?? "") === content) {
        return node;
      }
      changed = true;
      return { ...node, content };
    }
    if (node.children?.length) {
      const nested = updateFileContent(node.children, fileId, content);
      if (!nested.changed) {
        return node;
      }
      changed = true;
      return { ...node, children: nested.nodes };
    }
    return node;
  });
  return { nodes: next, changed };
}

export function EditorPage() {
  const { projectId = "multicoder" } = useParams();
  const { user } = useAuth();
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const files = useMemo(() => flattenFiles(fileTree), [fileTree]);
  const [openFileIds, setOpenFileIds] = useState<string[]>([]);
  const [activeFileId, setActiveFileId] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [running, setRunning] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [editorReady, setEditorReady] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const activeFileIdRef = useRef("");
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const collabRef = useRef<{
    provider: HocuspocusProvider;
    doc: Y.Doc;
    binding: MonacoBinding;
  } | null>(null);

  const activeFile = files.find((file) => file.id === activeFileId);
  const language = activeFile?.language ?? "javascript";

  useEffect(() => {
    activeFileIdRef.current = activeFileId;
  }, [activeFileId]);

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
        const srcFolder = srcItems.find((item) => item.name === "src" && item.type === "folder");
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
          setFileContent(firstFile.content ?? "");
        }
        return;
      }

      setFileTree(buildTree(items));
      const firstFile = items.find((item) => item.type === "file");
      const preferredActiveId =
        items.some((item) => item._id === activeFileIdRef.current) && activeFileIdRef.current
          ? activeFileIdRef.current
          : firstFile?._id ?? "";
      setActiveFileId(preferredActiveId);
      if (preferredActiveId) {
        setOpenFileIds((previous) => {
          const merged = new Set(previous);
          if (merged.size === 0) {
            merged.add(preferredActiveId);
          }
          return Array.from(merged).filter((id) => items.some((item) => item._id === id));
        });
      }
    } finally {
      setLoadingFiles(false);
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

  useEffect(() => {
    void loadFileTree();
  }, [loadFileTree]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    if (!activeFile) return;
    setFileContent(activeFile.content ?? "");
  }, [activeFile?.id]);

  const openFile = useCallback((fileId: string) => {
    const next = files.find((file) => file.id === fileId);
    if (!next) return;
    setActiveFileId(next.id);
    setFileContent(next.content ?? "");
    setOpenFileIds((prev) => (prev.includes(fileId) ? prev : [...prev, fileId]));
  }, [files]);

  const closeFile = useCallback((fileId: string) => {
    setOpenFileIds((prev) => prev.filter((item) => item !== fileId));
    if (activeFileId === fileId) {
      const fallback = openFileIds.find((item) => item !== fileId) ?? files.find((file) => file.type === "file")?.id;
      if (fallback) {
        openFile(fallback);
      }
    }
  }, [activeFileId, files, openFile, openFileIds]);

  const onRun = async () => {
    if (!activeFile) return;
    setRunning(true);
    try {
      const response = await api.post("/run", {
        sourceCode: fileContent,
        languageId: languageMap[language] ?? 63,
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
  };

  const onSave = useCallback(async () => {
    if (!activeFileId || !activeFile || activeFile.type !== "file") return;
    await api.put(`/files/${activeFileId}`, {
      content: fileContent,
      language,
    });
  }, [activeFile, activeFileId, fileContent, language]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editorReady || !editor || !activeFile?.id || activeFile.type !== "file") {
      return;
    }

    const model = editor.getModel();
    if (!model) return;

    collabRef.current?.binding.destroy();
    collabRef.current?.provider.destroy();
    collabRef.current?.doc.destroy();
    collabRef.current = null;

    const initialValue = activeFile.content ?? "";
    if (model.getValue() !== initialValue) {
      model.setValue(initialValue);
    }

    const doc = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: import.meta.env.VITE_COLLAB_URL ?? "ws://localhost:1234",
      name: `project:${projectId}:file:${activeFile.id}`,
      document: doc,
      token: null,
    });

    const palette = ["#4ec9b0", "#f44747", "#dcdcaa", "#c586c0", "#9cdcfe"];
    const username = user?.username ?? "Guest";
    const color = palette[username.length % palette.length];
    provider.setAwarenessField("user", {
      name: username,
      color,
    });
    provider.setAwarenessField("cursorColor", color);

    const yText = doc.getText("monaco");
    // Prevent brief empty-doc overwrite on initial bind.
    // If room cache/server doc is empty, seed local Yjs text from current file content first.
    if (yText.length === 0 && initialValue.length > 0) {
      yText.insert(0, initialValue);
    }
    const binding = new MonacoBinding(yText, model, new Set([editor]), provider.awareness);
    collabRef.current = { provider, doc, binding };

    return () => {
      binding.destroy();
      provider.destroy();
      doc.destroy();
      collabRef.current = null;
    };
  }, [activeFile?.id, activeFile?.type, editorReady, projectId, user?.username]);

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

  useEffect(() => {
    if (!projectId) return;

    const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
    const socketUrl = apiBase.replace(/\/api\/?$/, "");
    const socket = io(socketUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join-project", projectId);
    });

    socket.on("file-tree-updated", (incomingProjectId: string) => {
      if (incomingProjectId === projectId) {
        void loadFileTree();
      }
    });

    return () => {
      socket.off("file-tree-updated");
      socket.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [loadFileTree, projectId]);

  const onEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    const model = editor.getModel();
    if (model && activeFile) {
      monaco.editor.setModelLanguage(model, activeFile.language ?? "javascript");
    }
    setEditorReady(true);
  };

  const onAddFile = useCallback(async () => {
    if (!projectId) return;
    const fileName = window.prompt("Enter file name", "newFile.js");
    if (!fileName) return;

    const extension = fileName.split(".").pop()?.toLowerCase();
    const languageGuess =
      extension === "py"
        ? "python"
        : extension === "ts"
          ? "typescript"
          : extension === "cpp"
            ? "cpp"
            : extension === "md"
              ? "markdown"
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
    setFileContent("");
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

  const onEditorChange = useCallback((content: string) => {
    setFileContent(content);
    if (!activeFileId) return;
    setFileTree((previous) => {
      const updated = updateFileContent(previous, activeFileId, content);
      return updated.changed ? updated.nodes : previous;
    });
  }, [activeFileId]);

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
      fileContent={fileContent}
      fileTree={fileTree}
      language={language}
      onAddFile={onAddFile}
      onAddFolder={onAddFolder}
      onCloseFile={closeFile}
      onEditorMount={onEditorMount}
      onOpenFile={openFile}
      onRefreshExplorer={onRefreshExplorer}
      onRun={onRun}
      onSave={onSave}
      openFileIds={openFileIds}
      collaborators={members}
      projectName={projectId}
      runResult={runResult}
      running={running}
      setFileContent={onEditorChange}
    />
  );
}
