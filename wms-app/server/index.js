import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractPdfPages, ocrBuffer } from "./ocr.js";
import { extractWithLLM } from "./extract.js";
import { createItem, getItem, listItems, patchItem, removeItem } from "./store.js";
import { preprocessImage } from "./preprocess.js";
import { runBot, stopBot } from "./telegram/bot.js";

const PORT = process.env.PORT || 4001;
const MAX_SIZE = 12 * 1024 * 1024;

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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDFS_DIR = path.join(__dirname, "..", "pdfs");

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

// Test PDFs — list and serve files from the pdfs/ folder for simulate button.
app.get("/api/test-pdfs", async (_req, res) => {
  try {
    const files = await fs.readdir(PDFS_DIR);
    const pdfs = files.filter((f) => f.endsWith(".pdf")).map((f) => ({
      name: f,
      displayName: f.replace(/[-_]/g, " ").replace(/\.pdf$/i, ""),
    }));
    return res.json(pdfs);
  } catch {
    return res.json([]);
  }
});

app.get("/api/test-pdfs/:filename", async (req, res) => {
  try {
    const safeName = path.basename(req.params.filename);
    const filePath = path.join(PDFS_DIR, safeName);
    await fs.access(filePath);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
    const data = await fs.readFile(filePath);
    return res.send(data);
  } catch {
    return res.status(404).json({ error: "File not found." });
  }
});

// Unapproved import queue (WhatsApp bot / external sources).
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
    // Keep the ORIGINAL photo for vision re-scan — preprocessed crops can
    // lock onto the wrong bright region (monitor/keyboard) and starve the
    // vision model of the actual document, so pass through untouched.
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

// Stored document image (preprocessed JPEG) for vision re-scan on review. The
// image is kept out of the list endpoint so the 5s queue poll stays light.
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
    // Pass the image straight to the vision model untouched. Preprocessing
    // (bright-region crop + normalise) is tuned for OCR and can clip to the
    // wrong area of a photo, losing the document the model needs to read.
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

const server = app.listen(PORT, "0.0.0.0", async () => {
  console.log(`wms-import-api listening on port ${PORT} (all interfaces)`);
  try {
    await runBot();
  } catch (err) {
    console.error("[telegram] failed to start bot:", err.message);
  }
});

async function shutdown() {
  console.log("\nshutting down...");
  await stopBot();
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);