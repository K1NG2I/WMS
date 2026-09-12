// Mirrors locally-completed documents onto the deployed Vercel queue so the
// live ImportPage shows the same items the local Kafka/Java pipeline processed.
//
//   docker compose up                       # run the pipeline (Kafka/Java/MinIO/Postgres)
//   node kafka/mirror.mjs                  # watch the local queue and push up
//
// Idempotent: the Vercel /api/mirror route replaces an existing item by id, so
// restarts and replays are harmless.

const LOCAL = (process.env.LOCAL_QUEUE_URL || "http://localhost:4001").replace(/\/$/, "");
const TARGET = (process.env.MIRROR_TARGET_URL || "https://wms-app-orpin.vercel.app").replace(/\/$/, "");
const POLL_MS = Number(process.env.MIRROR_POLL_MS || 5000);

const mirrored = new Set();

async function listCompleted() {
  const res = await fetch(`${LOCAL}/api/imports?status=unapproved`);
  if (!res.ok) throw new Error(`local queue ${res.status}`);
  const items = await res.json();
  return items.filter((i) => i?.processing?.status === "COMPLETED" && !mirrored.has(i.id));
}

async function fetchImage(id) {
  try {
    const res = await fetch(`${LOCAL}/api/imports/${id}/image`);
    if (res.ok) {
      const { image } = await res.json();
      return image || null;
    }
  } catch {
    // no image (e.g. PDFs) — fine
  }
  return null;
}

export async function mirrorItem(item) {
  const { storageKey, fileLocation, ...safe } = item;
  const image = await fetchImage(item.id);
  const payload = image ? { ...safe, image } : safe;

  const res = await fetch(`${TARGET}/api/mirror`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`mirror ${res.status}: ${body.slice(0, 120)}`);
  }
  return res.status;
}

async function tick() {
  try {
    const items = await listCompleted();
    for (const item of items) {
      try {
        const status = await mirrorItem(item);
        mirrored.add(item.id);
        console.log(`[mirror] pushed ${item.id} (${item.fileName || "unnamed"}) → ${TARGET} (${status})`);
      } catch (err) {
        console.error(`[mirror] failed for ${item.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error("[mirror] poll error:", err.message);
  }
}

console.log(`[mirror] watching ${LOCAL} → ${TARGET} every ${POLL_MS}ms`);
setInterval(tick, POLL_MS);
tick();