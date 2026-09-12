import OpenAI from "openai";

const TIMEOUT_MS = 90000;

const SUPER_MODEL = "nvidia/nemotron-3-super-120b-a12b";
const ULTRA_MODEL = "nvidia/nemotron-3-ultra-550b-a55b";
const VISION_MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning";

function makeClient(apiKey) {
  return new OpenAI({
    apiKey,
    baseURL: "https://integrate.api.nvidia.com/v1",
  });
}

function buildPrompt(docLabel, fields, text) {
  const fieldSchema = fields.map((f) => `- "${f.key}": "${f.label}" (${f.type || "text"})`).join("\n");

  const systemContent = `You are a document field extraction engine. You read OCR text and document images from warehouse documents and extract structured data into JSON.

RULES:
1. You MUST return ONLY valid JSON — no markdown, no explanation, no extra text.
2. Map each field key to its correct value from the document.
3. Handle common OCR misreads: "FRED" or "FELD" means "FIELD", "VAIUE" or "VA1UE" means "VALUE".
4. In table layouts, labels are in a "FIELD" column and values in a "VALUE" column — match them by position.
5. If a value appears on a line like "Customer/Vendor: Nimbus Retail Pvt Ltd", the value after the colon belongs to whichever field key fits best.
6. If a value is genuinely missing (no text found for that field), use an empty string "".
7. Clean up OCR artifacts: remove extra whitespace, fix broken words, ignore keyboard noise (Alt, Ctrl, Fn, etc.).
8. For dates, normalize to "YYYY-MM-DD" format if possible, otherwise return as-is.
9. If an image was provided, read the fields directly from the image — the image is the source of truth and always more reliable than garbled OCR text.
10. Fix obvious handwriting/OCR typos using logic: 0/O, 1/I/l/|, 5/S and 8/B are easily confused — normalise each character to the one that makes a real word, name or code. e.g. "MH OY" → "MH04", "Unesbh" → "Umesh", "dosen" → "down".
11. Indian vehicle numbers use the RTO format "MH 04 AB 1234" (2 letters, 1-2 digits, 1-2 letters, 3-4 digits). If a plate's digits look like letters (0/O, 1/I), correct them back to digits to match this format.

OUTPUT FORMAT (JSON only):
{
  "values": { "<fieldKey>": "<extracted value>" },
  "confidence": { "<fieldKey>": <1-3> }
}

Confidence scale:
- 3 = exact match, high certainty
- 2 = good match, minor ambiguity
- 1 = partial match, best guess`;

  const userContent = `Document type: ${docLabel || "Unknown"}

Fields to extract:
${fieldSchema}

OCR text:
---
${text}
---

Extract the values and return ONLY valid JSON.`;

  return { system: systemContent, user: userContent };
}

function normalizeVehicle(value) {
  // Indian RTO plate: "MH 04 AB 1234". Collapse to alphanumeric runs, fix the
  // classic handwriting/OCR confusions segment-by-segment (digits in digit
  // positions, letters in letter positions) and re-insert standard spacing.
  let runs = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z]{2}[0-9]/.test(runs)) {
    // Leading state code has letters where digits belong (e.g. "MHOY" = "MH04").
    const m = /^([A-Z]{2})([A-Z]{1,2})([A-Z0-9]+)$/.exec(runs);
    if (!m) return value.replace(/\s+/g, " ").trim();
    const dmap = { O: "0", I: "1", S: "5", B: "8", Z: "2", G: "6", Y: "4" };
    const digits = m[2].replace(/[A-Z]/g, (c) => dmap[c] || c);
    runs = m[1] + digits + m[3];
  }
  let s = runs.replace(/([A-Z]+)|(\d+)/g, (m, letters, digits) => {
    if (letters) return letters.replace(/0/g, "O").replace(/1/g, "I");
    return digits.replace(/O/g, "0").replace(/I/g, "1").replace(/l/g, "1");
  });
  const mm = /^([A-Z]{2})(\d{1,2})([A-Z]{1,2})(\d{1,4})([A-Z]?)$/.exec(s);
  if (mm) {
    return [mm[1], mm[2], mm[3], mm[4] + mm[5]].filter(Boolean).join(" ");
  }
  return s;
}

function normalizeDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  // Conservative: only convert DD/MM/YYYY when the day portion is > 12
  // (otherwise day/month order is ambiguous) and the date is otherwise valid.
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = Number(m[3]);
    if (d > 12 && d <= 31 && mo >= 1 && mo <= 12) {
      return `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  return value;
}

function normalizeValues(values, fields) {
  const byKey = {};
  for (const f of fields || []) byKey[f.key] = f;

  const out = {};
  for (const [k, raw] of Object.entries(values)) {
    let v = String(raw == null ? "" : raw).replace(/\s+/g, " ").trim();
    const field = byKey[k];
    const label = `${k} ${field?.label || ""}`;
    if (!v) {
      out[k] = v;
    } else if (/vehicle|vehicleno|truck|truckno|lorry/i.test(label)) {
      out[k] = normalizeVehicle(v);
    } else if (field?.type === "date" || /date/i.test(label)) {
      out[k] = normalizeDate(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function parseResponse(content, fields) {
  const cleaned = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned);

  const rawValues = {};
  if (parsed.values && typeof parsed.values === "object") {
    for (const [k, v] of Object.entries(parsed.values)) {
      rawValues[k] = v != null ? String(v).trim() : "";
    }
  }

  const confidence = {};
  if (parsed.confidence && typeof parsed.confidence === "object") {
    for (const [k, v] of Object.entries(parsed.confidence)) {
      const n = Number(v);
      confidence[k] = n >= 1 && n <= 3 ? n : 1;
    }
  }
  for (const k of Object.keys(rawValues)) {
    if (!(k in confidence)) confidence[k] = 1;
  }

  return { values: normalizeValues(rawValues, fields), confidence };
}

async function callModel(client, model, messages, opts = {}) {
  const params = {
    model,
    messages,
    temperature: 0.2,
    top_p: 0.9,
    max_tokens: opts.maxTokens || 2048,
    stream: false,
  };

  if (opts.enableThinking) {
    params.chat_template_kwargs = { enable_thinking: true };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const completion = await client.chat.completions.create(params, {
      signal: controller.signal,
    });
    return completion.choices[0]?.message?.content || "";
  } finally {
    clearTimeout(timeout);
  }
}

function buildMessages(docLabel, fields, text, image) {
  const { system, user } = buildPrompt(docLabel, fields, text);
  const systemMsg = { role: "system", content: system };
  if (image) {
    return [
      systemMsg,
      {
        role: "user",
        content: [
          { type: "text", text: user },
          { type: "image_url", image_url: { url: image } },
        ],
      },
    ];
  }
  return [systemMsg, { role: "user", content: user }];
}

export async function extractWithLLM({ text, docLabel, fields, image }) {
  const primaryKey = process.env.NVIDIA_API_KEY;
  const primaryModel = process.env.NVIDIA_MODEL || VISION_MODEL;
  const fallbackKey = process.env.NVIDIA_API_KEY_FALLBACK;
  const fallbackModel = process.env.NVIDIA_MODEL_FALLBACK || SUPER_MODEL;
  const fallbackKey2 = process.env.NVIDIA_API_KEY_FALLBACK2;
  const fallbackModel2 = process.env.NVIDIA_MODEL_FALLBACK2 || ULTRA_MODEL;

  if (!primaryKey && !fallbackKey && !fallbackKey2) {
    throw new Error("No NVIDIA API key configured.");
  }

  // Vision route (image input) — always try first when an image is available,
  // since a photo is the most reliable source of truth for a tilted document.
  if (image && primaryKey) {
    const messages = buildMessages(docLabel, fields, text, image);
    try {
      console.log(`[extract] calling ${primaryModel} (vision)...`);
      const content = await callModel(makeClient(primaryKey), primaryModel, messages, {
        maxTokens: 4096,
      });
      const result = parseResponse(content, fields);
      console.log(`[extract] ${primaryModel} vision returned ${Object.keys(result.values).length} fields`);
      return result;
    } catch (err) {
      console.error(`[extract] ${primaryModel} vision failed:`, err.message);
    }
  }

  // Text-only route — uses primary key (text on vision model) then fallbacks.
  const textMessages = buildMessages(docLabel, fields, text);

  const attempts = [
    primaryKey
      ? { key: primaryKey, model: primaryModel, enableThinking: false, maxTokens: 2048 }
      : null,
    fallbackKey
      ? { key: fallbackKey, model: fallbackModel, enableThinking: false, maxTokens: 2048 }
      : null,
    fallbackKey2
      ? { key: fallbackKey2, model: fallbackModel2, enableThinking: true, maxTokens: 2048 }
      : null,
  ].filter(Boolean);

  for (const attempt of attempts) {
    try {
      console.log(`[extract] calling ${attempt.model}...`);
      const content = await callModel(makeClient(attempt.key), attempt.model, textMessages, {
        enableThinking: attempt.enableThinking,
        maxTokens: attempt.maxTokens,
      });
      const result = parseResponse(content, fields);
      console.log(`[extract] ${attempt.model} returned ${Object.keys(result.values).length} fields`);
      return result;
    } catch (err) {
      console.error(`[extract] ${attempt.model} failed:`, err.message);
    }
  }

  throw new Error("All NVIDIA extraction attempts failed.");
}