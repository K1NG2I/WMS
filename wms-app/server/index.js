import express from "express";
import cors from "cors";
import multer from "multer";
import { extractPdfPages, ocrBuffer } from "./ocr.js";

const PORT = process.env.PORT || 4001;
const MAX_SIZE = 20 * 1024 * 1024;

const app = express();
app.use(cors());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
});

const ACCEPTED = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "wms-import-api" });
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

app.listen(PORT, () => {
  console.log(`wms-import-api listening on http://localhost:${PORT}`);
});