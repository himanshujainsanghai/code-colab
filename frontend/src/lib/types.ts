export type FileNodeType = "file" | "folder";

export interface FileNode {
  id: string;
  name: string;
  type: FileNodeType;
  parentId?: string | null;
  language?: string;
  content?: string;
  children?: FileNode[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
  collaborators: Array<{ id: string; name: string; avatar: string }>;
}

export interface RunResult {
  stdout?: string;
  stderr?: string;
  compile_output?: string;
  status?: { id: number; description: string };
  memory?: number;
  time?: string;
  engine?: "judge0" | "host-local";
  fallbackReason?: string;
}
