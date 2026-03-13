import axios from "axios";
import { env } from "../config/env.js";
import { runOnHost, type HostRunnerLanguage } from "./host-runner.service.js";

const judgeApi = axios.create({
  baseURL: env.JUDGE0_URL,
  headers: env.JUDGE0_KEY ? { "X-RapidAPI-Key": env.JUDGE0_KEY } : undefined,
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const hostLanguageMap: Record<number, HostRunnerLanguage> = {
  63: "javascript",
  74: "typescript",
  71: "python",
  54: "cpp",
};

type RunInput = { sourceCode: string; languageId: number; stdin?: string };

async function runWithJudge0(input: RunInput) {
  const submitResponse = await judgeApi.post("/submissions?base64_encoded=false&wait=false", {
    source_code: input.sourceCode,
    language_id: input.languageId,
    stdin: input.stdin ?? "",
  });

  const token = submitResponse.data.token as string;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const result = await judgeApi.get(`/submissions/${token}?base64_encoded=false`);
    const statusId = result.data?.status?.id;
    if (statusId && statusId > 2) {
      return {
        ...result.data,
        engine: "judge0",
      };
    }
    await sleep(300);
  }

  throw new Error("Execution timed out while waiting for Judge0 result.");
}

export async function runCode(input: RunInput) {
  try {
    return await runWithJudge0(input);
  } catch (judgeError) {
    if (!env.HOST_RUNNER_ENABLED) {
      throw judgeError;
    }

    const language = hostLanguageMap[input.languageId];
    if (!language) {
      throw judgeError;
    }

    const hostResult = await runOnHost({
      sourceCode: input.sourceCode,
      language,
      stdin: input.stdin,
    });

    return {
      ...hostResult,
      fallbackReason: judgeError instanceof Error ? judgeError.message : "Judge0 unavailable",
    };
  }
}
