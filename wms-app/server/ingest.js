import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { storeDocument } from "../storage.js";
import { createItem } from "../store.js";
import { publishDocumentReceived } from "../kafka/producer.js";
import { enqueuePublish } from "../kafka/outbox.js";

// POST /api/ingest
// Event-driven ingestion: store the raw document (object storage + queue item),
// publish DocumentReceived to Kafka, return immediately. OCR/AI extraction
// happens asynchronously in the Java document-processing service.
// If publish to Kafka fails, the event goes to the durable outbox (retried with
// backoff) so the document is never silently lost.

const MAX_SIZE = 12 * 1024 * 1024;
const ACCEPTED = new Set(["application/pdf", "image/png", "image/jpeg"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
});

export const ingestRouter = Router();

ingestRouter.post("/ingest", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded (field name: file)." });
    }
    const mime = req.file.mimetype || "";
    if (!ACCEPTED.has(mime)) {
      return res
        .status(415)
        .json({ error: `Unsupported type "${mime}". Send a PDF, PNG or JPEG.` });
    }

    // 1. Persist the raw bytes durably (object storage).
    const { storageKey, fileLocation } = await storeDocument(req.file.buffer, mime);

    // 2. Create the queue item. Kept at the existing "unapproved" status so the
    //    ImportPage lists it exactly like today — results are back-filled by the
    //    Java service via PATCH once processing completes.
    const item = await createItem({
      fileName: req.file.originalname,
      mime,
      sender: req.body.sender || "",
      group: req.body.group || "",
      source: req.body.source || "api",
      storageKey,
      fileLocation,
      status: "unapproved",
    });

    // 3. Publish the DocumentReceived event (idempotency key = documentId).
    const event = {
      eventId: randomUUID(),
      documentId: item.id,
      source: (req.body.source || "api").toUpperCase(),
      fileName: req.file.originalname,
      mimeType: mime,
      fileLocation,
      receivedAt: item.receivedAt,
      metadata: {
        sender: req.body.sender || "",
        group: req.body.group || "",
      },
    };

    const published = await publishDocumentReceived(event);
    if (!published) {
      // Kafka unavailable: persist to outbox; the queue item stays visible.
      await enqueuePublish(event);
    }

    return res.status(201).json(item);
  } catch (err) {
    console.error("[ingest] error:", err.message);
    return res.status(500).json({ error: err.message || "Ingest failed." });
  }
});