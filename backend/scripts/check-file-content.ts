/**
 * check-file-content.ts — inspect raw MongoDB content for all files.
 * Run: npx tsx scripts/check-file-content.ts
 */
import mongoose from "mongoose";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const FileNodeSchema = new mongoose.Schema({ name: String, type: String, content: String }, { strict: false });
const FileNode = mongoose.model("FileNode", FileNodeSchema);

async function main() {
  const mongoUrl = process.env.MONGO_URI ?? process.env.MONGODB_URI ?? process.env.DATABASE_URL ?? "";
  await mongoose.connect(mongoUrl);

  const files = await FileNode.find({ type: "file" }).lean();
  for (const f of files) {
    const content = (f as any).content ?? "";
    const lines = content.split("\n").length;
    const preview = content.slice(0, 120).replace(/\r?\n/g, "↵");
    console.log(`\n📄 ${(f as any).name} — ${content.length} chars, ${lines} lines`);
    console.log(`   Preview: ${preview}...`);
    // Check for obvious repetition
    const firstLine = content.split("\n")[0];
    const occurrences = content.split(firstLine).length - 1;
    if (occurrences > 2) {
      console.log(`   ⚠️  First line appears ${occurrences} times → LIKELY CORRUPTED`);
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);
