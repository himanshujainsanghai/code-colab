import React from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode,
  FilePlus2,
  Folder,
  FolderPlus,
  FolderOpen,
  GitBranch,
  Plus,
  Play,
  RefreshCw,
  Search,
  Settings,
  TerminalSquare,
  X,
} from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import type { FileNode, RunResult } from "../../lib/types";

interface EditorShellProps {
  projectName: string;
  fileTree: FileNode[];
  activeFileId: string;
  openFileIds: string[];
  /** Set of file IDs that have been locally modified since last save */
  dirtyFileIds: Set<string>;
  onOpenFile: (fileId: string) => void;
  /** Called after the close decision has been confirmed (save or discard). */
  onCloseFile: (fileId: string) => void;
  onRun: () => Promise<void>;
  onAddFile: () => void;
  onAddFolder: () => void;
  onRefreshExplorer: () => void;
  runResult: RunResult | null;
  running: boolean;
  /** Saves a specific file (or active file if no id passed) and marks it clean. */
  onSave: (fileId?: string) => Promise<void>;
  collaborators: Array<{
    id: string;
    username: string;
    email: string;
    avatar?: string;
    role: "owner" | "viewer" | "editor" | "admin";
  }>;
  language: string;
  onEditorMount?: OnMount;
}

// ---------------------------------------------------------------------------
// UnsavedDialog — VSCode-style modal, no browser confirm()
// ---------------------------------------------------------------------------
interface UnsavedDialogProps {
  fileName: string;
  onSave: () => void;
  onDontSave: () => void;
  onCancel: () => void;
}

