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
  Minus,
  Plus,
  Play,
  RefreshCw,
  Search,
  Settings,
  Square,
  TerminalSquare,
  X,
} from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FileNode, RunResult } from "../../lib/types";

interface EditorShellProps {
  projectName: string;
  fileTree: FileNode[];
  activeFileId: string;
  openFileIds: string[];
  onOpenFile: (fileId: string) => void;
  onCloseFile: (fileId: string) => void;
  onRun: () => Promise<void>;
  onAddFile: () => void;
  onAddFolder: () => void;
  onRefreshExplorer: () => void;
  runResult: RunResult | null;
  running: boolean;
  onSave: () => Promise<void>;
  collaborators: Array<{
    id: string;
    username: string;
    email: string;
    avatar?: string;
    role: "owner" | "viewer" | "editor" | "admin";
  }>;
  fileContent: string;
  setFileContent: (content: string) => void;
  language: string;
  onEditorMount?: OnMount;
}

function flattenFiles(nodes: FileNode[]): FileNode[] {
  return nodes.flatMap((node) =>
    node.type === "file" ? [node] : flattenFiles(node.children ?? []),
  );
}

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
  fileContent,
  setFileContent,
  language,
  onEditorMount,
}: EditorShellProps) {
  const files = useMemo(() => flattenFiles(fileTree), [fileTree]);
  const folderIds = useMemo(() => {
    const visit = (nodes: FileNode[]): string[] =>
      nodes.flatMap((node) =>
        node.type === "folder" ? [node.id, ...visit(node.children ?? [])] : [],
      );
    return visit(fileTree);
  }, [fileTree]);
  const [expandedFolders, setExpandedFolders] = useState<
    Record<string, boolean>
  >({});
  const [terminals, setTerminals] = useState<
    Array<{ id: string; name: string }>
  >([{ id: "terminal-1", name: "bash 1" }]);
  const [activeTerminalId, setActiveTerminalId] = useState("terminal-1");
  const [showSidebar, setShowSidebar] = useState(true);
  const [showTerminal, setShowTerminal] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uiMessage, setUiMessage] = useState("");
  const uiMessageTimerRef = useRef<number | null>(null);
  const openFiles = useMemo(
    () => files.filter((file) => openFileIds.includes(file.id)),
    [files, openFileIds],
  );
  const collapseAllFolders = () => {
    const collapsed = folderIds.reduce<Record<string, boolean>>((acc, id) => {
      acc[id] = false;
      return acc;
    }, {});
    setExpandedFolders(collapsed);
  };
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
  const minimizeWorkspace = useCallback(() => {
    setShowSidebar(false);
    setShowTerminal(false);
    notify("Focus mode enabled");
  }, [notify]);
  const closeCurrentTab = useCallback(() => {
    if (!activeFileId) return;
    onCloseFile(activeFileId);
    notify("Closed active tab");
  }, [activeFileId, notify, onCloseFile]);
  const saveCurrentFile = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave();
      notify("File saved");
    } catch {
      notify("Save failed");
    } finally {
      setIsSaving(false);
    }
  }, [notify, onSave]);
  const quickOpenFile = useCallback(() => {
    const query = window.prompt("Quick open file name");
    if (!query) return;
    const matched = files.find((file) =>
      file.name.toLowerCase().includes(query.trim().toLowerCase()),
    );
    if (matched) {
      onOpenFile(matched.id);
      notify(`Opened ${matched.name}`);
      return;
    }
    notify("No matching file found");
  }, [files, notify, onOpenFile]);
  const handleMenuAction = async (item: string) => {
    switch (item) {
      case "File":
        await saveCurrentFile();
        break;
      case "Edit":
        try {
          await navigator.clipboard.writeText(fileContent);
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
    "File",
    "Edit",
    "Selection",
    "View",
    "Go",
    "Run",
    "Terminal",
    "Help",
  ];

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
  }, [saveCurrentFile, toggleFullscreen]);

  return (
    <div className="relative h-screen w-screen bg-vscode-bg text-vscode-text">
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
          {projectName} - MultiCoder
        </div>
        <div className="flex items-center gap-2 text-vscode-muted">
          <button className="rounded p-0.5 hover:bg-[#2a2d2e]" onClick={minimizeWorkspace} title="Minimize workspace" type="button">
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button className="rounded p-0.5 hover:bg-[#2a2d2e]" onClick={() => void toggleFullscreen()} title="Toggle fullscreen" type="button">
            <Square className="h-3.5 w-3.5" />
          </button>
          <button className="rounded p-0.5 hover:bg-[#2a2d2e]" onClick={closeCurrentTab} title="Close current tab" type="button">
            <X className="h-3.5 w-3.5" />
          </button>
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
            className="rounded-md border border-vscode-border px-3 py-1 text-sm hover:bg-[#2a2d2e]"
            onClick={() => void saveCurrentFile()}
            type="button"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
          <button
            className="rounded-md border border-vscode-border px-3 py-1 text-sm hover:bg-[#2a2d2e]"
            onClick={() => setShowTerminal((prev) => !prev)}
            type="button"
          >
            Terminal
          </button>

          <div className="hidden items-center gap-2 md:flex">
            {collaborators.slice(0, 3).map((member) => (
              <div
                key={member.id}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3a3d41] text-xs font-semibold text-white"
                title={`${member.username} (${member.role})`}
              >
                {(member.avatar || member.username || member.email)
                  .slice(0, 1)
                  .toUpperCase()}
              </div>
            ))}
            {collaborators.length > 3 && (
              <div className="flex h-8 min-w-8 items-center justify-center rounded-full bg-[#2d2d2d] px-2 text-xs text-vscode-muted">
                +{collaborators.length - 3}
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

      <Group className="h-[calc(100vh-4.75rem)]" orientation="vertical">
        <Panel defaultSize={showTerminal ? 76 : 100} minSize={55}>
          <Group className="overflow-hidden" orientation="horizontal">
            {showSidebar && (
              <>
                <Panel defaultSize="54px" maxSize="54px" minSize="54px">
                  <aside className="flex h-full flex-col items-center gap-4 border-r border-vscode-border bg-[#181818] py-3">
                    <button
                      className="rounded p-1 hover:bg-[#2a2d2e]"
                      onClick={() => setShowSidebar((prev) => !prev)}
                      title="Files"
                      type="button"
                    >
                      <FileCode className="h-5 w-5 text-vscode-blue" />
                    </button>
                    <button
                      className="rounded p-1 hover:bg-[#2a2d2e]"
                      onClick={quickOpenFile}
                      title="Search files"
                      type="button"
                    >
                      <Search className="h-5 w-5 text-vscode-muted" />
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
                  </aside>
                </Panel>
                <Separator className="w-1 bg-vscode-border" />
              </>
            )}
            <Panel defaultSize={showSidebar ? "72%" : "100%"} minSize={40}>
              <section className="flex h-full flex-col bg-vscode-bg">
                <div className="flex min-h-9 items-center border-b border-vscode-border bg-vscode-panel">
                  {openFiles.map((file) => (
                    <button
                      key={file.id}
                      className={`flex items-center gap-2 border-r border-vscode-border px-3 py-2 text-sm ${
                        file.id === activeFileId
                          ? "bg-vscode-bg"
                          : "bg-vscode-panel text-vscode-muted"
                      }`}
                      onClick={() => onOpenFile(file.id)}
                      type="button"
                    >
                      <File className="h-3.5 w-3.5" />
                      <span>{file.name}</span>
                      <X
                        className="ml-1 rounded p-0.5 h-4 w-4 text-vscode-muted hover:bg-[#2a2d2e] hover:text-white"
                        onClick={(event) => {
                          event.stopPropagation();
                          onCloseFile(file.id);
                        }}
                      />
                    </button>
                  ))}
                </div>
                <Editor
                  defaultLanguage={language}
                  language={language}
                  onChange={(value) => setFileContent(value ?? "")}
                  onMount={onEditorMount}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    smoothScrolling: true,
                    wordWrap: "on",
                  }}
                  theme="vs-dark"
                  value={fileContent}
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
    </div>
  );
}
