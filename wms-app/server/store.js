import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Serverless environments (Vercel) only allow writes to /tmp; the committed
// data/pending.json stays a read-only seed there. Local runs keep the file.
const DATA_DIR = process.env.VERCEL ? "/tmp/wms-pending" : path.join(__dirname, "data");
const FILE = path.join(DATA_DIR, "pending.json");

let cache = null;

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, "[]", "utf8");
  }
}

async function readItems() {
  if (cache) return cache;
  await ensureFile();
  const raw = await fs.readFile(FILE, "utf8");
  try {
    cache = JSON.parse(raw);
  } catch {
    cache = [];
  }
  if (!Array.isArray(cache)) cache = [];
  return cache;
}

async function writeItems(items) {
  cache = items;
  await ensureFile();
  await fs.writeFile(FILE, JSON.stringify(items, null, 2), "utf8");
}

export async function listItems({ status } = {}) {
  const items = await readItems();
  const filtered = !status || status === "all" ? items : items.filter((i) => i.status === status);
  // Keep stored images out of list responses — the queue poll runs every 5s
  // and images are megabytes of base64. Fetch via GET /api/imports/:id/image.
  return filtered.map(({ image, ...rest }) => rest);
}

export async function getItem(id) {
  const items = await readItems();
  return items.find((i) => i.id === id) || null;
}

export async function createItem(entry) {
  const items = await readItems();
  const item = {
    id: `imp-${randomUUID().slice(0, 8)}`,
    status: "unapproved",
    receivedAt: new Date().toISOString(),
    ...entry,
  };
  items.push(item);
  await writeItems(items);
  return item;
}

export async function patchItem(id, patch) {
  const items = await readItems();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...patch };
  await writeItems(items);
  return items[idx];
}

export async function removeItem(id) {
  const items = await readItems();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  const [removed] = items.splice(idx, 1);
  await writeItems(items);
  return removed;
}