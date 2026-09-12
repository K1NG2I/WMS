import mupdf from "mupdf";
import { preprocessImage } from "./preprocess.js";

const MIN_TEXT_TOKENS = 6;
const GOOGLE_VISION_URL = "https://vision.googleapis.com/v1/images:annotate";
const GOOGLE_API_KEY = process.env.GOOGLE_VISION_API_KEY || "";

async function ocrBuffer(buffer, { preprocessed = false } = {}) {
  if (!GOOGLE_API_KEY) {
    throw new Error("GOOGLE_VISION_API_KEY not set. Add it to server/.env or environment.");
  }
  return ocrProcessed(preprocessed ? buffer : await preprocessImage(buffer));
}

async function ocrProcessed(processed) {
  const base64 = processed.toString("base64");
  const body = {
    requests: [
      {
        image: { content: base64 },
        features: [
          { type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 },
        ],
      },
    ],
  };

  const res = await fetch(`${GOOGLE_VISION_URL}?key=${GOOGLE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Google Vision API error: ${res.status}`);
  }

  const data = await res.json();
  const annotation = data.responses?.[0]?.fullTextAnnotation;
  const text = annotation?.text || "";
  const confidence = annotation?.pages?.[0]?.confidence
    ? Math.round(annotation.pages[0].confidence * 100)
    : 70;

  return { text: text.trim(), confidence };
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
