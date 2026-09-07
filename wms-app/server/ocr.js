import mupdf from "mupdf";
import { createWorker } from "tesseract.js";

// A scanned document (no text layer) needs OCR. This threshold is deliberately
// low: anything with a meaningful embedded text layer is used as-is (faster and
// far more accurate than OCR), everything else is rasterized + OCR'd.
const MIN_TEXT_TOKENS = 6;

let workerPromise = null;
function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker("eng");
      return worker;
    })();
  }
  return workerPromise;
}

async function ocrBuffer(buffer) {
  const worker = await getWorker();
  const { data } = await worker.recognize(buffer);
  return { text: data.text || "", confidence: data.confidence || 0 };
}
export { ocrBuffer };

function extractEmbeddedText(page) {
  try {
    const st = page.toStructuredText();
    const text = st.asText() || "";
    return text.split("\u0000").join(" ").trim();
  } catch {
    return "";
  }
}

async function pageToText(doc, index, renderScale = 2) {
  const page = doc.loadPage(index);
  const embedded = extractEmbeddedText(page);
  const tokens = embedded.split(/\s+/).filter(Boolean);
  if (tokens.length >= MIN_TEXT_TOKENS) {
    return { page: index + 1, text: embedded, method: "text", confidence: 100 };
  }
  const pixmap = page.toPixmap(
    mupdf.Matrix.scale(renderScale, renderScale),
    mupdf.ColorSpace.DeviceRGB,
    true,
  );
  const png = Buffer.from(pixmap.asPNG());
  const { text, confidence } = await ocrBuffer(png);
  return {
    page: index + 1,
    text: (text || "").trim(),
    method: "ocr",
    confidence: Math.round(confidence),
  };
}

// Extract text from a PDF buffer. Each page either yields its embedded text
// layer (preferred) or is rendered to an image and OCR'd.
export async function extractPdfPages(buffer, { onProgress } = {}) {
  const doc = mupdf.Document.openDocument(buffer);
  const count = doc.countPages();
  const pages = [];
  for (let i = 0; i < count; i++) {
    pages.push(await pageToText(doc, i));
    if (onProgress) onProgress(i + 1, count);
  }
  doc.destroy?.();
  return { pages, fullText: pages.map((p) => p.text).filter(Boolean).join("\n") };
}