function UnsavedDialog({ fileName, onSave, onDontSave, onCancel }: UnsavedDialogProps) {
  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onCancel();
  };
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onSave();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onSave, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px]"
      onClick={handleBackdrop}
    >
      <div
        className="w-[420px] rounded-lg border border-[#454545] bg-[#252526] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-dialog-title"
      >
        {/* Title bar */}
        <div className="flex items-start gap-4 px-6 pt-6 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#3a2d00]">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2L18.66 17H1.34L10 2z" fill="#f0c040" opacity="0.15" />
              <path d="M10 3.5L17.5 16.5H2.5L10 3.5z" stroke="#f0c040" strokeWidth="1.5" fill="none" />
              <rect x="9.25" y="8" width="1.5" height="4.5" rx="0.75" fill="#f0c040" />
              <rect x="9.25" y="13.5" width="1.5" height="1.5" rx="0.75" fill="#f0c040" />
            </svg>
          </div>
          <div>
            <h2 id="unsaved-dialog-title" className="text-[15px] font-semibold text-white leading-snug">
              Do you want to save the changes you made to {fileName}?
            </h2>
            <p className="mt-1.5 text-sm text-[#9d9d9d]">
              Your changes will be lost if you don&apos;t save them.
            </p>
          </div>
        </div>
        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-[#3c3c3c] px-6 py-4">
          <button
            autoFocus
            className="rounded px-4 py-1.5 text-sm font-medium text-white ring-1 ring-[#0078d4] bg-[#0078d4] hover:bg-[#0090f1] focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:ring-offset-1 focus:ring-offset-[#252526] transition-colors"
            onClick={onSave}
            type="button"
          >
            Save
          </button>
          <button
            className="rounded px-4 py-1.5 text-sm font-medium text-white ring-1 ring-[#454545] bg-transparent hover:bg-[#3c3c3c] focus:outline-none focus:ring-2 focus:ring-[#454545] focus:ring-offset-1 focus:ring-offset-[#252526] transition-colors"
            onClick={onDontSave}
            type="button"
          >
            Don&apos;t Save
          </button>
          <button
            className="rounded px-4 py-1.5 text-sm font-medium text-white ring-1 ring-[#454545] bg-transparent hover:bg-[#3c3c3c] focus:outline-none focus:ring-2 focus:ring-[#454545] focus:ring-offset-1 focus:ring-offset-[#252526] transition-colors"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Note: flattenFiles is intentionally NOT duplicated here.
// EditorPage owns the canonical file list and passes it as props.

function TreeNode({
  node,
  depth = 0,
  activeFileId,
  onOpenFile,
  expandedFolders,
  onToggleFolder,
}: {
  node: FileNode;
  depth?: number;
  activeFileId: string;
  onOpenFile: (fileId: string) => void;
  expandedFolders: Record<string, boolean>;
  onToggleFolder: (folderId: string) => void;
}) {
  const isFile = node.type === "file";
  const isActive = activeFileId === node.id;
  const open = expandedFolders[node.id] ?? true;

  if (isFile) {
    return (
      <button
        className={`flex w-full items-center gap-2 px-3 py-1 text-left text-sm hover:bg-[#2a2d2e] ${
          isActive ? "bg-[#37373d]" : ""
        }`}
        style={{ paddingLeft: 12 + depth * 12 }}
        onClick={() => onOpenFile(node.id)}
        type="button"
      >
        <File className="h-4 w-4 text-vscode-muted" />
        <span>{node.name}</span>
      </button>
    );
  }

  return (
    <div>
      <button
        className="flex w-full items-center gap-2 px-3 py-1 text-left text-sm text-vscode-yellow hover:bg-[#2a2d2e]"
        style={{ paddingLeft: 12 + depth * 12 }}
        onClick={() => onToggleFolder(node.id)}
        type="button"
      >
        <ChevronRight className={`h-4 w-4 ${open ? "rotate-90" : ""}`} />
        {open ? (
          <FolderOpen className="h-4 w-4" />
        ) : (
          <Folder className="h-4 w-4" />
        )}
        <span>{node.name}</span>
      </button>
      {open &&
        node.children?.map((child) => (
          <TreeNode
            key={child.id}
            activeFileId={activeFileId}
            depth={depth + 1}
            node={child}
            onOpenFile={onOpenFile}
            expandedFolders={expandedFolders}
            onToggleFolder={onToggleFolder}
          />
        ))}
    </div>
  );
}

export function EditorShell({
  projectName,
  fileTree,
  activeFileId,
  openFileIds,
  dirtyFileIds,
  onOpenFile,
  onCloseFile,
  onRun,
  onAddFile,
  onAddFolder,
  onRefreshExplorer,
  runResult,
  running,
  onSave,
  collaborators,
  language,
  onEditorMount,
}: EditorShellProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Pending close dialog state: holds the file we're about to close
  const [pendingClose, setPendingClose] = useState<{ id: string; name: string } | null>(null);
  // folderIds is used for collapse-all; we compute from fileTree directly.
  const folderIds = useMemo(() => {
    const visit = (nodes: FileNode[]): string[] =>
      nodes.flatMap((node) =>
        node.type === "folder" ? [node.id, ...visit(node.children ?? [])] : [],
      );
    return visit(fileTree);
  }, [fileTree]);
  // openFiles: flat list of files currently open in tabs
  const openFiles = useMemo(() => {
    const allFiles: FileNode[] = [];
    const flatten = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.type === "file") allFiles.push(node);
        else flatten(node.children ?? []);
      }
    };
    flatten(fileTree);
    return allFiles.filter((f) => openFileIds.includes(f.id));
  }, [fileTree, openFileIds]);
  // searchResults: search across file names + content from fileTree
  const searchableFiles = useMemo(() => {
    const all: FileNode[] = [];
    const flatten = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.type === "file") all.push(node);
        else flatten(node.children ?? []);
      }
    };
    flatten(fileTree);
    return all;
  }, [fileTree]);
  const [expandedFolders, setExpandedFolders] = useState<
    Record<string, boolean>
  >({});
  const [terminals, setTerminals] = useState<
    Array<{ id: string; name: string }>
  >([{ id: "terminal-1", name: "bash 1" }]);
  const [activeTerminalId, setActiveTerminalId] = useState("terminal-1");
  const [showSidebar, setShowSidebar] = useState(true);
  const [activeSidebarTab, setActiveSidebarTab] = useState<"explorer" | "search">("explorer");
  const [searchQuery, setSearchQuery] = useState("");
  const [showTerminal, setShowTerminal] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uiMessage, setUiMessage] = useState("");
  const uiMessageTimerRef = useRef<number | null>(null);
  // Stable ref to onSave — prevents keyboard useEffect from re-registering on every render
  const onSaveRef = useRef(onSave);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);
  // Close a tab — checks dirty state first. If dirty, shows the dialog.
  // If clean, closes immediately.
  const requestCloseFile = useCallback(
    (fileId: string) => {
      if (dirtyFileIds.has(fileId)) {
        const file = openFiles.find((f) => f.id === fileId);
        setPendingClose({ id: fileId, name: file?.name ?? "Untitled" });
      } else {
        onCloseFile(fileId);
      }
    },
    [dirtyFileIds, onCloseFile, openFiles],
  );
  // Dialog handlers
  const handleDialogSave = useCallback(async () => {
    if (!pendingClose) return;
    try {
      await onSaveRef.current(pendingClose.id);
    } catch {
      // Save failed — don't close, keep dialog open momentarily
      return;
    }
    onCloseFile(pendingClose.id);
    setPendingClose(null);
  }, [onCloseFile, pendingClose]);
  const handleDialogDontSave = useCallback(() => {
    if (!pendingClose) return;
    onCloseFile(pendingClose.id);
    setPendingClose(null);
  }, [onCloseFile, pendingClose]);
  const handleDialogCancel = useCallback(() => {
    setPendingClose(null);
  }, []);
  const collapseAllFolders = () => {
    const collapsed = folderIds.reduce<Record<string, boolean>>((acc, id) => {
      acc[id] = false;
      return acc;
    }, {});
    setExpandedFolders(collapsed);
  };
  
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const results: Array<{ file: FileNode; line: number; content: string; matchType: "name" | "content" }> = [];
    searchableFiles.forEach((file) => {
      if (file.name.toLowerCase().includes(query)) {
        results.push({ file, line: 0, content: file.name, matchType: "name" });
      }
      if (file.content) {
        const lines = file.content.split("\n");
        lines.forEach((lineContent, index) => {
          if (lineContent.toLowerCase().includes(query)) {
            results.push({ file, line: index + 1, content: lineContent.trim(), matchType: "content" });
          }
        });
      }
    });
    return results;
  }, [searchableFiles, searchQuery]);
  const addTerminal = () => {
    const id = `terminal-${Date.now()}`;
    const next = [...terminals, { id, name: `bash ${terminals.length + 1}` }];
    setTerminals(next);
    setActiveTerminalId(id);
  };
  const closeTerminal = (id: string) => {
    const filtered = terminals.filter((terminal) => terminal.id !== id);
    if (filtered.length === 0) {
      const fallback = { id: "terminal-1", name: "bash 1" };
      setTerminals([fallback]);
      setActiveTerminalId(fallback.id);
      return;
    }
    setTerminals(filtered);
    if (id === activeTerminalId) {
      setActiveTerminalId(filtered[0].id);
    }
  };
  const notify = useCallback((message: string) => {
    setUiMessage(message);
    if (uiMessageTimerRef.current) {
      window.clearTimeout(uiMessageTimerRef.current);
    }
    uiMessageTimerRef.current = window.setTimeout(() => {
      setUiMessage("");
      uiMessageTimerRef.current = null;
    }, 1800);
  }, []);
  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      notify("Entered fullscreen");
      return;
    }
    await document.exitFullscreen();
    notify("Exited fullscreen");
  }, [notify]);
  const saveCurrentFile = useCallback(async (fileId?: string) => {
    setIsSaving(true);
    try {
      await onSaveRef.current(fileId);
      notify("File saved");
    } catch {
      notify("Save failed");
    } finally {
      setIsSaving(false);
    }
  }, [notify]);
  const quickOpenFile = useCallback(() => {
    setShowSidebar(true);
    setActiveSidebarTab("search");
    setTimeout(() => {
      document.getElementById("workspace-search-input")?.focus();
    }, 100);
  }, []);
  const handleMenuAction = async (item: string) => {
    switch (item) {
      case "Dashboard":
        navigate("/dashboard");
        break;
      case "Profile":
        navigate("/profile");
        break;
      case "File":
        await saveCurrentFile();
        break;
      case "Edit":
        try {
          // Copy current editor model value via the DOM clipboard API
          await navigator.clipboard.writeText(
            document.querySelector(".monaco-editor textarea")?.textContent ?? "",
          );
          notify("Editor content copied");
        } catch {
          notify("Clipboard is unavailable");
        }
        break;
      case "Selection":
        collapseAllFolders();
        notify("Folders collapsed");
        break;
      case "View":
        setShowSidebar((prev) => !prev);
        notify(showSidebar ? "Sidebar hidden" : "Sidebar shown");
        break;
      case "Go":
        quickOpenFile();
        break;
      case "Run":
        await onRun();
        break;
      case "Terminal":
        setShowTerminal((prev) => !prev);
        notify(showTerminal ? "Terminal hidden" : "Terminal shown");
        break;
      case "Help":
        notify("Shortcuts: Ctrl+S save, Ctrl+` terminal, F11 fullscreen");
        break;
      default:
        break;
    }
  };
  const menuItems = [
    "Dashboard",
    "Profile",
    "File",
    "Edit",
    "Selection",
    "View",
    "Go",
    "Run",
    "Terminal",
    "Help",
  ];

  // Keyboard shortcuts — registered once, never torn down.
  // saveCurrentFile is stable (depends only on notify which is stable).
  // toggleFullscreen is stable (depends only on notify).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveCurrentFile();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "`") {
        event.preventDefault();
        setShowTerminal((prev) => !prev);
      }
      if (event.key === "F11") {
        event.preventDefault();
        void toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (uiMessageTimerRef.current) {
        window.clearTimeout(uiMessageTimerRef.current);
      }
    };
  }, [saveCurrentFile, toggleFullscreen]); // both are now permanently stable

  return (
    <div className="relative h-screen w-screen bg-vscode-bg text-vscode-text">
      {/* Unsaved-changes dialog — rendered above everything */}
      {pendingClose && (
        <UnsavedDialog
          fileName={pendingClose.name}
          onSave={() => void handleDialogSave()}
          onDontSave={handleDialogDontSave}
          onCancel={handleDialogCancel}
        />
      )}
      <div className="flex h-8 items-center justify-between border-b border-vscode-border bg-[#202124] px-3 text-xs text-vscode-muted">
        <div className="flex items-center gap-1">
          {menuItems.map((item) => (
            <button
              key={item}
              className="rounded px-2 py-1 hover:bg-[#2a2d2e] hover:text-white"
              onClick={() => void handleMenuAction(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
        <div className="text-xs text-vscode-muted">
          {projectName} - Colab Code
        </div>
        <div className="flex items-center gap-2 text-vscode-muted">
        </div>
      </div>
      <header className="flex h-11 items-center justify-between border-b border-vscode-border bg-vscode-panel px-4">
        <div className="flex items-center gap-3">
          <FileCode className="h-5 w-5 text-vscode-blue" />
          <h1 className="text-sm font-semibold">{projectName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-2 rounded-md bg-vscode-blue px-3 py-1 text-sm text-white hover:brightness-110"
            onClick={onRun}
            type="button"
          >
            <Play className="h-4 w-4" />
            {running ? "Running..." : "Run"}
          </button>
          <button
            className="flex items-center gap-1.5 rounded-md border border-vscode-border px-3 py-1 text-sm hover:bg-[#2a2d2e] transition-colors"
            onClick={() => void saveCurrentFile()}
            type="button"
            title={dirtyFileIds.has(activeFileId) ? "Unsaved changes (Ctrl+S to save)" : "All changes saved"}
          >
            {dirtyFileIds.has(activeFileId) && (
              <span className="inline-block h-2 w-2 rounded-full bg-orange-400 shrink-0" aria-label="Unsaved changes" />
            )}
            {isSaving ? "Saving..." : "Save"}
          </button>
          <div className="hidden items-center gap-2 md:flex">
            {user && (
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3a3d41] text-xs font-semibold text-white"
                title={`${user.username}`}
              >
                {(user.avatar || user.username || user.email)
                  .slice(0, 1)
                  .toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </header>
      {uiMessage && (
        <div className="border-b border-vscode-border bg-[#1f1f1f] px-4 py-1 text-xs text-vscode-blue">
          {uiMessage}
        </div>
      )}
      {!showSidebar && (
        <button
          className="absolute left-2 top-28 z-10 rounded-md border border-vscode-border bg-[#1f1f1f] px-2 py-1 text-xs text-vscode-muted hover:text-white"
          onClick={() => setShowSidebar(true)}
          type="button"
        >
          Show Sidebar
        </button>
      )}

      <Group className="h-[calc(100vh-6.25rem)]" orientation="vertical">
        <Panel defaultSize={showTerminal ? 76 : 100} minSize={55}>
          <Group className="overflow-hidden" orientation="horizontal">
            {showSidebar && (
              <>
                <Panel defaultSize="54px" maxSize="54px" minSize="54px">
                  <aside className="flex h-full flex-col items-center gap-4 border-r border-vscode-border bg-[#181818] py-3">
                    <button
                      className={`rounded p-1 ${activeSidebarTab === "explorer" ? "text-white" : "text-vscode-muted hover:bg-[#2a2d2e]"}`}
                      onClick={() => { setShowSidebar(true); setActiveSidebarTab("explorer"); }}
                      title="Explorer"
                      type="button"
                    >
                      <FileCode className="h-6 w-6" />
                    </button>
                    <button
                      className={`rounded p-1 ${activeSidebarTab === "search" ? "text-white" : "text-vscode-muted hover:bg-[#2a2d2e]"}`}
                      onClick={() => { setShowSidebar(true); setActiveSidebarTab("search"); }}
                      title="Search"
                      type="button"
                    >
                      <Search className="h-6 w-6" />
                    </button>
                    <button
                      className="rounded p-1 hover:bg-[#2a2d2e]"
                      onClick={() => notify("Source control panel coming soon")}
                      title="Source control"
                      type="button"
                    >
                      <GitBranch className="h-5 w-5 text-vscode-muted" />
                    </button>
                    <button
                      className="mt-auto rounded p-1 hover:bg-[#2a2d2e]"
                      onClick={() => notify("Settings panel coming soon")}
                      title="Settings"
                      type="button"
                    >
                      <Settings className="h-5 w-5 text-vscode-muted" />
                    </button>
                  </aside>
                </Panel>
                <Panel defaultSize="280px" maxSize="420px" minSize="220px">
                  <aside className="flex h-full flex-col border-r border-vscode-border bg-vscode-side">
                    {activeSidebarTab === "explorer" ? (
                      <>
                        <div className="flex items-center justify-between border-b border-vscode-border px-2 py-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-vscode-muted">
                            Explorer
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              className="rounded p-1 text-vscode-muted hover:bg-[#2a2d2e] hover:text-white"
                              onClick={onAddFile}
                              title="New File"
                              type="button"
                            >
                              <FilePlus2 className="h-4 w-4" />
                            </button>
                            <button
                              className="rounded p-1 text-vscode-muted hover:bg-[#2a2d2e] hover:text-white"
                              onClick={onAddFolder}
                              title="New Folder"
                              type="button"
                            >
                              <FolderPlus className="h-4 w-4" />
                            </button>
                            <button
                              className="rounded p-1 text-vscode-muted hover:bg-[#2a2d2e] hover:text-white"
                              onClick={onRefreshExplorer}
                              title="Refresh Explorer"
                              type="button"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </button>
                            <button
                              className="rounded p-1 text-vscode-muted hover:bg-[#2a2d2e] hover:text-white"
                              onClick={collapseAllFolders}
                              title="Collapse Folders"
                              type="button"
                            >
                              <ChevronDown className="h-4 w-4 -rotate-90" />
                            </button>
                          </div>
                        </div>
                        <div className="scrollbar-thin flex-1 overflow-auto py-1">
                          {fileTree.map((node) => (
                            <TreeNode
                              key={node.id}
                              activeFileId={activeFileId}
                              node={node}
                              onOpenFile={onOpenFile}
                              expandedFolders={expandedFolders}
                              onToggleFolder={(folderId) =>
                                setExpandedFolders((prev) => ({
                                  ...prev,
                                  [folderId]: !(prev[folderId] ?? true),
                                }))
                              }
                            />
                          ))}
                        </div>
                        <div className="border-t border-vscode-border px-2 py-2">
                          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-vscode-muted">
                            Collaborators
                          </div>
                          <div className="scrollbar-thin max-h-40 space-y-1 overflow-auto pr-1">
                            {collaborators.length === 0 && (
                              <p className="text-xs text-vscode-muted">
                                No collaborators yet
                              </p>
                            )}
                            {collaborators.map((member) => (
                              <div
                                key={member.id}
                                className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-[#2a2d2e]"
                                title={member.email}
                              >
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#3a3d41] font-semibold text-white">
                                  {(member.avatar || member.username || member.email)
                                    .slice(0, 1)
                                    .toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-vscode-text">
                                    {member.username || member.email}
                                  </p>
                                  <p className="truncate text-[10px] text-vscode-muted">
                                    {member.email}
                                  </p>
                                </div>
                                <span className="rounded bg-[#2f2f2f] px-1.5 py-0.5 text-[10px] uppercase text-vscode-blue">
                                  {member.role}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex h-full flex-col p-3">
                        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-vscode-muted">
                          Search
                        </div>
                        <div className="relative mb-4">
                          <input
                            id="workspace-search-input"
                            type="text"
                            placeholder="Search in files..."
                            className="w-full rounded bg-[#3c3c3c] px-3 py-1.5 text-sm text-vscode-text placeholder-vscode-muted focus:outline-none focus:ring-1 focus:ring-vscode-blue"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                          />
                        </div>
                        <div className="scrollbar-thin flex-1 overflow-auto">
                          {!searchQuery.trim() ? (
                            <p className="text-xs text-vscode-muted text-center mt-4">Type to search files and content</p>
                          ) : searchResults.length === 0 ? (
                            <p className="text-xs text-vscode-muted text-center mt-4">No results found.</p>
                          ) : (
                            <div className="space-y-2">
                              {searchResults.map((res, i) => (
                                <button
                                  key={`${res.file.id}-${i}`}
                                  className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-[#2a2d2e]"
                                  onClick={() => onOpenFile(res.file.id)}
                                >
                                  <div className="flex items-center gap-1.5 font-medium text-white">
                                    <File className="h-3.5 w-3.5 text-vscode-muted" />
                                    <span>{res.file.name}</span>
                                    {res.matchType === "content" && <span className="text-[10px] text-vscode-muted ml-auto">Line {res.line}</span>}
                                  </div>
                                  {res.matchType === "content" && (
                                    <div className="mt-1 truncate text-[10px] text-vscode-muted bg-[#232323] px-1.5 py-1 rounded border border-vscode-border">
                                      {res.content}
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </aside>
                </Panel>
                <Separator className="w-1 bg-vscode-border" />
              </>
            )}
            <Panel defaultSize={showSidebar ? "72%" : "100%"} minSize={40}>
              <section className="flex h-full flex-col bg-vscode-bg">
                <div className="flex min-h-9 items-center overflow-x-auto border-b border-vscode-border bg-vscode-panel">
                  {openFiles.map((file) => {
                    const isDirty = dirtyFileIds.has(file.id);
                    const isActive = file.id === activeFileId;
                    return (
                      <div
                        key={file.id}
                        className={`group relative flex shrink-0 items-center gap-1.5 border-r border-vscode-border px-3 py-2 text-sm select-none cursor-pointer ${
                          isActive ? "bg-vscode-bg" : "bg-vscode-panel text-vscode-muted hover:bg-[#2a2d2e]"
                        }`}
                        onClick={() => onOpenFile(file.id)}
                        role="tab"
                        aria-selected={isActive}
                        title={isDirty ? `${file.name} \u2014 unsaved changes` : file.name}
                      >
                        <File className="h-3.5 w-3.5 shrink-0" />
                        <span className={isDirty ? "italic" : ""}>{file.name}</span>
                        {/* Close/dirty indicator area — 16x16 fixed zone */}
                        <span className="relative ml-1 flex h-4 w-4 shrink-0 items-center justify-center">
                          {/* Dirty dot: visible when dirty AND not hovered */}
                          {isDirty && (
                            <span className="absolute inset-0 flex items-center justify-center group-hover:opacity-0 transition-opacity">
                              {/* Hollow circle — matches VSCode modified indicator */}
                              <svg width="10" height="10" viewBox="0 0 10 10" className="text-[#e8bf6a]">
                                <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                              </svg>
                            </span>
                          )}
                          {/* X button: always visible on hover, or always if not dirty */}
                          <button
                            className={`absolute inset-0 flex items-center justify-center rounded text-vscode-muted hover:bg-[#3c3c3c] hover:text-white transition-opacity ${
                              isDirty ? "opacity-0 group-hover:opacity-100" : "opacity-0 group-hover:opacity-100"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              requestCloseFile(file.id);
                            }}
                            title="Close"
                            type="button"
                            tabIndex={-1}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      </div>
                    );
                  })}
                </div>
                <Editor
                  defaultLanguage={language}
                  language={language}
                  onMount={onEditorMount}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    smoothScrolling: true,
                    wordWrap: "on",
                  }}
                  theme="vs-dark"
                  // NOTE: Do NOT set `value` or `onChange` here.
                  // MonacoBinding (Yjs) owns the model content.
                  // Feeding `value` back into Monaco while Yjs binding is active
                  // causes every edit to be applied twice.
                />
              </section>
            </Panel>
          </Group>
        </Panel>
        {showTerminal && (
          <>
            <Separator className="h-1 bg-vscode-border" />
            <Panel defaultSize={24} minSize={14}>
              <section className="h-full border-t border-vscode-border bg-vscode-panel">
                <div className="flex h-9 items-center justify-between border-b border-vscode-border bg-[#1f1f1f] px-2">
                  <div className="flex h-full items-center">
                    {terminals.map((terminal) => (
                      <button
                        key={terminal.id}
                        className={`flex h-full items-center gap-2 border-r border-vscode-border px-3 text-xs ${
                          terminal.id === activeTerminalId
                            ? "bg-vscode-panel text-white"
                            : "text-vscode-muted"
                        }`}
                        onClick={() => setActiveTerminalId(terminal.id)}
                        type="button"
                      >
                        <TerminalSquare className="h-3.5 w-3.5" />
                        <span>{terminal.name}</span>
                        <X
                          className="ml-1 rounded p-0.5 h-4 w-4 hover:bg-[#2a2d2e] hover:text-white"
                          onClick={(event) => {
                            event.stopPropagation();
                            closeTerminal(terminal.id);
                          }}
                        />
                      </button>
                    ))}
                  </div>
                  <button
                    className="mr-2 rounded p-1.5 text-vscode-muted hover:bg-[#2a2d2e] hover:text-white"
                    onClick={addTerminal}
                    title="New Terminal"
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="scrollbar-thin h-[calc(100%-2.25rem)] overflow-auto px-4 py-3 font-mono text-sm">
                  <p className="mb-2 text-xs text-vscode-muted">
                    [{activeTerminalId}]
                  </p>
                  {!runResult && (
                    <p className="text-vscode-muted">
                      Press Run to execute current file.
                    </p>
                  )}
                  {runResult?.stdout && (
                    <pre className="whitespace-pre-wrap text-vscode-green">
                      {runResult.stdout}
                    </pre>
                  )}
                  {runResult?.stderr && (
                    <pre className="whitespace-pre-wrap text-red-400">
                      {runResult.stderr}
                    </pre>
                  )}
                  {runResult?.compile_output && (
                    <pre className="whitespace-pre-wrap text-yellow-300">
                      {runResult.compile_output}
                    </pre>
                  )}
                  {runResult?.status && (
                    <p className="mt-2 text-xs text-vscode-muted">
                      status: {runResult.status.description} | time:{" "}
                      {runResult.time ?? "-"} | memory: {runResult.memory ?? "-"}
                    </p>
                  )}
                  {runResult?.engine && (
                    <p className="mt-1 text-xs text-vscode-muted">
                      engine: {runResult.engine}
                    </p>
                  )}
                  {runResult?.fallbackReason && (
                    <p className="mt-1 text-xs text-yellow-300">
                      fallback: {runResult.fallbackReason}
                    </p>
                  )}
                </div>
              </section>
            </Panel>
          </>
        )}
      </Group>
      {/* Status bar */}
      <div className="flex h-6 items-center justify-between border-t border-vscode-border bg-[#007acc] px-3 text-[11px] text-white">
        <div className="flex items-center gap-3">
          <span>Colab Code</span>
          {dirtyFileIds.size > 0 && (
            <span className="flex items-center gap-1 text-[#ffe082]">
              <svg width="10" height="10" viewBox="0 0 10 10">
                <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              {dirtyFileIds.size} unsaved {dirtyFileIds.size === 1 ? "file" : "files"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 opacity-80">
          <span>{language}</span>
          {dirtyFileIds.size === 0 && <span>All changes saved</span>}
        </div>
      </div>
    </div>
  );
}
