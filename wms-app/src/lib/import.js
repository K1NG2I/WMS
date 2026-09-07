// Client-side document intelligence for the Import page.
//
// The OCR service (server/) returns raw text per page; detection + field
// mapping happen here so `STAGE_FIELDS` (in App.jsx) stays the single source
// of truth for what each form contains.

// Which document a scanned PDF is, plus where its record should live.
export const DOC_TYPES = [
  { key: "preGateInward", label: "Pre Gate Inward", tone: "inward", flow: "inward", stageIndex: 0, collection: "inward" },
  { key: "gateInward", label: "Gate Inward", tone: "inward", flow: "inward", stageIndex: 1, collection: "inward" },
  { key: "inward", label: "Inward", tone: "inward", flow: "inward", stageIndex: 2, collection: "inward" },
  { key: "checklistUnloading", label: "Checklist Unloading", tone: "inward", flow: "inward", stageIndex: 3, collection: "inward" },
  { key: "qualityCheck", label: "Quality Check", tone: "inward", flow: "inward", stageIndex: 4, collection: "inward" },
  { key: "goodReceiptNote", label: "Good Receipt Note", tone: "inward", flow: "inward", stageIndex: 5, collection: "inward" },
  { key: "pickList", label: "Pick List", tone: "outward", flow: "outward", stageIndex: 0, collection: "outward" },
  { key: "pick", label: "Pick", tone: "outward", flow: "outward", stageIndex: 1, collection: "outward" },
  { key: "qualityCheckOutward", label: "Quality Check Outward", tone: "outward", flow: "outward", stageIndex: 2, collection: "outward" },
  { key: "checklistLoading", label: "Checklist Loading", tone: "outward", flow: "outward", stageIndex: 3, collection: "outward" },
  { key: "dispatch", label: "Dispatch", tone: "outward", flow: "outward", stageIndex: 4, collection: "outward" },
  { key: "outward", label: "Outward", tone: "outward", flow: "outward", stageIndex: 5, collection: "outward" },
  { key: "bill", label: "Bill", tone: "simple", collection: "bills" },
  { key: "invoice", label: "Invoice", tone: "simple", collection: "invoices" },
  { key: "payment", label: "Payment", tone: "simple", collection: "payments" },
  { key: "labourAttendance", label: "Labour Attendance", tone: "simple", collection: "labourAttendance" },
  { key: "mheAttendance", label: "MHE Attendance", tone: "simple", collection: "mhe" },
];

// Keywords scored during detection. Exact label text gets the strongest boost.
const DOC_KEYWORDS = {
  preGateInward: ["pre gate", "pre-gate", "expected arrival", "arrival notice", "eta", "gate in"],
  gateInward: ["gate inward", "vehicle no", "vehicle number", "veh no", "lr no", "l r no", "eway", "e-way", "eway bill", "truck no", "driver"],
  inward: ["purchase order", "po reference", "po no", "consignor", "inward", "package count", "cartons"],
  checklistUnloading: ["checklist unloading", "checklist", "seal status", "dock bay", "unloading"],
  qualityCheck: ["quality check", "sample units", "sample inspected", "passed quantity", "pass qty", "defect", "reject"],
  goodReceiptNote: ["good receipt note", "grn", "received by", "putaway", "bin / rack", "warehouse officer"],
  pickList: ["pick list", "picking list", "pick request", "dispatch priority", "pick request id"],
  pick: ["picker", "qty picked", "quantity picked", "source bin", "bin tag"],
  qualityCheckOutward: ["quality check outward", "packaging integrity", "gross weight", "qc outward", "repack"],
  checklistLoading: ["checklist loading", "loading bay", "lashing", "strapping", "dispatch vehicle"],
  dispatch: ["dispatch", "lr number", "lr no", "transporter", "b/l", "bl no", "container seal", "logistics", "consignment note"],
  outward: ["gate out", "gate pass", "delivery ack", "outward", "delivery acknowledged"],
  bill: ["bill no", "billing", "raised against", "grand total", "bill amount"],
  invoice: ["invoice", "tax invoice", "gstin", "gst", "debit note", "sale"],
  payment: ["payment", "received", "upi", "cheque", "bank transfer", "reconcil", "credit note", "payment id"],
  labourAttendance: ["labour", "labor", "attendance", "worker", "shift", "contractor", "agency", "headcount"],
  mheAttendance: ["mhe", "forklift", "fork lift", "reach truck", "crane", "equipment", "battery", "operator", "maintenance"],
};

