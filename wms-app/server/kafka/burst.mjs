#!/usr/bin/env node
// Concurrency demo: store 4 sample documents and publish document.received
// for each. They land in the same Kafka topic (3 partitions) with a random
// partition — the Java service (concurrency=3) picks them up concurrently.
//
// Usage: node server/kafka/burst.mjs [path-to-pdf]

import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { storeDocument } from "../storage.js";
import { publishDocumentReceived, disconnectProducer } from "./producer.js";

const PDF = process.argv[2] || "pdfs/Inward-IN-107.pdf";

const labels = ["Pre Gate Inward", "Gate Inward", "Inward", "Checklist Unloading"];

const buffer = await readFile(PDF);
for (const label of labels) {
  const { storageKey, fileLocation } = await storeDocument(buffer, "application/pdf");
  const eventId = randomUUID();
  const documentId = `imp-${randomUUID().slice(0, 8)}`;
  const ok = await publishDocumentReceived({
    eventId,
    documentId,
    source: "burst",
    fileName: `${label.replace(/\s+/g, "_")}.pdf`,
    mimeType: "application/pdf",
    fileLocation,
    receivedAt: new Date().toISOString(),
    metadata: { test: "burst-concurrency", docType: label },
  });
  console.log(`[burst] ${label.padEnd(22)} documentId=${documentId} published=${ok} storageKey=${storageKey}`);
}

await disconnectProducer();
console.log("[burst] done — check document-processing-service logs (concurrent OCR/Extraction)");