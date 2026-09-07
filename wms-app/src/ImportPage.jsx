import React, { useMemo, useRef, useState } from "react";
import {
  FileUp,
  FileText,
  ScanLine,
  Download,
  Trash2,
  RotateCcw,
  Eye,
  Loader2,
  Check,
  AlertTriangle,
  FolderOpen,
  X,
  Save,
} from "lucide-react";
import {
  DOC_TYPES,
  detectDocType,
  extractFieldValues,
  COLLECTION_LABELS,
  isWorkflowDoc,
} from "./lib/import.js";
import { downloadFormPdf } from "./lib/pdf.js";

const TONE_COLORS = { inward: "#2F6FED", outward: "#7C3AED", simple: "#334155" };
const C = {
  border: "#E3E7EC",
  surface: "#F1F3F6",
  card: "#FFFFFF",
  text: "#171A21",
  muted: "#6B7280",
  faint: "#9AA1AC",
  primary: "#2F6FED",
  success: "#188A5A",
  danger: "#D23C3C",
};

const CONF_LABELS = { 3: "High", 2: "Medium", 1: "Low", 0: "Missing" };
const CONF_TONES = { 3: "#188A5A", 2: "#C2790A", 1: "#6B7280", 0: "#9AA1AC" };

let uid = 0;
const nextId = () => `imp-${++uid}`;

function Pill({ tone, children }) {
  const color = tone === "success" ? C.success : tone === "warn" ? "#C2790A" : C.faint;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase"
      style={{ background: `${color}1A`, color }}
    >
      {children}
    </span>
  );
}

function DocTypeSelect({ item, onChange }) {
  const selected = item.docKey;
  return (
    <select
      value={selected || ""}
      onChange={(e) => onChange(e.target.value)}
      style={{ borderColor: C.border, color: C.text }}
      className="w-full px-3 py-2 rounded-md border text-sm outline-none focus:ring-2 bg-white"
    >
      <option value="" disabled>
        Select document type…
      </option>
      {DOC_TYPES.map((doc) => (
        <option key={doc.key} value={doc.key}>
          {doc.label}
          {doc.flow ? ` · ${doc.flow === "inward" ? "Inward" : "Outward"} step ${(doc.stageIndex || 0) + 1}` : ""}
        </option>
      ))}
    </select>
  );
}

