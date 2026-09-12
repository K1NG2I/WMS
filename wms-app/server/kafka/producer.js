import { Kafka } from "kafkajs";

export const TOPIC_RECEIVED = "document.received";

// Host-exposed EXTERNAL listener (docker-compose publishes 9093 to the host).
const BROKERS = (process.env.KAFKA_BROKERS || "localhost:9093")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const CLIENT_ID = process.env.KAFKA_CLIENT_ID || "rwms-ingest-node";

let kafka = null;
let producer = null;
let connected = false;

function getKafka() {
  if (!kafka) {
    kafka = new Kafka({
      clientId: CLIENT_ID,
      brokers: BROKERS,
      retry: { retries: 3 },
    });
  }
  return kafka;
}

async function ensureProducer() {
  if (producer && connected) return producer;
  producer = getKafka().producer();
  await producer.connect();
  connected = true;
  console.log(`[kafka] producer connected to ${BROKERS.join(",")}`);
  return producer;
}

// Publish a DocumentReceived event. Returns true on success, false on failure
// so callers can fall back to the outbox instead of losing the document.
export async function publishDocumentReceived(event) {
  if (!event || !event.eventId || !event.documentId) return false;
  try {
    const p = await ensureProducer();
    await p.send({
      topic: TOPIC_RECEIVED,
      messages: [
        {
          key: event.documentId,
          value: JSON.stringify(event),
          headers: { "content-type": "application/json" },
        },
      ],
    });
    console.log(`[kafka] published ${TOPIC_RECEIVED} → ${event.documentId} (${event.source})`);
    return true;
  } catch (err) {
    console.error(`[kafka] publish failed for ${event.documentId}:`, err.message);
    return false;
  }
}

export async function disconnectProducer() {
  if (producer) {
    await producer.disconnect().catch(() => {});
    producer = null;
    connected = false;
    console.log("[kafka] producer disconnected.");
  }
}