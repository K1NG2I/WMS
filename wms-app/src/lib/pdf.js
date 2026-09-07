import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";

// Convert a JS string to an RGBA triplet usable by jsPDF.
function rgb(hex, alpha = 1) {
  const value = String(hex || "#334155").replace("#", "");
  const full =
    value.length === 3
      ? value.split("").map((c) => c + c).join("")
      : value;
  const int = parseInt(full, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return alpha === 1 ? [r, g, b] : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function qrDataUrl(text, size = 220) {
  return QRCode.toDataURL(String(text).slice(0, 500), {
    width: size,
    margin: 1,
    color: { dark: "#14181F", light: "#FFFFFF" },
  });
}

function barcodeDataUrl(value, height = 60) {
  try {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svg, String(value), {
      format: "CODE128",
      displayValue: true,
      height,
      width: 2,
      margin: 4,
      fontSize: 14,
    });
    const str = new XMLSerializer().serializeToString(svg);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 420;
        canvas.height = Math.round((420 / img.width) * img.height) || img.height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve("");
      img.src =
        "data:image/svg+xml;charset=utf-8," + encodeURIComponent(str);
    });
  } catch {
    return Promise.resolve("");
  }
}

function wrappedText(doc, text, x, y, maxWidth) {
  const lines = [];
  const words = String(text).split(/\s+/).filter(Boolean);
  let current = "";
  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word;
    if (doc.getTextWidth(attempt) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = attempt;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Draw a label/value row. Empty values render as an underline so the same
// generator produces both "filled" and "blank printable" documents.
function drawFieldRow(doc, { label, value, x, y, labelWidth, valueWidth, rowH }) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...rgb("#6B7280"));
  const labelLines = wrappedText(doc, label, x, y, labelWidth);
  doc.text(labelLines, x, y);
  const valueText =
    value !== undefined && value !== null && String(value).trim() !== ""
      ? String(value)
      : " ";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...rgb("#171A21"));
  const vx = x + labelWidth + 4;
  doc.text(String(valueText), vx, y, { maxWidth: valueWidth - 4 });
  if (!valueText.trim()) {
    doc.setDrawColor(210, 214, 220);
    doc.setLineWidth(0.3);
    doc.line(vx, y + 3, vx + valueWidth - 4, y + 3);
  }
  doc.setDrawColor(225, 228, 233);
  doc.setLineWidth(0.2);
  doc.line(vx, y + rowH - 4, vx + valueWidth - 4, y + rowH - 4);
  return y + rowH;
}

/**
 * Generate a printable A4 PDF for any WMS form.
 * @param {object} args
 * @param {string} args.title  Form / stage label (e.g. "Good Receipt Note")
 * @param {string} args.tone   hex accent color ("#2F6FED" / "#7C3AED" / "#334155")
 * @param {string} args.docId  Document number (e.g. "GRN-188")
 * @param {object} args.values Field key -> value map
 * @param {Array}  args.fields Field definitions [{key,label,placeholder}]
 * @param {object} [args.meta] Additional lines to show under the doc id
 */
export async function generateFormPdf({
  title,
  tone = "#334155",
  docId,
  values = {},
  fields = [],
  meta = {},
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 14;
  const contentWidth = W - M * 2;

  // Header band
  doc.setFillColor(...rgb(tone));
  doc.rect(0, 0, W, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("WMS — Warehouse Management System", M, 10);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Goods Inward / Outward Documentation Record", M, 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(String(title || "Form"), M, 23);

  doc.setFillColor(255, 255, 255);
  doc.rect(W - M - 52, 8, 52, 12, "F");
  doc.setTextColor(...rgb(tone));
  doc.setFontSize(7);
  doc.text("DOCUMENT NO.", W - M - 47, 12);
  doc.setFontSize(12);
  doc.text(String(docId || "—"), W - M - 47, 18);

  let y = 40;

  // Meta block (party / ref snipets, e.g. customer, vehicle)
  const metaRows = Object.entries(meta || {}).filter(
    ([, value]) => value !== undefined && value !== null && String(value).trim() !== "",
  );
  if (metaRows.length) {
    doc.setDrawColor(225, 228, 233);
    doc.setLineWidth(0.2);
    doc.roundedRect(M, y - 5, contentWidth, metaRows.length * 8 + 6, 1.5, 1.5);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...rgb("#6B7280"));
    doc.text("PARTY / REFERENCE", M + 4, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...rgb("#171A21"));
    let my = y + 5;
    for (const [key, value] of metaRows) {
      doc.text(`${String(key)}:`, M + 4, my);
      doc.text(String(value), M + 34, my);
      my += 8;
    }
    y = my + 6;
  }

  // Fields section
  let rowH = 9;
  let fy = y;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...rgb("#9AA1AC"));
  doc.text("FIELD", M, fy);
  doc.text("VALUE", M + 62, fy);
  fy += 3;
  doc.setDrawColor(...rgb(tone));
  doc.setLineWidth(0.6);
  doc.line(M, fy, W - M, fy);
  fy += 4;

  const list = fields && fields.length ? fields : [];
  const labelCol = 52;
  for (const field of list) {
    if (fy + rowH > 272) {
      doc.addPage();
      fy = 18;
    }
    fy = drawFieldRow(doc, {
      label: field.label,
      value: values[field.key],
      x: M,
      y: fy,
      labelWidth: labelCol,
      valueWidth: contentWidth - labelCol,
      rowH,
    });
  }

  if (!list.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...rgb("#9AA1AC"));
    doc.text("No fields defined for this form type.", M, fy + 4);
    fy += 14;
  }

  // Signature block
  if (fy + 28 > 272) {
    doc.addPage();
    fy = 30;
  }
  const sigY = fy + 18;
  doc.setDrawColor(190, 196, 204);
  doc.setLineWidth(0.3);
  doc.line(M, sigY - 2, M + 52, sigY - 2);
  doc.line(W - M - 52, sigY - 2, W - M, sigY - 2);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...rgb("#6B7280"));
  doc.text("Prepared / Checked By", M, sigY + 3);
  doc.text("Authorized Signatory", W - M - 52, sigY + 3);

  // Footer + barcode + QR
  const footerY = 286;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...rgb("#9AA1AC"));
  doc.text(
    `Generated ${new Date().toLocaleString()}  ·  WMS Prototype`,
    M,
    footerY,
  );

  const barcode = await barcodeDataUrl(docId || title || "WMS");
  const qr = await qrDataUrl(
    [docId, title, ...Object.entries(meta).map(([k, v]) => `${k}: ${v}`)].join("\n"),
    220,
  );
  if (qr) {
    try {
      doc.addImage(qr, "PNG", W - M - 34, footerY - 30, 30, 30);
    } catch {
      /* ignore */
    }
  }
  if (barcode) {
    try {
      doc.addImage(barcode, "PNG", M, footerY + 5, 62, 13);
    } catch {
      /* ignore */
    }
  }

  return doc.output("blob");
}

export async function downloadFormPdf({ title, tone, docId, values, fields, meta, onGenerated }) {
  let blob;
  try {
    blob = await generateFormPdf({ title, tone, docId, values, fields, meta });
  } catch (err) {
    console.error("PDF generation failed", err);
    return false;
  }
  if (typeof onGenerated === "function") {
    try {
      onGenerated(blob, { title, tone, docId, values, fields, meta });
    } catch (err) {
      console.error("PDF post-generation hook failed", err);
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${String(title || "form").replace(/[^\w-]+/g, "_")}-${String(docId || "doc").replace(/[^\w-]+/g, "_")}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}