export default function ImportPage({ fieldsByLabel = {}, linkOptions = {}, onOpenForm, onSaveDirect, onCachePdf }) {
  const [items, setItems] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const inputRef = useRef(null);

  const patch = (id, partial) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...partial } : it)));

  // First-step documents never link; mid-flow documents default to the first
  // available consignment so they attach to its transaction tree on save
  // instead of silently becoming a standalone record with a fresh CN number.
  const defaultLinkFor = (doc) => {
    if (!doc || !isWorkflowDoc(doc) || (doc.stageIndex || 0) <= 0) return "";
    const opts = linkOptions[doc.flow] || [];
    return opts.length ? opts[0].rootId : "";
  };

  const ocrFile = async (file, itemId) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/import/ocr", { method: "POST", body: form });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Server responded ${res.status}`);
    }
    const payload = await res.json();

    const ranks = detectDocType(payload.fullText || "");
    const extraction = extractFieldValues(
      payload.fullText || "",
      fieldsByLabel[ranks[0]?.label] || [],
    );

    patch(itemId, {
      status: "done",
      pages: payload.pages || [],
      fullText: payload.fullText || "",
      detected: ranks[0],
      alternatives: ranks.slice(0, 4),
      docKey: ranks[0]?.key,
      fields: fieldsByLabel[ranks[0]?.label] || [],
      values: { ...(extraction.values || {}) },
      confidence: extraction.confidence || {},
      parentLink: defaultLinkFor(ranks[0] || null),
    });
  };

  const enqueueFiles = (fileList) => {
    const incoming = Array.from(fileList || []).filter((f) =>
      ["application/pdf", "image/png", "image/jpeg"].includes(f.type),
    );
    if (!incoming.length) return;
    const newItems = incoming.map((file) => ({
      id: nextId(),
      fileName: file.name,
      status: "queued",
      message: "",
      pages: [],
      fullText: "",
      detected: undefined,
      alternatives: [],
      docKey: "",
      fields: [],
      values: {},
      confidence: {},
      parentLink: "",
    }));
    setItems((prev) => [...newItems, ...prev]);
    setExpandedId(newItems[0].id);
    incoming.forEach((file, i) => {
      const itemId = newItems[i].id;
      (async () => {
        patch(itemId, { status: "ocr", message: "Sending to OCR service…" });
        try {
          await ocrFile(file, itemId);
        } catch (err) {
          patch(itemId, { status: "error", message: err.message || "OCR failed" });
        }
      })();
    });
  };

  const changeDocType = (itemId, key) => {
    const item = items.find((it) => it.id === itemId);
    const doc = DOC_TYPES.find((d) => d.key === key);
    if (!item || !doc) return;
    const fields = fieldsByLabel[doc.label] || [];
    const extraction = extractFieldValues(item.fullText || "", fields);
    const values = { ...extraction.values };
    // Preserve any manual edits for fields that still exist in the new type.
    fields.forEach((f) => {
      if (item.values[f.key] !== undefined && item.values[f.key] !== null && item.values[f.key] !== "") {
        values[f.key] = item.values[f.key];
      }
    });
    patch(itemId, { docKey: key, fields, values, confidence: extraction.confidence, parentLink: defaultLinkFor(doc) });
  };

  const setValue = (itemId, key, value) => {
    const item = items.find((it) => it.id === itemId);
    if (!item) return;
    patch(itemId, { values: { ...item.values, [key]: value } });
  };

  const remove = (id) => setItems((prev) => prev.filter((it) => it.id !== id));

  // After a document is saved, drop it from the queue and fall back to the
  // upload screen instead of re-displaying the stale review.
  const consume = (id) => {
    const remaining = items.filter((it) => it.id !== id);
    setItems(remaining);
    setExpandedId(remaining.length ? remaining[0].id : null);
  };

  const clear = (id) => {
    const item = items.find((it) => it.id === id);
    if (!item) return;
    const extraction = extractFieldValues(item.fullText || "", item.fields || []);
    patch(id, { values: { ...extraction.values }, confidence: extraction.confidence });
  };

  const active = items.find((it) => it.id === expandedId) || items[0] || null;

  const summary = useMemo(() => {
    const counts = DOC_TYPES.reduce((acc, d) => {
      acc[d.key] = { label: d.label, count: 0 };
      return acc;
    }, {});
    items.filter((it) => it.docKey).forEach((it) => {
      if (counts[it.docKey]) counts[it.docKey].count += 1;
    });
    return counts;
  }, [items]);

  const selectedDoc = active ? DOC_TYPES.find((d) => d.key === active.docKey) : null;
  const selectedFields = selectedDoc ? fieldsByLabel[selectedDoc.label] || [] : [];
  const tone = selectedDoc ? TONE_COLORS[selectedDoc.tone] : "#334155";
  // Mid-flow workflow documents (step 2+) can be attached to an existing
  // consignment so the saved record lands inside its transaction tree.
  const showLink =
    selectedDoc && isWorkflowDoc(selectedDoc) && (selectedDoc.stageIndex || 0) > 0;
  const linkCandidates = showLink ? (linkOptions[selectedDoc.flow] || []) : [];
  const setParentLink = (value) => patch(active.id, { parentLink: value });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 style={{ color: C.text }} className="text-lg sm:text-xl font-semibold">
            <ScanLine size={20} className="inline mr-1.5 mb-0.5" style={{ color: C.primary }} />
            Import from PDF / Scan
          </h2>
          <p style={{ color: C.muted }} className="text-xs sm:text-sm mt-1 max-w-2xl">
            Upload a scanned document or PDF. The OCR service reads the text,
            detects the document type, and pre-fills the matching form — review,
            then open the form or save straight to records.
          </p>
        </div>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          enqueueFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current && inputRef.current.click()}
        className="rounded-lg border-2 border-dashed px-5 py-10 flex flex-col items-center justify-center text-center cursor-pointer transition-colors"
        style={{ borderColor: dragging ? C.primary : C.border, background: dragging ? "#EEF4FF" : C.card }}
      >
        <FileUp size={34} style={{ color: C.primary }} />
        <p style={{ color: C.text }} className="text-sm font-semibold mt-3">
          Drop scanned PDFs here, or click to browse
        </p>
        <p style={{ color: C.faint }} className="text-xs mt-1">
          PDF, PNG or JPEG · multiple files supported
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          multiple
          className="hidden"
          onChange={(e) => {
            enqueueFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <div className="flex flex-col gap-4">
          {/* Import queue */}
          <div className="flex flex-col gap-2">
            {items.map((item) => {
              const doc = DOC_TYPES.find((d) => d.key === item.docKey);
              return (
                <div
                  key={item.id}
                  className="rounded-md border flex items-center gap-3 px-3 py-2.5"
                  style={{
                    borderColor: expandedId === item.id ? tone : C.border,
                    background: C.card,
                  }}
                >
                  {item.status === "queued" && <Pill tone="">Queued</Pill>}
                  {item.status === "ocr" && (
                    <Loader2 size={15} className="animate-spin" style={{ color: C.primary }} />
                  )}
                  {item.status === "done" && <Check size={15} style={{ color: C.success }} />}
                  {item.status === "error" && (
                    <AlertTriangle size={15} style={{ color: C.danger }} />
                  )}
                  <FileText size={15} style={{ color: item.status === "error" ? C.danger : doc ? TONE_COLORS[doc.tone] : C.faint }} />
                  <span className="text-xs font-medium truncate flex-1" style={{ color: C.text }}>
                    {item.fileName}
                  </span>
                  {item.status === "ocr" && (
                    <span style={{ color: C.muted }} className="text-[11px]">
                      Reading document…
                    </span>
                  )}
                  {item.status === "done" && doc && (
                    <>
                      <span
                        className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                        style={{
                          background: `${TONE_COLORS[doc.tone]}1A`,
                          color: TONE_COLORS[doc.tone],
                        }}
                      >
                        {doc.label}
                      </span>
                      <button
                        onClick={() => setExpandedId(item.id)}
                        style={{ color: C.primary, borderColor: C.border }}
                        className="px-2 py-1 rounded border text-[11px] font-medium flex items-center gap-1 hover:bg-gray-50"
                      >
                        <Eye size={12} /> Review
                      </button>
                    </>
                  )}
                  {item.status === "error" && (
                    <span style={{ color: C.danger }} className="text-[11px]">
                      {item.message}
                    </span>
                  )}
                  <button
                    onClick={() => remove(item.id)}
                    style={{ color: C.faint }}
                    className="p-1 rounded hover:bg-gray-100"
                    title="Remove"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Review panel for the active import */}
          {active && active.status === "done" && (
            <div
              className="rounded-md border overflow-hidden"
              style={{ borderColor: C.border, background: C.card }}
            >
              <div className="px-4 py-3 flex items-center justify-between" style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ color: C.muted }} className="text-[10px] font-semibold uppercase tracking-wider">
                    Document review · {active.fileName}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span style={{ background: `${tone}18`, color: tone }} className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                      {selectedDoc ? selectedDoc.label : "Unknown type"}
                    </span>
                    {active.detected && (
                      <span style={{ color: C.muted }} className="text-[11px]">
                        detected ~{active.detected.score} pts
                      </span>
                    )}
                    <span style={{ color: C.faint }} className="text-[11px]">
                      saves to: {selectedDoc ? (COLLECTION_LABELS[selectedDoc.collection] || selectedDoc.collection) : "—"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => clear(active.id)}
                    style={{ color: C.muted, borderColor: C.border }}
                    className="px-2.5 py-1.5 rounded-md border text-[11px] font-medium flex items-center gap-1 hover:bg-gray-50"
                  >
                    <RotateCcw size={12} /> Reset values
                  </button>
                  <button
                    onClick={() => remove(active.id)}
                    style={{ color: C.danger, borderColor: C.border }}
                    className="px-2.5 py-1.5 rounded-md border text-[11px] font-medium flex items-center gap-1 hover:bg-red-50"
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                </div>
              </div>

              {/* Detection alternatives + type picker */}
              <div className="p-4 border-b flex flex-col gap-3" style={{ borderColor: C.border }}>
                {active.alternatives.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {active.alternatives.map((alt) => {
                      const isActive = active.docKey === alt.key;
                      return (
                        <button
                          key={alt.key}
                          onClick={() => changeDocType(active.id, alt.key)}
                          className="text-[11px] font-medium px-2 py-1 rounded-full border"
                          style={{
                            borderColor: isActive ? TONE_COLORS[alt.tone] : C.border,
                            background: isActive ? `${TONE_COLORS[alt.tone]}14` : "transparent",
                            color: isActive ? TONE_COLORS[alt.tone] : C.muted,
                          }}
                        >
                          {alt.label}
                          {alt.score > 4 ? " · likely" : ""}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="max-w-md">
                  <DocTypeSelect item={active} onChange={(key) => changeDocType(active.id, key)} />
                </div>
              </div>

              {/* Link mid-flow document to an existing transaction */}
              {showLink && (
                <div className="p-4 border-b flex flex-col gap-2.5" style={{ borderColor: C.border }}>
                  <div style={{ color: C.muted }} className="text-[10px] font-semibold uppercase tracking-wider">
                    Link to transaction (step {(selectedDoc.stageIndex || 0) + 1} of the {selectedDoc.flow === "inward" ? "Inward" : "Outward"} flow)
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {linkCandidates.map((opt) => {
                      const isActive = active.parentLink === opt.rootId;
                      return (
                        <label
                          key={opt.rootId}
                          onClick={() => setParentLink(opt.rootId)}
                          className="rounded-md border px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-gray-50"
                          style={{
                            borderColor: isActive ? C.primary : C.border,
                            background: isActive ? `${C.primary}0D` : C.card,
                          }}
                        >
                          <input
                            type="radio"
                            name="parentLink"
                            checked={isActive}
                            onChange={() => setParentLink(opt.rootId)}
                            className="accent-[#2F6FED]"
                          />
                          <span className="flex-1 flex flex-col">
                            <span className="text-xs font-semibold" style={{ color: C.text }}>
                              {opt.rootId} · {opt.party}
                            </span>
                            <span className="text-[11px]" style={{ color: C.muted }}>
                              {opt.commonNumber} · {opt.progressStep}/6 {opt.deepestLabel}
                            </span>
                          </span>
                          <span className="text-[10px] uppercase font-bold" style={{ color: opt.flow === "inward" ? "#2F6FED" : "#7C3AED" }}>
                            {opt.flow === "inward" ? "Inward" : "Outward"}
                          </span>
                        </label>
                      );
                    })}
                    <label
                      onClick={() => setParentLink("")}
                      className="rounded-md border px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-gray-50"
                      style={{
                        borderColor: active.parentLink === "" ? C.primary : C.border,
                        background: active.parentLink === "" ? `${C.primary}0D` : C.card,
                      }}
                    >
                      <input
                        type="radio"
                        name="parentLink"
                        checked={active.parentLink === ""}
                        onChange={() => setParentLink("")}
                        className="accent-[#2F6FED]"
                      />
                      <span style={{ color: C.text }} className="text-xs font-medium">
                        Standalone — no consignment link
                      </span>
                    </label>
                  </div>
                  {linkCandidates.length === 0 && (
                    <p style={{ color: C.faint }} className="text-xs">
                      No existing {selectedDoc.flow} consignments to link to.
                    </p>
                  )}
                </div>
              )}

              {/* Field mapping table */}
              <div className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h5 style={{ color: C.text }} className="text-sm font-semibold">
                    {selectedDoc ? selectedDoc.label : "Select a document type"} fields
                  </h5>
                  <span style={{ color: C.muted }} className="text-xs">
                    {selectedFields.length} field{selectedFields.length === 1 ? "" : "s"} · OCR confidence in brackets
                  </span>
                </div>
                {selectedFields.length ? (
                  <div className="flex flex-col gap-2">
                    {selectedFields.map((field) => {
                      const conf = active.confidence[field.key] || 0;
                      const hasValue = (active.values[field.key] || "").trim() !== "";
                      return (
                        <div key={field.key} className="flex items-center gap-3">
                          <label style={{ color: C.muted }} className="w-40 sm:w-52 flex-shrink-0 text-xs font-medium truncate" title={field.label}>
                            {field.label}
                            <span className="ml-1 text-[10px] font-semibold" style={{ color: CONF_TONES[conf] || CONF_TONES[0] }}>
                              {CONF_LABELS[conf]}
                            </span>
                          </label>
                          <input
                            type={field.type === "date" ? "date" : "text"}
                            value={active.values[field.key] || ""}
                            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                            onChange={(e) => setValue(active.id, field.key, e.target.value)}
                            style={{
                              borderColor: hasValue ? `${tone}66` : C.border,
                              color: C.text,
                            }}
                            className="flex-1 px-3 py-2 rounded-md border text-sm outline-none focus:ring-2"
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ color: C.faint }} className="text-sm">
                    No field definitions for this type yet.
                  </p>
                )}

                {/* Raw text */}
                <details className="mt-1">
                  <summary style={{ color: C.primary }} className="text-xs font-medium cursor-pointer select-none">
                    View raw OCR text ({active.pages.length} page{active.pages.length === 1 ? "" : "s"})
                  </summary>
                  <pre
                    className="mt-2 rounded-md border p-3 text-[11px] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto"
                    style={{ borderColor: C.border, background: C.surface, color: C.muted, fontFamily: "ui-monospace, monospace" }}
                  >
                    {active.fullText || "No text extracted."}
                  </pre>
                </details>
              </div>

              {/* Actions */}
              <div className="px-4 py-3 flex items-center justify-end gap-2 flex-wrap" style={{ borderTop: `1px solid ${C.border}`, background: C.surface }}>
                <button
                  onClick={() =>
                    selectedDoc &&
                    downloadFormPdf({
                      title: selectedDoc.label,
                      tone,
                      docId: active.values[selectedFields[0]?.key] || "IMPORT",
                      fields: selectedFields,
                      values: active.values,
                      meta: { Source: active.fileName, Status: "Imported" },
                      onGenerated: (blob, args) => onCachePdf && onCachePdf(blob, args),
                    })
                  }
                  style={{ color: C.muted, borderColor: C.border }}
                  className="px-3 py-2 rounded-md border text-xs font-medium flex items-center gap-1.5 hover:bg-gray-50"
                >
                  <Download size={13} /> Download PDF
                </button>
                <button
                  onClick={() => {
                    if (!selectedDoc) return;
                    const link = linkCandidates.some(
                      (o) => o.rootId === active.parentLink,
                    )
                      ? active.parentLink
                      : "";
                    onSaveDirect(selectedDoc, active.values, link);
                    consume(active.id);
                  }}
                  style={{ color: C.primary, borderColor: C.primary }}
                  className="px-3 py-2 rounded-md border text-xs font-semibold flex items-center gap-1.5 hover:opacity-80"
                >
                  <Save size={13} /> Save record
                </button>
                <button
                  onClick={() => {
                    if (!selectedDoc) return;
                    onOpenForm(selectedDoc, active.values, active.parentLink || "");
                  }}
                  style={{ background: tone }}
                  className="px-3.5 py-2 rounded-md text-xs font-semibold text-white flex items-center gap-1.5 hover:opacity-90"
                >
                  <FolderOpen size={13} /> Open {selectedDoc ? selectedDoc.label : "form"}
                </button>
              </div>
            </div>
          )}

          {/* Imported doc-type summary */}
          <div className="flex flex-wrap gap-1.5">
            {Object.values(summary)
              .filter((s) => s.count > 0)
              .map((s) => (
                <span key={s.label} className="text-[11px] px-2 py-1 rounded-full" style={{ background: `${C.primary}14`, color: C.primary }}>
                  {s.label} × {s.count}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}