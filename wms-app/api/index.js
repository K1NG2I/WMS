import express from "express";
import cors from "cors";
import multer from "multer";
import { extractPdfPages, ocrBuffer } from "../server/ocr.js";
import { preprocessImage } from "../server/preprocess.js";
import { extractWithLLM } from "../server/extract.js";
import { createItem, getItem, listItems, patchItem, removeItem } from "../server/store.js";

// Vercel Hobby caps request bodies at ~4.5 MB, so multipart uploads are capped
// well below the local server's 12 MB.
const MAX_SIZE = 4 * 1024 * 1024;

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
});

const ACCEPTED = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);

async function ocrUpload(buffer, mime) {
  if (mime === "application/pdf") {
    return { result: await extractPdfPages(buffer), processed: null };
  }
  const processed = await preprocessImage(buffer);
  const { text, confidence } = await ocrBuffer(processed, { preprocessed: true });
  return {
    processed,
    result: {
      pages: [{ page: 1, text: (text || "").trim(), method: "ocr", confidence }],
      fullText: (text || "").trim(),
    },
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "wms-import-api" });
});

// Unapproved import queue (API uploads). Note: on serverless the queue lives in
// /tmp, so it resets when instances spin down and is not shared between them.
app.post("/api/imports", upload.single("file"), async (req, res) => {
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
    const { result } = await ocrUpload(req.file.buffer, mime);
    const image = mime === "application/pdf"
      ? null
      : `data:${mime};base64,${req.file.buffer.toString("base64")}`;
    const item = await createItem({
      fileName: req.file.originalname,
      mime,
      sender: req.body.sender || "",
      group: req.body.group || "",
      source: req.body.source || "api",
      ...result,
      image,
    });
    return res.status(201).json(item);
  } catch (err) {
    console.error("[imports] create error:", err);
    return res.status(500).json({ error: err.message || "Import failed." });
  }
});

app.get("/api/imports", async (req, res) => {
  try {
    const status = req.query.status || "all";
    const items = await listItems({ status });
    return res.json(items);
  } catch (err) {
    console.error("[imports] list error:", err);
    return res.status(500).json({ error: err.message || "Failed to list imports." });
  }
});

app.patch("/api/imports/:id", async (req, res) => {
  try {
    const item = await patchItem(req.params.id, req.body || {});
    if (!item) return res.status(404).json({ error: "Import not found." });
    return res.json(item);
  } catch (err) {
    console.error("[imports] patch error:", err);
    return res.status(500).json({ error: err.message || "Failed to update import." });
  }
});

app.delete("/api/imports/:id", async (req, res) => {
  try {
    const item = await removeItem(req.params.id);
    if (!item) return res.status(404).json({ error: "Import not found." });
    return res.json({ ok: true, id: item.id });
  } catch (err) {
    console.error("[imports] delete error:", err);
    return res.status(500).json({ error: err.message || "Failed to delete import." });
  }
});

app.get("/api/imports/:id/image", async (req, res) => {
  try {
    const item = await getItem(req.params.id);
    if (!item) return res.status(404).json({ error: "Import not found." });
    if (!item.image) return res.status(404).json({ error: "No image stored for this import." });
    return res.json({ image: item.image });
  } catch (err) {
    console.error("[imports] image error:", err);
    return res.status(500).json({ error: err.message || "Failed to load image." });
  }
});

app.post("/api/import/ocr", upload.single("file"), async (req, res) => {
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
    const buffer = req.file.buffer;

    let result;
    if (mime === "application/pdf") {
      result = await extractPdfPages(buffer);
    } else {
      const { text, confidence } = await ocrBuffer(buffer);
      result = {
        pages: [{ page: 1, text: (text || "").trim(), method: "ocr", confidence }],
        fullText: (text || "").trim(),
      };
    }

    return res.json({
      fileName: req.file.originalname,
      mime,
      ...result,
    });
  } catch (err) {
    console.error("[ocr] error:", err);
    return res.status(500).json({ error: err.message || "OCR failed." });
  }
});

app.post("/api/extract", async (req, res) => {
  const { text, docLabel, fields, image } = req.body || {};
  const hasText = typeof text === "string" && text.trim().length > 0;
  const hasImage = typeof image === "string" && image.length > 0;
  if ((!hasText && !hasImage) || !Array.isArray(fields)) {
    return res.status(400).json({ error: "Body needs { fields } and either text or image (data URL)." });
  }
  if (
    !process.env.NVIDIA_API_KEY &&
    !process.env.NVIDIA_API_KEY_FALLBACK &&
    !process.env.NVIDIA_API_KEY_FALLBACK2
  ) {
    return res.status(501).json({ error: "NVIDIA_API_KEY not configured." });
  }
  try {
    const result = await extractWithLLM({
      text: (text || "").toString(),
      docLabel: docLabel || "",
      fields,
      image: hasImage ? image : undefined,
    });
    return res.json(result);
  } catch (err) {
    console.error("[extract] error:", err.message);
    return res.status(502).json({ error: err.message || "LLM extraction failed." });
  }
});

export default app;