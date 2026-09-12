import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { publishDocumentReceived } from "./producer.js";

// Lightweight durable outbox: if the broker is unreachable when a document is
// ingested, the event is persisted here and retried by a background flusher.
// This prevents silent loss: the document is always stored first (queue item +
// object storage), and its event either publishes now or eventually.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTBOX_FILE = path.join(__dirname, "..", "data", "outbox.json");
const RETRY_MS = Number(process.env.KAFKA_OUTBOX_RETRY_MS || 5000);

async function readOutbox() {
  try {
    const raw = await fs.readFile(OUTBOX_FILE, "utf8");
    const rows = JSON.parse(raw);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function writeOutbox(rows) {
  await fs.mkdir(path.dirname(OUTBOX_FILE), { recursive: true });
  await fs.writeFile(OUTBOX_FILE, JSON.stringify(rows, null, 2), "utf8");
}

export async function enqueuePublish(event) {
  const rows = await readOutbox();
  if (!rows.some((r) => r.event?.eventId === event.eventId)) {
    rows.push({ event, attempts: 0, createdAt: new Date().toISOString() });
  }
  await writeOutbox(rows);
  console.warn(`[kafka-outbox] queued event ${event.eventId} for retry (${rows.length} pending)`);
}

let outboxTimer = null;

export function startOutboxFlusher() {
  if (outboxTimer) return outboxTimer;
  outboxTimer = setInterval(async () => {
    try {
      const rows = await readOutbox();
      if (!rows.length) return;
      const remaining = [];
      for (const row of rows) {
        const ok = await publishDocumentReceived(row.event);
        if (!ok) {
          row.attempts += 1;
          remaining.push(row);
        }
      }
      await writeOutbox(remaining);
      console.log(
        `[kafka-outbox] flush: ${rows.length - remaining.length}/${rows.length} delivered, ${remaining.length} pending`
      );
    } catch (err) {
      console.error("[kafka-outbox] flush error:", err.message);
    }
  }, RETRY_MS);
  outboxTimer.unref?.();
  console.log(`[kafka-outbox] flusher started (every ${RETRY_MS}ms)`);
  return outboxTimer;
}

export function stopOutboxFlusher() {
  if (outboxTimer) {
    clearInterval(outboxTimer);
    outboxTimer = null;
  }
}