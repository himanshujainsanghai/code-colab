/**
 * repair-corrupted-files.ts
 *
 * One-time repair script for FileNode documents whose `content` field was
 * corrupted by the old Hocuspocus persistence code (content appended to itself
 * on every page load / session).
 *
 * Run with:
 *   cd backend
 *   npx tsx scripts/repair-corrupted-files.ts
 *
 * The script is read-only by default (DRY_RUN=true).
 * To actually fix the documents, run:
 *   DRY_RUN=false npx tsx scripts/repair-corrupted-files.ts
 */

import mongoose from "mongoose";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const DRY_RUN = process.env.DRY_RUN !== "false";

// ── Minimal inline schema (avoids loading the full app) ──────────────────────
const FileNodeSchema = new mongoose.Schema(
  { name: String, type: String, content: String, language: String, projectId: String },
  { strict: false },
);
const FileNode = mongoose.model("FileNode", FileNodeSchema);

// ── Repair logic ─────────────────────────────────────────────────────────────

function repairRepeatedContent(content: string): { repaired: string; wasCorrupted: boolean; repetitions: number } {
  const lines = content.split("\n");
  if (lines.length < 10) return { repaired: content, wasCorrupted: false, repetitions: 1 };

  for (let win = 2; win <= Math.min(80, Math.floor(lines.length / 2)); win++) {
    const unit = lines.slice(0, win).join("\n");
    if (unit.trim().length === 0) continue;

    const repetitions = Math.round(lines.length / win);
    if (repetitions < 2) continue;

    const candidate = Array(repetitions).fill(unit).join("\n");
    if (content.startsWith(candidate.slice(0, Math.floor(candidate.length * 0.9)))) {
      return { repaired: unit, wasCorrupted: true, repetitions };
    }
  }

  return { repaired: content, wasCorrupted: false, repetitions: 1 };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const mongoUrl = process.env.MONGO_URI ?? process.env.MONGODB_URI ?? process.env.DATABASE_URL;
  if (!mongoUrl) {
    console.error("❌  No MongoDB URI found in .env (tried MONGO_URI, MONGODB_URI, DATABASE_URL)");
    process.exit(1);
  }

  console.log("🔌  Connecting to MongoDB…");
  await mongoose.connect(mongoUrl);
  console.log("✅  Connected.\n");

  if (DRY_RUN) {
    console.log("ℹ️   DRY RUN — no changes will be written. Set DRY_RUN=false to apply fixes.\n");
  }

  const files = await FileNode.find({ type: "file" }).lean();
  console.log(`📂  Found ${files.length} file documents to inspect.\n`);

  let fixed = 0;
  let skipped = 0;

  for (const file of files) {
    const content = (file as any).content ?? "";
    if (!content) { skipped++; continue; }

    const { repaired, wasCorrupted, repetitions } = repairRepeatedContent(content);

    if (!wasCorrupted) { skipped++; continue; }

    const namePart = `${(file as any).name} (${(file as any)._id})`;
    console.log(`🔧  ${namePart}`);
    console.log(`    Was: ${content.length} chars (≈${repetitions}× repeated)`);
    console.log(`    Fix: ${repaired.length} chars (1 copy)\n`);

    if (!DRY_RUN) {
      await FileNode.updateOne({ _id: (file as any)._id }, { $set: { content: repaired } });
      console.log(`    ✅  Written to MongoDB.\n`);
    }

    fixed++;
  }

  console.log("─".repeat(60));
  console.log(`✅  Done. ${fixed} file(s) ${DRY_RUN ? "need repair" : "repaired"}. ${skipped} file(s) OK.`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
