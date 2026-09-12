import { pushPdf } from "./bot.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const filePath = process.argv[2] || path.join(__dirname, "..", "sample.pdf");
  const absPath = path.resolve(filePath);

  try {
    await fs.access(absPath);
  } catch {
    console.error(`[telegram-sim] file not found: ${absPath}`);
    process.exit(1);
  }

  const buffer = await fs.readFile(absPath);
  const fileName = path.basename(absPath);
  const sender = process.env.SIM_SENDER || "Test User (@testuser)";

  console.log(`[telegram-sim] pushing ${fileName} as "${sender}"...`);
  const item = await pushPdf({ buffer, fileName, sender, source: "telegram-sim" });
  console.log("[telegram-sim] done →", item.id, item.fileName);
}

main().catch((err) => {
  console.error("[telegram-sim] failed:", err.message);
  process.exit(1);
});
