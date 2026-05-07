import { Redis } from "ioredis";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  if (!process.env.REDIS_URL) {
    console.error("No REDIS_URL found");
    return;
  }
  const redis = new Redis(process.env.REDIS_URL);
  
  console.log("Connected to Redis. Finding collab keys...");
  const keys = await redis.keys("collab:document:*");
  if (keys.length > 0) {
    console.log(`Found ${keys.length} keys. Deleting...`);
    await redis.del(...keys);
    console.log("Deleted.");
  } else {
    console.log("No keys found.");
  }
  
  redis.quit();
}

main().catch(console.error);
