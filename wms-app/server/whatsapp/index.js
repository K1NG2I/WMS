import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import FormData from "form-data";
import fetch from "node-fetch";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = path.join(__dirname, "config.json");
const OCR_URL = process.env.OCR_URL || "http://localhost:4001/api/imports";

export async function loadConfig() {
  const raw = await fs.readFile(CONFIG_FILE, "utf8");
  const cfg = JSON.parse(raw);
  return {
    enabled: !!cfg.enabled,
    groupNames: Array.isArray(cfg.groupNames) ? cfg.groupNames : [],
    acceptAllGroups: cfg.acceptAllGroups !== false,
  };
}

// Accept a candidate group's subject, given the allowlist config.
// Returns true if the group should be processed.
export function acceptsGroup(subject, cfg) {
  if (!subject) return cfg.acceptAllGroups;
  if (cfg.acceptAllGroups && cfg.groupNames.length === 0) return true;
  return cfg.groupNames.some((g) => g.toLowerCase() === subject.toLowerCase());
}

// Push a downloaded PDF buffer into the OCR queue (emits an "unapproved" item).
export async function pushPdf({ buffer, fileName, sender, group, source }) {
  const form = new FormData();
  form.append("file", buffer, {
    filename: fileName || "whatsapp-document.pdf",
    contentType: "application/pdf",
  });
  if (sender) form.append("sender", sender);
  if (group) form.append("group", group);
  if (source) form.append("source", source);

  const res = await fetch(OCR_URL, { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `OCR server responded ${res.status}`);
  }
  return data;
}

// --- Simulate mode -------------------------------------------------------
// Lets us test the whole flow without a real WhatsApp number. Run with
// WHATSAPP_SIMULATE=1 to simulate a PDF arriving from a group.
export async function runBot() {
  const cfg = await loadConfig();
  if (!cfg.enabled) {
    console.log("[whatsapp] disabled in config.json. Run `npm run bot:simulate` to test with a fake push.");
    return;
  }
  console.log("[whatsapp] enabled — would connect to WhatsApp (Baileys).");
  // Phase 2 real Baileys connection goes here.
  await new Promise(() => {});
}

export async function simulatePush({ sender, group, file }) {
  const filePath = file || path.join(__dirname, "..", "sample.pdf");
  const absPath = path.resolve(filePath);
  const buffer = await fs.readFile(absPath);
  const fileName = path.basename(absPath);
  const item = await pushPdf({
    buffer,
    fileName,
    sender: sender || "+00 0000 000000",
    group: group || "Simulated WhatsApp Group",
    source: "whatsapp-sim",
  });
  console.log("[whatsapp-sim] pushed →", item.id, item.fileName, `(to ${item.group} by ${item.sender})`);
  return item;
}