import type { FileNode, ProjectSummary } from "./types";

export const mockProjects: ProjectSummary[] = [
  {
    id: "multicoder",
    name: "MultiCoder",
    description: "Collaborative VS Code style web IDE",
    updatedAt: "Updated 5 minutes ago",
    collaborators: [
      { id: "u1", name: "You", avatar: "Y" },
      { id: "u2", name: "Amit", avatar: "A" },
    ],
  },
  {
    id: "compiler-lab",
    name: "Compiler Lab",
    description: "Sandbox for execution and snippets",
    updatedAt: "Updated 2 hours ago",
    collaborators: [{ id: "u1", name: "You", avatar: "Y" }],
  },
];

export const mockTree: FileNode[] = [
  {
    id: "src-folder",
    name: "src",
    type: "folder",
    children: [
      {
        id: "main-js",
        name: "main.js",
        type: "file",
        language: "javascript",
        content: `function greet(name) {\n  return \`Hello, \${name}!\`;\n}\n\nconsole.log(greet("MultiCoder"));\n`,
      },
      {
        id: "utils-js",
        name: "utils.js",
        type: "file",
        language: "javascript",
        content: `export function sum(a, b) {\n  return a + b;\n}\n`,
      },
    ],
  },
  {
    id: "readme",
    name: "README.md",
    type: "file",
    language: "markdown",
    content: `# MultiCoder\n\nReal-time collaborative IDE powered by Monaco + Yjs.\n`,
  },
];

export const languageMap: Record<string, number> = {
  javascript: 63,
  typescript: 74,
  python: 71,
  cpp: 54,
  c: 50,
  java: 62,
};
