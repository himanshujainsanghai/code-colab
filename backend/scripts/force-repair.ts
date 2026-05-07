/**
 * force-repair.ts
 *
 * Forces repair of specific corrupted files based on content patterns.
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

  const files = await FileNode.find({ type: "file" });
  for (const f of files) {
    let content = (f as any).content ?? "";
    let modified = false;

    // Fix index.cpp
    if (f.name === "index.cpp" && content.includes("#include<iostream>")) {
      const firstReturn = content.indexOf("return 0;\n}");
      const fallbackReturn = content.indexOf("return 0;\r\n}");
      const returnIndex = Math.max(firstReturn, fallbackReturn);
      if (returnIndex > 0) {
        content = content.substring(0, returnIndex + 12);
        modified = true;
      } else {
          // If we can't find a clean return, just reset it to a standard template
          content = `#include<iostream>\nusing namespace std;\n\nint main(){\n    cout<<"hello from himanshu";\n    return 0;\n}`;
          modified = true;
      }
    }

    // Fix main.js
    if (f.name === "main.js" && content.includes("console.log(\"Hello from Colab Code\");console.log")) {
        content = `console.log("Hello from Colab Code");\n`;
        modified = true;
    }
    if (f.name === "main.js" && content.includes("console.log(\"Hello from Colab Code\");\nconsole.log")) {
        content = `console.log("Hello from Colab Code");\n`;
        modified = true;
    }


    if (modified) {
      console.log(`Fixing ${f.name} (${f._id})...`);
      (f as any).content = content;
      await f.save();
    }
  }
  
  console.log("Done fixing.");
  await mongoose.disconnect();
}

main().catch(console.error);