// Strong, targeted regexes tried first for well-known fields (OCR-resistant).
const SPECIAL_FIELD_PATTERNS = [
  {
    keys: ["vehicleNo"],
    label: "Vehicle Number",
    regex:
      /(?:vehicle|veh|truck|tempo|van|reg|registration|mh|ka|dl|gj|tn|up|ap|ts|wb|rj|hr|mp|pb|uk|br|od|kl)\s*(?:no\.?|number|reg\.?)?\s*[:.#-]?\s*([A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{1,4})/i,
  },
  {
    keys: ["gstin"],
    label: "GSTIN",
    regex: /(?:gst|gstin|gst no\.?)\s*[:#-]?\s*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]\d?Z\d?)/i,
  },
  {
    keys: ["ewayBill"],
    label: "E-Way Bill",
    regex: /(?:e[- ]?way|eway bill|lr no\.?|l\.?r\.?|b\/l|bl no\.?)\s*[:#\s-]*([A-Z0-9][A-Z0-9-/]{4,})/i,
  },
  {
    keys: ["expectedDate", "date", "expiryDate"],
    label: "Date",
    regex: /\b(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s?\d{2,4})\b/i,
  },
  {
    keys: ["amount"],
    label: "Amount",
    regex: /(?:₹|rs\.?\s?|inr\s?)?(\d[\d,]*\.?\d{0,2})(?=\s*(?:inr|rs\.?|₹|,|$))/i,
  },
  {
    keys: ["contact", "driverPhone"],
    label: "Contact / Phone",
    regex: /(?:\+91[\s-]?)?([6-9]\d[\s\d]{8,9})/,
  },
  {
    keys: ["boxCount"],
    label: "Package Count",
    regex: /(\d{1,4})\s*(?:cartons|boxes|pallets|packages|ctns|bxs|pkgs|units)/i,
  },
  {
    keys: ["hoursOrBattery"],
    label: "Hours / Battery",
    regex: /(\d+(?:\.\d+)?)\s*(?:hrs?|hours|%|percent)/i,
  },
  {
    keys: ["pickOrder", "pickRequestId", "poNumber", "lrNumber"],
    label: "Reference number",
    regex: /(?:pick request(?: id)?|po(?: no\.?)?|lr)(?:\s*[:#-]?\s*)([A-Z][A-Z0-9-/]+)/i,
  },
  {
    keys: ["grnCode"],
    label: "GRN code",
    regex: /(?:grn|good receipt)\s*(?:no\.?|code|serial)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9-/]{3,})/i,
  },
  {
    keys: ["gatePassNo"],
    label: "Gate Pass number",
    regex: /(?:gate\s?pass)\s*(?:no\.?|number)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9-/]{3,})/i,
  },
];

const STOP_WORDS = new Set([
  "status", "name", "number", "no", "id", "ref", "note", "code",
  "details", "value", "the", "a", "an", "and", "for", "of", "in",
]);

function anchorTokens(label) {
  return String(label)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function normalizeLine(line) {
  return String(line || "").replace(/\s+/g, " ").trim();
}

function isCodeLike(value) {
  return /[0-9]/.test(value) || (/[-/:]/.test(value) && value.length >= 4);
}

function trySpecial(fullText, field) {
  const lines = fullText
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  for (const pattern of SPECIAL_FIELD_PATTERNS) {
    if (!pattern.keys.includes(field.key)) continue;
    for (const raw of lines) {
      const found = pattern.regex.exec(raw);
      if (found && found[1]) {
        const value = found[1].trim();
        if (isCodeLike(value) && !/^\d+$/.test(value)) {
          return { value, confidence: 3 };
        }
      }
    }
  }
  return null;
}

function linesLookLikeValue(line) {
  const norm = normalizeLine(line);
  if (!norm || norm.length > 60) return false;
  if (/[:#]/.test(norm)) return false;
  if (/[0-9]/.test(norm)) return true;
  if (lineHasLabel(norm)) return false;
  return true;
}

// Is this line basically just a field label (nothing else)?
function lineHasLabel(norm) {
  const words = norm.split(/\s+/).filter(Boolean).length;
  if (words > 5) return false;
  const meaningful = anchorTokens(norm);
  return meaningful.length >= 2;
}

// Group label anchor sets so "Quality Check" doesn't collide with children.
function buildLabelIndex(fields) {
  return fields.map((field) => ({
    field,
    tokens: anchorTokens(field.label),
    normTokens: anchorTokens(field.label).sort().join(" "),
  }));
}

/**
 * Extract values for the given field definitions from OCR/interleaved text.
 * @returns {{ values: Record<string,string>, confidence: Record<string,number> }}
 */
export function extractFieldValues(fullText, fields = []) {
  const values = {};
  const confidence = {};
  const lines = fullText
    .split(/\n+/)
    .map(normalizeLine)
    .filter(Boolean);
  const index = buildLabelIndex(fields);

  // Pass 1: special regexes (vehicle, GSTIN, LR, amounts, ...)
  for (const field of fields) {
    const hit = trySpecial(fullText, field);
    if (hit) {
      values[field.key] = hit.value;
      confidence[field.key] = hit.confidence;
    }
  }

  // Pass 2: "Label: value" colon scan across lines. The text before the colon
  // must END with the field's full label, so a combined meta line like
  // "Customer / Vendor: X" can't hijack every adjacent single-label field.
  const colonLines = lines.filter((l) => l.includes(":"));
  for (const entry of index) {
    if (confidence[entry.field.key]) continue;
    let picked = null;
    for (const line of colonLines) {
      const colonIdx = line.indexOf(":");
      const pre = line.slice(0, colonIdx).toLowerCase().replace(/\s+/g, " ").trim();
      const expected = String(entry.field.label).toLowerCase().replace(/\s+/g, " ").trim();
      const post = line.slice(colonIdx + 1).trim();
      if (post && post.length <= 50 && pre.endsWith(expected)) {
        picked = post.replace(/^[:\-.]+\s*/, "").trim();
        confidence[entry.field.key] = 2;
        break;
      }
    }
    if (picked) values[entry.field.key] = picked;
  }

  // Pass 3: label-only line followed by a bare value line (our generated PDFs).
  const matchesLabelLine = (line, tokens) =>
    tokens.length >= 2 ? tokens.every((t) => line.includes(t)) : line.includes(tokens[0]);
  const lineIsOwnLabel = (line, tokens) => {
    if (/[0-9]|[₹\u20B9\-/]/.test(line)) return false;
    return line.split(/\s+/).filter(Boolean).length <= Math.max(2, tokens.length + 1) &&
      matchesLabelLine(line, tokens);
  };
  for (let i = 0; i < lines.length - 1; i++) {
    const norm = lines[i].toLowerCase();
    for (const entry of index) {
      if (confidence[entry.field.key]) continue;
      const tokensMatch = entry.tokens.every((t) => norm.includes(t));
      const nearMatch = entry.tokens.reduce((score, t) => score + (norm.includes(t) ? 1 : 0), 0);
      const floor = entry.tokens.length >= 2 ? Math.max(2, entry.tokens.length - 1) : 1;
      if (tokensMatch || nearMatch >= floor) {
        const next = lines[i + 1];
        const nextNorm = next.trim();
        const isOtherLabel = index.some(
          (e) => e !== entry && matchesLabelLine(next.toLowerCase(), e.tokens),
        );
        const isOwnLabel = lineIsOwnLabel(next.toLowerCase(), entry.tokens);
        if (
          nextNorm &&
          nextNorm.length <= 60 &&
          !/[:#]/.test(next) &&
          !isOwnLabel &&
          !isOtherLabel
        ) {
          values[entry.field.key] = nextNorm;
          confidence[entry.field.key] = 1;
          break;
        }
      }
    }
  }

  return { values, confidence };
}

/**
 * Rank the likely document type for OCR'd text.
 * @returns {Array<{key,label,score,matches}>} sorted best-first
 */
export function detectDocType(fullText) {
  const low = fullText.toLowerCase();
  const scored = DOC_TYPES.map((doc) => {
    let score = 0;
    if (low.includes(doc.label.toLowerCase())) score += 8;
    for (const keyword of DOC_KEYWORDS[doc.key] || []) {
      if (low.includes(keyword)) score += 2;
    }
    return { ...doc, score, matches: countMatches(low, DOC_KEYWORDS[doc.key] || []) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.filter((d) => d.score > 0);
}

function countMatches(lowText, keywords) {
  return keywords.reduce((total, k) => total + (lowText.includes(k) ? 1 : 0), 0);
}

// Collection each imported record should be appended to.
export function collectionForDocType(doc) {
  if (!doc) return null;
  if (doc.collection === "inward" || doc.collection === "outward") return doc.collection;
  return doc.collection || "outward";
}

// Human label for the "save to" bucket shown on the review screen.
export const COLLECTION_LABELS = {
  inward: "Inward flow records",
  outward: "Outward flow records",
  bills: "Bills",
  invoices: "Invoices",
  payments: "Payments",
  labourAttendance: "Labour attendance",
  mhe: "MHE log",
};

export const isWorkflowDoc = (doc) => doc.flow === "inward" || doc.flow === "outward";