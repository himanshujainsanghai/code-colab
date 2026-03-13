import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { env } from "../config/env.js";

export type HostRunnerLanguage = "javascript" | "typescript" | "python" | "cpp";

export interface HostRunnerInput {
  sourceCode: string;
  language: HostRunnerLanguage;
  stdin?: string;
}

const MAX_SOURCE_CHARS = 30_000;
const MAX_STDIN_CHARS = 10_000;
const MAX_OUTPUT_CHARS = 20_000;

const denyPatterns: Record<HostRunnerLanguage, RegExp[]> = {
  javascript: [
    /\bchild_process\b/i,
    /\bprocess\s*\.\s*env\b/i,
    /\bprocess\s*\.\s*exit\s*\(/i,
    /\brequire\s*\(\s*["']fs["']\s*\)/i,
    /\bimport\s+.*\s+from\s+["']fs["']/i,
    /\bexec\s*\(/i,
    /\bspawn\s*\(/i,
  ],
  typescript: [
    /\bchild_process\b/i,
    /\bprocess\s*\.\s*env\b/i,
    /\bprocess\s*\.\s*exit\s*\(/i,
    /\bfrom\s+["']fs["']/i,
    /\bexec\s*\(/i,
    /\bspawn\s*\(/i,
  ],
  python: [
    /\bimport\s+os\b/i,
    /\bimport\s+subprocess\b/i,
    /\bos\s*\.\s*system\s*\(/i,
    /\bsubprocess\s*\./i,
    /\bexec\s*\(/i,
    /\beval\s*\(/i,
  ],
  cpp: [/\bsystem\s*\(/i, /\bpopen\s*\(/i, /\bCreateProcess/i, /\bShellExecute/i],
};

function truncateText(value: string) {
  if (value.length <= MAX_OUTPUT_CHARS) return value;
  return `${value.slice(0, MAX_OUTPUT_CHARS)}\n...output truncated...`;
}

function validateInput(input: HostRunnerInput) {
  if (input.sourceCode.length > MAX_SOURCE_CHARS) {
    throw new Error(`Source too large for host runner (max ${MAX_SOURCE_CHARS} chars).`);
  }
  if ((input.stdin ?? "").length > MAX_STDIN_CHARS) {
    throw new Error(`stdin too large for host runner (max ${MAX_STDIN_CHARS} chars).`);
  }
  const hasDangerousPattern = denyPatterns[input.language].some((pattern) =>
    pattern.test(input.sourceCode),
  );
  if (hasDangerousPattern) {
    throw new Error("Blocked by host-runner safety policy.");
  }
}

function normalizeCommand(command: string) {
  if (process.platform === "win32" && command === "py") return "py.exe";
  return command;
}

async function runProcess(args: {
  command: string;
  commandArgs: string[];
  cwd: string;
  stdin?: string;
  timeoutMs?: number;
}) {
  const timeoutMs = args.timeoutMs ?? env.HOST_RUN_TIMEOUT_MS;

  return new Promise<{ stdout: string; stderr: string; code: number | null }>(
    (resolve) => {
      const child = spawn(normalizeCommand(args.command), args.commandArgs, {
        cwd: args.cwd,
        stdio: "pipe",
        shell: false,
        windowsHide: true,
      });

      let stdout = "";
      let stderr = "";
      let finished = false;

      const timeout = setTimeout(() => {
        if (finished) return;
        finished = true;
        child.kill("SIGKILL");
        resolve({
          stdout: truncateText(stdout),
          stderr: truncateText(`${stderr}\nExecution timed out after ${timeoutMs}ms.`),
          code: 124,
        });
      }, timeoutMs);

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf-8");
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf-8");
      });

      child.on("error", (error) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        resolve({ stdout: "", stderr: error.message, code: 127 });
      });

      child.on("close", (code) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        resolve({
          stdout: truncateText(stdout),
          stderr: truncateText(stderr),
          code,
        });
      });

      if (args.stdin) {
        child.stdin.write(args.stdin);
      }
      child.stdin.end();
    },
  );
}

function statusFromExit(code: number | null) {
  if (code === 0) return { id: 3, description: "Accepted" };
  if (code === 124) return { id: 5, description: "Time Limit Exceeded" };
  return { id: 11, description: "Runtime Error" };
}

export async function runOnHost(input: HostRunnerInput) {
  validateInput(input);

  const workspace = await mkdtemp(path.join(os.tmpdir(), "colab-host-run-"));
  const startedAt = Date.now();

  try {
    if (input.language === "javascript") {
      const file = path.join(workspace, "main.js");
      await writeFile(file, input.sourceCode, "utf-8");
      const result = await runProcess({
        command: "node",
        commandArgs: [file],
        cwd: workspace,
        stdin: input.stdin,
      });
      return {
        stdout: result.stdout,
        stderr: result.stderr || undefined,
        status: statusFromExit(result.code),
        time: ((Date.now() - startedAt) / 1000).toFixed(3),
        memory: 0,
        engine: "host-local",
      };
    }

    if (input.language === "typescript") {
      const file = path.join(workspace, "main.ts");
      await writeFile(file, input.sourceCode, "utf-8");
      const tsxCli = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
      const result = await runProcess({
        command: process.execPath,
        commandArgs: [tsxCli, file],
        cwd: workspace,
        stdin: input.stdin,
      });
      return {
        stdout: result.stdout,
        stderr: result.stderr || undefined,
        status: statusFromExit(result.code),
        time: ((Date.now() - startedAt) / 1000).toFixed(3),
        memory: 0,
        engine: "host-local",
      };
    }

    if (input.language === "python") {
      const file = path.join(workspace, "main.py");
      await writeFile(file, input.sourceCode, "utf-8");
      const commands = [
        { command: "python", args: [file] },
        { command: "python3", args: [file] },
        { command: "py", args: ["-3", file] },
      ];

      let lastResult: { stdout: string; stderr: string; code: number | null } = {
        stdout: "",
        stderr: "Python runtime unavailable.",
        code: 127,
      };

      for (const entry of commands) {
        const result = await runProcess({
          command: entry.command,
          commandArgs: entry.args,
          cwd: workspace,
          stdin: input.stdin,
        });
        lastResult = result;
        if (result.code !== 127) break;
      }

      return {
        stdout: lastResult.stdout,
        stderr: lastResult.stderr || undefined,
        status: statusFromExit(lastResult.code),
        time: ((Date.now() - startedAt) / 1000).toFixed(3),
        memory: 0,
        engine: "host-local",
      };
    }

    // cpp
    const sourceFile = path.join(workspace, "main.cpp");
    const binary = process.platform === "win32" ? path.join(workspace, "main.exe") : path.join(workspace, "main");
    await writeFile(sourceFile, input.sourceCode, "utf-8");

    const compilation = await runProcess({
      command: "g++",
      commandArgs: [sourceFile, "-std=c++17", "-O2", "-o", binary],
      cwd: workspace,
    });

    if (compilation.code !== 0) {
      return {
        stdout: "",
        compile_output: compilation.stderr || "Compilation failed.",
        status: { id: 6, description: "Compilation Error" },
        time: ((Date.now() - startedAt) / 1000).toFixed(3),
        memory: 0,
        engine: "host-local",
      };
    }

    const execution = await runProcess({
      command: binary,
      commandArgs: [],
      cwd: workspace,
      stdin: input.stdin,
    });

    return {
      stdout: execution.stdout,
      stderr: execution.stderr || undefined,
      status: statusFromExit(execution.code),
      time: ((Date.now() - startedAt) / 1000).toFixed(3),
      memory: 0,
      engine: "host-local",
    };
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}
