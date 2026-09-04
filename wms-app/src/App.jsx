import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  LayoutDashboard,
  Database,
  ArrowLeftRight,
  Wallet,
  Radar,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Bell,
  Plus,
  Truck,
  ClipboardList,
  ClipboardCheck,
  FileCheck,
  PackageCheck,
  User,
  Warehouse,
  Minus,
  X,
  Copy,
  Camera,
  Users,
  Wrench,
  Menu,
  Trash2,
  RotateCcw,
  Eye,
  Download,
  QrCode,
  Barcode,
  BarChart3,
  FileText,
  ExternalLink,
} from "lucide-react";
import initialAppData from "./data/appData.json";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";

function qrUrl(text, size = 160) {
  try {
    return QRCode.toDataURL(String(text).slice(0, 500), {
      width: size,
      margin: 1,
      color: { dark: "#14181F", light: "#FFFFFF" },
    });
  } catch (e) {
    return Promise.resolve("");
  }
}
function QrImg({ text, size = 100 }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let live = true;
    qrUrl(text, size).then((u) => live && setSrc(u));
    return () => (live = false);
  }, [text, size]);
  return src ? (
    <img src={src} alt="QR" width={size} height={size} />
  ) : (
    <div
      style={{ width: size, height: size, border: `1px dashed ${c.border}` }}
      className="flex items-center justify-center text-[10px]"
    >
      <span style={{ color: c.faint }}>QR</span>
    </div>
  );
}

const SCAN_STATE = { IDLE: 0, RUNNING: 1, ERROR: 2 };function BarcodeView({ value, height = 60, width = 220, filename }) {
  const [svgUrl, setSvgUrl] = useState("");
  const buildSvg = () => {
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
      const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(str);
      setSvgUrl(url);
      return str;
    } catch (e) {
      return "";
    }
  };

  useEffect(() => {
    buildSvg();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, height]);

  const downloadPng = () => {
    const str = buildSvg();
    if (!str) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = Math.round((width / img.width) * img.height) || img.height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `${filename || "barcode"}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(str);
  };

  return (
    <div className="inline-flex flex-col items-center gap-1">
      {svgUrl ? (
        <img src={svgUrl} alt="barcode" width={width} style={{ background: "#fff" }} />
      ) : (
        <div
          style={{ width, height, border: `1px dashed ${c.border}` }}
          className="flex items-center justify-center text-[10px]"
        >
          <span style={{ color: c.faint }}>Barcode</span>
        </div>
      )}
      <button
        type="button"
        onClick={downloadPng}
        style={{ color: c.primary }}
        className="text-xs font-medium hover:underline flex items-center gap-1"
        title="Download PNG"
      >
        <Download size={14} /> Download
      </button>
    </div>
  );
}

function canScan() {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}
function useScanner() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState(SCAN_STATE.IDLE);
  const [error, setError] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const cbRef = useRef(null);
  const rafRef = useRef(null);

  const stop = () => {
    try {
      streamRef.current &&
        streamRef.current.getTracks().forEach((t) => t.stop());
    } catch (e) {}
    streamRef.current = null;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setState(SCAN_STATE.IDLE);
  };

  const openScanner = (onScan) => {
    if (!canScan()) {
      setError(
        "QR scanner not supported in this browser. Use Chrome/Edge (desktop) with a camera, or Chrome on Android.",
      );
      setOpen(true);
      setState(SCAN_STATE.ERROR);
      return;
    }
    cbRef.current = onScan;
    setOpen(true);
    setState(SCAN_STATE.RUNNING);
  };

  const buildDetector = async () => {
    try {
      const fmt = ["qr_code"];
      detectorRef.current = new BarcodeDetector({ formats: fmt });
      return true;
    } catch (e) {
      try {
        detectorRef.current = new BarcodeDetector();
        return true;
      } catch (e2) {
        return false;
      }
    }
  };

  const tick = async () => {
    if (!videoRef.current) return;
    if (videoRef.current.readyState >= 2 && detectorRef.current) {
      try {
        const codes = await detectorRef.current.detect(videoRef.current);
        if (codes && codes.length && codes[0].rawValue) {
          const text = String(codes[0].rawValue).trim();
          stop();
          setOpen(false);
          if (cbRef.current) cbRef.current(text);
          return;
        }
      } catch (e) {}
    }
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    if (!open || state !== SCAN_STATE.RUNNING) return;
    let cancelled = false;
    (async () => {
      const ok = await buildDetector();
      if (cancelled) return;
      if (!ok) {
        setState(SCAN_STATE.ERROR);
        setError("Could not initialize the QR detector in this browser.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        if (cancelled) return;
        setState(SCAN_STATE.ERROR);
        setError("Camera access denied or unavailable. Allow camera permission and retry.");
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, state]);

  const modal = open ? (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
      onClick={() => {
        stop();
        setOpen(false);
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#0F1218", border: "1px solid #2A3040" }}
        className="w-full max-w-sm rounded-xl overflow-hidden shadow-2xl"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <span style={{ color: "#E5E7EB" }} className="text-sm font-semibold">
            Scan QR Code
          </span>
          <button
            onClick={() => {
              stop();
              setOpen(false);
            }}
            className="text-gray-400 hover:text-white p-1 rounded"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-4 pb-4">
          {state === SCAN_STATE.RUNNING ? (
            <div className="relative rounded-lg overflow-hidden bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                style={{ width: "100%", height: 220, objectFit: "cover" }}
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  style={{ boxShadow: "0 0 0 2000px rgba(0,0,0,0.35)" }}
                  className="w-52 h-16 rounded-sm border-2 border-white/80"
                />
              </div>
              <div className="absolute bottom-2 left-0 right-0 text-center text-xs text-white/80 tracking-wide">
                Point camera at a QR code…
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <Camera size={28} style={{ color: "#EF4444" }} className="mx-auto mb-3" />
              <p style={{ color: "#E5E7EB" }} className="text-sm px-4">
                {error}
              </p>
              <button
                onClick={() => setState(SCAN_STATE.RUNNING)}
                className="mt-4 px-4 py-2 rounded-md text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return { openScanner, modal };
}

function ScanInput({ value, onValue, size = 16, title = "Scan QR with camera", allowSet = true }) {
  const { openScanner, modal } = useScanner();
  return (
    <span className="inline-flex items-center">
      <button
        type="button"
        onClick={() => openScanner((text) => allowSet && onValue(text))}
        title={title}
        className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors"
      >
        <Camera size={size} />
      </button>
      {modal}
    </span>
  );
}

const c = {
  ink: "#14181F",
  inkSoft: "#1D222B",
  inkLine: "#2A3040",
  surface: "#F1F3F6",
  card: "#FFFFFF",
  border: "#E3E7EC",
  text: "#171A21",
  muted: "#6B7280",
  faint: "#9AA1AC",
  primary: "#2F6FED",
  primarySoft: "#E8EFFE",
  success: "#188A5A",
  successSoft: "#E4F5EC",
  warning: "#C2790A",
  warningSoft: "#FBEEDD",
  danger: "#D23C3C",
  dangerSoft: "#FBE7E7",
};

const FLOW_COLORS = {
  inward: "#2F6FED",
  outward: "#7C3AED",
  simple: "#334155",
};

const INWARD_STAGES = [
  "Pre Gate Inward",
  "Gate Inward",
  "Inward",
  "Checklist Unloading",
  "Quality Check",
  "Good Receipt Note",
];
const OUTWARD_STAGES = [
  "Pick List",
  "Pick",
  "Quality Check Outward",
  "Checklist Loading",
  "Dispatch",
  "Outward",
];

function getStepDocNo(baseId, tone, stageIndex) {
  if (!baseId) return "";
  if (tone === "inward") {
    const prefixes = ["PR", "GT", "IN", "CL", "QC", "GRN"];
    return `${prefixes[stageIndex] || "DOC"}-${baseId}`;
  } else if (tone === "outward") {
    const prefixes = ["PK-LST", "PK", "QC-OUT", "CL-LD", "DSP", "OUT-DSP"];
    return `${prefixes[stageIndex] || "DOC"}-${baseId}`;
  }
  return `DOC-${baseId}`;
}

// Prefix used by a stage in the hierarchy (1-indexed via stage index).
const IN_PREFIXES = ["PR", "GT", "IN", "CL", "QC", "GRN"];
const OUT_PREFIXES = ["PK-LST", "PK", "QC-OUT", "CL-LD", "DSP", "OUT-DSP"];

// Build a child's short document ID: {prefix}-{uniqueNumber}. The tree link is
// kept separately via parentId/rootId, NOT embedded in the ID.
function childHierarchyId(childPrefix, uniqueNumber) {
  return `${childPrefix}-${uniqueNumber}`;
}

// Stage type keys inside appData match these lists (1-indexed)
const IN_TYPE_KEYS = ["preGateInward", "gateInward", "inward", "checklistUnloading", "qualityCheck", "goodReceiptNote"];
const OUT_TYPE_KEYS = ["pickList", "pick", "qualityCheckOutward", "checklistLoading", "dispatch", "outward"];

// 1-indexed stage metadata (key + label + display name) for deriving rows from consignments
const IN_STAGE_META = [
  { key: "preGateInward", label: "Pre Gate Inward" },
  { key: "gateInward", label: "Gate Inward" },
  { key: "inward", label: "Inward" },
  { key: "checklistUnloading", label: "Checklist Unloading" },
  { key: "qualityCheck", label: "Quality Check" },
  { key: "goodReceiptNote", label: "Good Receipt Note" },
];
const OUT_STAGE_META = [
  { key: "pickList", label: "Pick List" },
  { key: "pick", label: "Pick" },
  { key: "qualityCheckOutward", label: "Quality Check Outward" },
  { key: "checklistLoading", label: "Checklist Loading" },
  { key: "dispatch", label: "Dispatch" },
  { key: "outward", label: "Outward" },
];

function primaryForStep(step) {
  // Simple deterministic tone for the current step of a consignment
  const tones = ["primary", "warning", "danger", "muted"];
  return tones[(step - 1) % tones.length];
}

const STAGE_FIELDS = {
  "Pre Gate Inward": [
    {
      key: "customer",
      label: "Customer Name",
      placeholder: "e.g. Nimbus Retail Pvt Ltd",
    },
    {
      key: "vendor",
      label: "Vendor / Consignor",
      placeholder: "e.g. Aravali Foods Ltd.",
    },
    {
      key: "expectedDate",
      label: "Expected Arrival Date",
      placeholder: "e.g. 2026-09-05",
    },
  ],
  "Gate Inward": [
    {
      key: "vehicleNo",
      label: "Vehicle Number",
      placeholder: "e.g. MH12 AB 1234",
    },
    {
      key: "driverName",
      label: "Driver Name & Phone",
      placeholder: "e.g. Rajesh Kumar (+91 98220...)",
    },
    {
      key: "ewayBill",
      label: "E-Way Bill / LR No.",
      placeholder: "e.g. EWB-99182371",
    },
  ],
  Inward: [
    {
      key: "vendor",
      label: "Vendor / Consignor",
      placeholder: "e.g. Aravali Foods Ltd.",
    },
    {
      key: "poNumber",
      label: "PO Reference Number",
      placeholder: "e.g. PO-2026-8841",
    },
    {
      key: "boxCount",
      label: "Total Package Count",
      placeholder: "e.g. 150 Cartons / 4 Pallets",
    },
  ],
  "Checklist Unloading": [
    {
      key: "sealStatus",
      label: "Container Seal Status",
      placeholder: "Intact / Broken / Re-sealed",
    },
    {
      key: "dockNo",
      label: "Unloading Dock Bay",
      placeholder: "Bay 4 - North Bay",
    },
    {
      key: "unloadingSupervisor",
      label: "Unloading Supervisor",
      placeholder: "Supervisor Name",
    },
  ],
  "Quality Check": [
    {
      key: "sampleTested",
      label: "Sample Units Inspected",
      placeholder: "e.g. 25 Units",
    },
    { key: "passQty", label: "Passed Quantity", placeholder: "e.g. 145 Units" },
    {
      key: "rejectReason",
      label: "Defect / Damage Notes",
      placeholder: "e.g. 5 boxes corner crushed",
    },
  ],
  "Good Receipt Note": [
    { key: "grnCode", label: "GRN Serial Code", placeholder: "Auto GRN-3021" },
    {
      key: "putawayZone",
      label: "Target Bin / Rack Location",
      type: "select",
      placeholder: "Scan a bin QR or choose a bin",
    },
    {
      key: "receivedBy",
      label: "Warehouse Officer Sign-off",
      placeholder: "Officer Name",
    },
  ],
  "Pick List": [
    {
      key: "pickOrder",
      label: "Pick Request ID",
      placeholder: "e.g. PK-2026-091",
    },
    {
      key: "customer",
      label: "Customer Name",
      placeholder: "e.g. Nimbus Retail Pvt Ltd",
    },
    {
      key: "priority",
      label: "Dispatch Priority",
      placeholder: "High / Normal / Express",
    },
  ],
  Pick: [
    {
      key: "pickerName",
      label: "Assigned Picker",
      placeholder: "Picker ID / Name",
    },
    {
      key: "pickedQty",
      label: "Quantity Picked",
      placeholder: "e.g. 80 Cartons",
    },
    { key: "sourceBin", label: "Source Bin Tag", placeholder: "Bin B-11-02" },
  ],
  "Quality Check Outward": [
    {
      key: "outwardQcStatus",
      label: "Packaging Integrity Check",
      placeholder: "Passed / Re-pack Required",
    },
    {
      key: "verifiedWeight",
      label: "Gross Weight (Kg)",
      placeholder: "e.g. 540.2 Kg",
    },
    {
      key: "qcInspector",
      label: "Outward QC Officer",
      placeholder: "Inspector Badge ID",
    },
  ],
  "Checklist Loading": [
    {
      key: "loadingBay",
      label: "Loading Dock Bay",
      placeholder: "Bay 2 - Main Gate",
    },
    {
      key: "truckNo",
      label: "Assigned Dispatch Vehicle",
      placeholder: "e.g. MH14 GH 2290",
    },
    {
      key: "lashingStatus",
      label: "Cargo Strapping & Lashing",
      placeholder: "Secured & Verified",
    },
  ],
  Dispatch: [
    {
      key: "lrNumber",
      label: "Transporter LR / B/L No.",
      placeholder: "e.g. VRL-9901",
    },
    {
      key: "transporter",
      label: "Logistics Vendor",
      placeholder: "e.g. Gati KWE / Spot Fleet",
    },
    {
      key: "containerSeal",
      label: "Container Outward Seal No.",
      placeholder: "SEAL-88192",
    },
  ],
  Outward: [
    {
      key: "gateOutTime",
      label: "Gate Out Time",
      placeholder: "e.g. 11:45 AM",
    },
    { key: "gatePassNo", label: "Gate Pass No.", placeholder: "GP-2026-88" },
    {
      key: "deliveryAck",
      label: "Delivery Ack Copy",
      placeholder: "Signed & Uploaded",
    },
  ],
  "Labour Attendance": [
    {
      key: "workerName",
      label: "Worker / Labour Name",
      placeholder: "e.g. Ramesh Patil",
    },
    {
      key: "agency",
      label: "Vendor / Contractor Agency",
      placeholder: "e.g. Apex Manpower Services",
    },
    {
      key: "shift",
      label: "Assigned Shift",
      placeholder: "Morning (08:00 AM - 04:00 PM)",
    },
    {
      key: "status",
      label: "Attendance Status",
      placeholder: "Present / Overtime / Absent",
    },
  ],
  "MHE Attendance": [
    {
      key: "equipmentCode",
      label: "Equipment ID & Model",
      placeholder: "e.g. FL-03 (3 Ton Electric Forklift)",
    },
    {
      key: "operator",
      label: "Assigned Operator",
      placeholder: "e.g. Suresh Shinde",
    },
    {
      key: "hoursOrBattery",
      label: "Logged Operating Hours / Battery %",
      placeholder: "e.g. 7.5 Hrs · 90% Charge",
    },
    {
      key: "condition",
      label: "Maintenance / Health Status",
      placeholder: "Operational / Needs Maintenance",
    },
  ],
  "Bill": [
    { key: "date", label: "Date", type: "date", placeholder: "Select date" },
    { key: "amount", label: "Amount", placeholder: "e.g. ₹18,400" },
    { key: "flow", label: "Inward / Outward", placeholder: "Inward or Outward" },
    { key: "customer", label: "Customer Name", placeholder: "e.g. Nimbus Retail Pvt Ltd" },
  ],
};

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    id: "masters",
    label: "Masters",
    icon: Database,
    children: [
      { id: "masters-customers", label: "Customers" },
      { id: "masters-products", label: "Products" },
      { id: "masters-vendors", label: "Vendors" },
      { id: "masters-locations", label: "Bin Locations" },
      { id: "masters-users", label: "Users" },
    ],
  },
  {
    id: "transactions",
    label: "Transactions",
    icon: ArrowLeftRight,
    children: [
      { id: "txn-inward", label: "Inward" },
      { id: "txn-outward", label: "Outward" },
      { id: "txn-billing", label: "Billing" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    icon: Wallet,
    children: [
      { id: "fin-invoices", label: "Invoices" },
      { id: "fin-payments", label: "Payments" },
    ],
  },
  { id: "attendance", label: "Attendance & MHE", icon: Users },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "tracktrace", label: "Track & Trace", icon: Radar },
  { id: "recyclebin", label: "Recycle Bin", icon: Trash2 },
];

const PAGE_TITLES = {
  dashboard: ["Dashboard", null],
  "masters-customers": ["Masters", "Customers"],
  "masters-products": ["Masters", "Products"],
  "masters-vendors": ["Masters", "Vendors"],
  "masters-locations": ["Masters", "Bin Locations"],
  "masters-users": ["Masters", "Users"],
  "txn-inward": ["Transactions", "Inward"],
  "txn-outward": ["Transactions", "Outward"],
  "txn-billing": ["Transactions", "Billing"],
  "fin-invoices": ["Finance", "Invoices"],
  "fin-payments": ["Finance", "Payments"],
  attendance: ["Operations", "Attendance & MHE Log"],
  reports: ["Reports", null],
  tracktrace: ["Track & Trace", null],
  recyclebin: ["Recycle Bin", null],
};

function genBaseDoc() {
  return `${Math.floor(1000 + Math.random() * 9000)}`;
}

function Pill({ tone = "muted", children }) {
  const tones = {
    success: { bg: c.successSoft, fg: c.success },
    warning: { bg: c.warningSoft, fg: c.warning },
    danger: { bg: c.dangerSoft, fg: c.danger },
    primary: { bg: c.primarySoft, fg: c.primary },
    muted: { bg: c.surface, fg: c.muted },
  };
  const t = tones[tone] || tones.muted;
  return (
    <span
      style={{ background: t.bg, color: t.fg }}
      className="px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap"
    >
      {children}
    </span>
  );
}

function StatCard({ label, value, sub, tone = "primary", tooltip = [], onClick }) {
  const tones = {
    primary: c.primary,
    warning: c.warning,
    success: c.success,
    danger: c.danger,
  };
  const inner = (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
      style={{
        background: c.card,
        border: `1px solid ${c.border}`,
        cursor: onClick ? "pointer" : "default",
      }}
      className="rounded-md p-4 sm:p-5 flex flex-col gap-2 transition-all hover:shadow-md"
    >
      <span style={{ color: c.muted }} className="text-xs sm:text-sm flex items-center justify-between gap-2">
        {label}
        {onClick && <ExternalLink size={13} style={{ color: c.faint }} />}
      </span>
      <span
        style={{ color: c.text }}
        className="text-2xl sm:text-3xl font-semibold"
      >
        {value}
      </span>
      <div className="flex items-center gap-2">
        <div
          style={{ background: c.surface }}
          className="h-1.5 flex-1 rounded-full overflow-hidden"
        >
          <div
            style={{ background: tones[tone], width: sub.pct + "%" }}
            className="h-full rounded-full"
          />
        </div>
        <span
          style={{ color: c.faint }}
          className="text-[11px] sm:text-xs font-medium"
        >
          {sub.text}
        </span>
      </div>
    </div>
  );
  return (
    <div className="relative group">
      {inner}
      {tooltip.length > 0 && (
        <div
          style={{
            background: "#1F2937",
            color: "#F9FAFB",
            border: "1px solid #374151",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          }}
          className="absolute z-30 hidden group-hover:block w-56 pointer-events-none rounded-lg p-3 text-xs translate-x-0 -translate-y-full mt-0 left-0 top-0 -ml-1"
        >
          <div className="font-semibold mb-2">{label} — details</div>
          <div className="flex flex-col gap-1.5">
            {tooltip.map(([k, v, color]) => (
              <div
                key={k}
                className="flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-1.5 capitalize">
                  <span
                    style={{ background: color, display: "inline-block" }}
                    className="w-2.5 h-2.5 rounded-sm"
                  />
                  {k}
                </span>
                <span className="font-semibold">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


function BinMap({ bins, onSelectCell }) {
  const { cols, rows, cells } = bins;
  const colorFor = {
    expired: "#000000", // black
    "near expiry": "#D23C3C", // red (danger)
    fresh: "#188A5A", // green (success)
    "non expiring": "#2F6FED", // blue (primary)
    empty: "#E3E7EC", // grey (border)
  };
  const getColor = (entry) =>
    (entry && entry.status && colorFor[entry.status]) ||
    (typeof entry === "string" && colorFor[entry]) ||
    colorFor.empty;
  const [tip, setTip] = useState(null); // { bin, productId, productName, status, category, expiryDate, x, y }
  const showTip = (entry, i, e) => {
    setTip({
      bin: entry && entry.bin ? entry.bin : String(i + 1).padStart(2, "0"),
      productId: entry && entry.productId,
      productName: entry && entry.productName,
      status: entry && entry.status ? entry.status : "empty",
      category: entry && entry.category,
      expiryDate: entry && entry.expiryDate,
      x: e.clientX,
      y: e.clientY,
    });
  };
  return (
    <div
      style={{ background: c.card, border: `1px solid ${c.border}` }}
      className="rounded-md p-4 sm:p-5"
    >
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3
            style={{ color: c.text }}
            className="font-semibold text-sm sm:text-base"
          >
            Bin utilization
          </h3>
          <p style={{ color: c.muted }} className="text-xs sm:text-sm">
            Sample view across zones A–D · {cols * rows} bins total
          </p>
        </div>
        <div
          className="flex items-center gap-3 sm:gap-4 text-xs"
          style={{ color: c.muted }}
        >
          {[
            ["expired", "Expired"],
            ["near expiry", "Near Expiry"],
            ["fresh", "Fresh"],
            ["non expiring", "Non‑expiring"],
            ["empty", "Empty"],
          ].map(([k, l]) => (
            <span key={k} className="flex items-center gap-1">
              <span
                style={{ background: colorFor[k] }}
                className="w-2.5 h-2.5 rounded-sm inline-block"
              />
              {l}
            </span>
          ))}
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 3,
        }}
      >
        {cells.map((entry, i) => (
          <div
            key={i}
            onMouseMove={(e) => showTip(entry, i, e)}
            onMouseLeave={() => setTip(null)}
            onClick={() => onSelectCell && onSelectCell(entry, i)}
            role={onSelectCell ? "button" : undefined}
            tabIndex={onSelectCell ? 0 : undefined}
            style={{
              background: getColor(entry),
              aspectRatio: "16 / 10",
              borderRadius: 2,
              cursor: onSelectCell ? "pointer" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1px",
              overflow: "hidden",
            }}
            title={entry && entry.bin ? entry.bin : `Bin ${i + 1}`}
          >
            <span
              style={{
                color: entry === "empty" ? "#96A0AE" : "#ffffff",
                fontSize: 6,
                lineHeight: 1,
                fontWeight: 600,
                textAlign: "center",
                wordBreak: "break-all",
              }}
            >
              {entry && entry.bin ? entry.bin : "—"}
            </span>
          </div>
        ))}
      </div>

      {tip && (
        <div
          className="pointer-events-none rounded-lg p-3 text-xs"
          style={{
            position: "fixed",
            left: tip.x + 14,
            top: tip.y + 14,
            background: "#1F2937",
            color: "#F9FAFB",
            border: "1px solid #374151",
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            zIndex: 9999,
            maxWidth: 240,
          }}
        >
          <div className="font-semibold mb-1">Bin {tip.bin}</div>
          {tip.productName ? (
            <>
              <div className="text-[13px]">{tip.productName}</div>
              <div style={{ color: "#D1D5DB" }} className="mt-0.5">
                {tip.productId} · {tip.category || "—"}
              </div>
              <div style={{ color: "#D1D5DB" }} className="mt-0.5">
                Expiry:{" "}
                {!tip.expiryDate || tip.expiryDate === "none"
                  ? "Non-expiring"
                  : tip.expiryDate}
              </div>
              <div
                className="mt-1 inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-semibold uppercase"
                style={{
                  background:
                    tip.status === "empty"
                      ? "#4B5563"
                      : tip.status === "expired"
                        ? "#000000"
                        : tip.status === "near expiry"
                          ? "#DC2626"
                          : tip.status === "fresh"
                            ? "#16A34A"
                            : "#2563EB",
                  color: "#fff",
                }}
              >
                {tip.status}
              </div>
            </>
          ) : (
            <div style={{ color: "#D1D5DB" }}>Empty · slot freed by dispatch</div>
          )}
        </div>
      )}
    </div>
  );
}

function Pipeline({ title, stages, onSelectStage }) {
  return (
    <div
      style={{ background: c.card, border: `1px solid ${c.border}` }}
      className="rounded-md p-4 sm:p-5"
    >
      <h3
        style={{ color: c.text }}
        className="font-semibold text-sm sm:text-base mb-4"
      >
        {title}
      </h3>
      <div className="flex items-stretch overflow-x-auto pb-2 gap-y-3">
        {stages.map((s, i) => (
          <React.Fragment key={s.label}>
            <div
              role={onSelectStage ? "button" : undefined}
              tabIndex={onSelectStage ? 0 : undefined}
              onClick={onSelectStage ? () => onSelectStage(s, i) : undefined}
              onKeyDown={onSelectStage ? (e) => { if (e.key === "Enter" || e.key === " ") onSelectStage(s, i); } : undefined}
              className="flex flex-col items-center gap-2 px-2 sm:px-3 min-w-[76px] sm:min-w-[86px] transition-all rounded-md hover:bg-gray-50"
              style={{ cursor: onSelectStage ? "pointer" : "default" }}
            >
              <div
                style={{ background: c.surface, color: c.text }}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-md flex items-center justify-center"
              >
                <s.icon size={16} />
              </div>
              <span
                style={{ color: c.text }}
                className="text-[11px] sm:text-xs text-center font-medium leading-tight"
              >
                {s.label}
              </span>
              <span
                style={{ color: c.primary }}
                className="text-xs sm:text-sm font-semibold"
              >
                {s.count}
              </span>
            </div>
            {i < stages.length - 1 && (
              <div className="flex items-center" style={{ color: c.faint }}>
                <ChevronRight size={15} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function ActivityTable({ searchQuery = "", inward = [], outward = [], inwardConsignments = [], outwardConsignments = [] }) {
  const rows = useMemo(() => {
    const result = [];
    const flows = [
      {
        records: inward,
        consignments: inwardConsignments,
        typeLabel: "Inward",
        meta: IN_STAGE_META,
        toneMap: { success: "success", warning: "warning", muted: "muted" },
      },
      {
        records: outward,
        consignments: outwardConsignments,
        typeLabel: "Outward",
        meta: OUT_STAGE_META,
        toneMap: { success: "success", warning: "warning", muted: "muted" },
      },
    ];
    flows.forEach((flow) => {
      // For each consignment, use its current (latest reached) stage record
      flow.consignments.forEach((c) => {
        const stageRecords = flow.records.filter(
          (r) => r.commonNumber === c.commonNumber,
        );
        const completed = stageRecords.filter((r) => r.status === "completed");
        let current = null;
        if (c.currentStage && c.currentStage <= flow.meta.length) {
          current =
            stageRecords.find(
              (r) => r.type === flow.meta[c.currentStage - 1].key,
            ) || completed[completed.length - 1] || null;
        }
        if (!current) current = completed[completed.length - 1] || null;
        if (!current) current = stageRecords[0] || null;
        if (!current) return;
        const meta = flow.meta.find((m) => m.key === current.type);
        result.push({
          doc: current.id,
          party: c.customer,
          type: flow.typeLabel,
          stage: meta ? meta.label : current.type,
          status: current.status === "completed" ? "success" : "warning",
          time: current.createdAt || "",
        });
      });
    });
    // Sort by created date (approx, descending) and cap to keep the table tidy
    result.sort((a, b) => (b.time < a.time ? -1 : a.time < b.time ? 1 : 0));
    return result.slice(0, 12);
  }, [inward, inwardConsignments, outward, outwardConsignments]);

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter(
      (r) =>
        r.doc.toLowerCase().includes(q) ||
        r.party.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q) ||
        r.stage.toLowerCase().includes(q),
    );
  }, [rows, searchQuery]);

  return (
    <div
      style={{ background: c.card, border: `1px solid ${c.border}` }}
      className="rounded-md overflow-hidden"
    >
      <div className="p-4 sm:p-5 pb-0 flex items-center justify-between">
        <h3
          style={{ color: c.text }}
          className="font-semibold text-sm sm:text-base"
        >
          Recent activity
        </h3>
        {searchQuery && (
          <span style={{ color: c.primary }} className="text-xs font-medium">
            Filtering: "{searchQuery}"
          </span>
        )}
      </div>
      <div className="overflow-x-auto p-4 sm:p-5 pt-3">
        <table className="w-full text-xs sm:text-sm border-collapse min-w-[500px]">
          <thead>
            <tr style={{ color: c.muted }} className="text-left">
              <th className="font-medium py-2 pr-4">Doc no.</th>
              <th className="font-medium py-2 pr-4">Party</th>
              <th className="font-medium py-2 pr-4">Type</th>
              <th className="font-medium py-2 pr-4">Stage</th>
              <th className="font-medium py-2 pr-4">Status</th>
              <th className="font-medium py-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length > 0 ? (
              filteredRows.map((r) => (
                <tr key={r.doc} style={{ borderTop: `1px solid ${c.border}` }}>
                  <td
                    className="py-3 pr-4 font-semibold text-xs sm:text-sm"
                    style={{ color: c.text }}
                  >
                    {r.doc}
                  </td>
                  <td className="py-3 pr-4" style={{ color: c.text }}>
                    {r.party}
                  </td>
                  <td className="py-3 pr-4" style={{ color: c.muted }}>
                    {r.type}
                  </td>
                  <td className="py-3 pr-4" style={{ color: c.muted }}>
                    {r.stage}
                  </td>
                  <td className="py-3 pr-4">
                    <Pill tone={r.status}>{r.stage}</Pill>
                  </td>
                  <td className="py-3 text-xs" style={{ color: c.faint }}>
                    {r.time}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="py-6 text-center"
                  style={{ color: c.muted }}
                >
                  No matching activity found for "{searchQuery}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pager({ total, page, setPage, pageSize, setPageSize }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pages);
  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [safePage, page, setPage]);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span style={{ color: c.muted }} className="hidden sm:inline">
        {total} {total === 1 ? "item" : "items"}
      </span>
      <select
        value={pageSize}
        onChange={(e) => {
          setPageSize(Number(e.target.value));
          setPage(1);
        }}
        style={{ borderColor: c.border, color: c.text, background: c.card }}
        className="px-2 py-1 rounded-md border text-xs outline-none"
        title="Rows per page"
      >
        {[10, 25, 50, 100].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => setPage(safePage - 1)}
          style={{ borderColor: c.border, color: safePage <= 1 ? c.faint : c.text }}
          className="px-1.5 py-1 rounded-md border bg-white disabled:opacity-40"
          title="Previous page"
        >
          <ChevronLeft size={13} />
        </button>
        <span style={{ color: c.muted }} className="px-1 whitespace-nowrap">
          {safePage} / {pages}
        </span>
        <button
          type="button"
          disabled={safePage >= pages}
          onClick={() => setPage(safePage + 1)}
          style={{ borderColor: c.border, color: safePage >= pages ? c.faint : c.text }}
          className="px-1.5 py-1 rounded-md border bg-white disabled:opacity-40"
          title="Next page"
        >
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}

function CrudPage({
  title,
  note,
  addLabel,
  columns,
  rows,
  onAdd,
  onEdit,
  onDelete,
  reservedKeys = [],
  globalSearch = "",
  qrIndex = -1,
}) {
  const [error, setError] = useState("");

  const [qrFor, setQrFor] = useState(null);
  const [barcodeFor, setBarcodeFor] = useState(null);
  const [modal, setModal] = useState(null); // { mode: 'add'|'edit', index: number|null, values: string[] }
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const activeSearch = globalSearch;

  const filterRows = (list) => {
    if (!activeSearch.trim()) return list;
    const q = activeSearch.toLowerCase();
    return list.filter((row) =>
      row.some((cell) => String(cell).toLowerCase().includes(q)),
    );
  };

  const filteredRows = useMemo(() => filterRows(rows || []), [rows, activeSearch]);
  useEffect(() => {
    setPage(1);
  }, [activeSearch, pageSize, rows]);
  const pagedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  // First column is treated as the unique key (code / id / name).
  // A key is considered taken if it exists in the live list OR is reserved
  // (i.e. sitting in the Recycle Bin and not yet permanently deleted).
  const findDuplicate = (candidate, excludeIndex) => {
    const c = String(candidate).toLowerCase();
    const inList = (rows || []).some(
      (row, i) => i !== excludeIndex && String(row[0]).toLowerCase() === c,
    );
    const inTrash = reservedKeys.some(
      (k) => String(k).toLowerCase() === c,
    );
    return inList || inTrash;
  };

  const reserveError = (candidate) =>
    reservedKeys.some(
      (k) => String(k).toLowerCase() === String(candidate).toLowerCase(),
    );

  const openAdd = () => {
    setError("");
    setModal({ mode: "add", index: null, values: columns.map(() => "") });
  };

  const openEdit = (row, index) => {
    setError("");
    setModal({ mode: "edit", index, values: [...row] });
  };

  const validateAndSave = () => {
    const trimmed = modal.values.map((v) => (v == null ? "" : String(v).trim()));
    if (trimmed[0] === "") {
      setError(`Please enter a ${columns[0].toLowerCase()}.`);
      return;
    }
    if (findDuplicate(trimmed[0], modal.index)) {
      if (reserveError(trimmed[0])) {
        setError(`"${trimmed[0]}" is in the Recycle Bin and cannot be reused until permanently deleted.`);
      } else {
        setError(`Duplicate ${columns[0].toLowerCase()} "${trimmed[0]}" already exists.`);
      }
      return;
    }
    if (modal.mode === "edit") {
      if (onEdit) onEdit(trimmed, modal.index);
    } else {
      if (onAdd) onAdd(trimmed);
    }
    setModal(null);
    setError("");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2
            style={{ color: c.text }}
            className="text-lg sm:text-xl font-semibold"
          >
            {title}
          </h2>
          {note && (
            <p
              style={{ color: c.muted }}
              className="text-xs sm:text-sm mt-0.5 sm:mt-1"
            >
              {note}
            </p>
          )}
        </div>
        <button
          onClick={openAdd}
          style={{ background: c.primary }}
          className="text-white px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-medium flex items-center gap-1.5 hover:opacity-90"
        >
          <Plus size={16} /> {addLabel}
        </button>
      </div>
      <div
        style={{ background: c.card, border: `1px solid ${c.border}` }}
        className="rounded-md p-3 sm:p-4"
      >
        <div className="flex justify-end mb-4">
          <Pager
            total={filteredRows.length}
            page={page}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={setPageSize}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm border-collapse min-w-[600px]">
            <thead>
              <tr style={{ color: c.muted }} className="text-left">
                {columns.map((col) => (
                  <th key={col} className="font-medium py-2 pr-4">
                    {col}
                  </th>
                ))}
                <th className="font-medium py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.length > 0 ? (
                pagedRows.map((row, i) => {
                  const realIndex = (rows || []).indexOf(row);
                  return (
                    <tr
                      key={i}
                      style={{ borderTop: `1px solid ${c.border}` }}
                    >
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          className="py-3 pr-4"
                          style={{
                            color: j === 0 ? c.text : c.muted,
                            fontWeight: j === 0 ? 600 : 400,
                          }}
                        >
                          {cell}
                        </td>
                      ))}
                      <td className="py-3">
                        {qrIndex >= 0 && (
                          <button
                            onClick={() => setQrFor(row[qrIndex])}
                            style={{ color: c.primary }}
                            className="inline-flex items-center gap-1 text-xs sm:text-sm font-medium hover:underline mr-3"
                            title={`QR for ${row[qrIndex]}`}
                          >
                            QR
                          </button>
                        )}
                        {qrIndex >= 0 && (
                          <button
                            onClick={() => setBarcodeFor(row[qrIndex])}
                            style={{ color: c.primary }}
                            className="inline-flex items-center gap-1 text-xs sm:text-sm font-medium hover:underline mr-3"
                            title={`Barcode for ${row[qrIndex]}`}
                          >
                            Barcode
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(row, realIndex)}
                          style={{ color: c.primary }}
                          className="text-xs sm:text-sm font-medium hover:underline mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete && onDelete(realIndex)}
                          style={{ color: c.danger }}
                          className="text-xs sm:text-sm font-medium hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="py-6 text-center"
                    style={{ color: c.muted }}
                  >
                    No results found matching "{activeSearch}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: c.card, border: `1px solid ${c.border}` }}
            className="w-full max-w-md rounded-lg overflow-hidden shadow-2xl"
          >
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ borderBottom: `1px solid ${c.border}`, background: c.surface }}
            >
              <h4 style={{ color: c.text }} className="text-sm font-semibold">
                {modal.mode === "add" ? `New ${title.replace(/s$/, "")}` : `Edit ${title.replace(/s$/, "")}`}
              </h4>
              <button
                onClick={() => setModal(null)}
                style={{ color: c.faint }}
                className="p-1 rounded hover:bg-gray-200"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              {modal.values.map((value, idx) => (
                <div key={idx} className="flex flex-col gap-1">
                  <label
                    style={{ color: c.muted }}
                    className="text-xs font-medium"
                  >
                    {columns[idx]}
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={value}
                      onChange={(e) =>
                        setModal({
                          ...modal,
                          values: modal.values.map((v, vi) =>
                            vi === idx ? e.target.value : v,
                          ),
                        })
                      }
                      placeholder={`Enter ${columns[idx].toLowerCase()}`}
                      style={{ borderColor: c.border, color: c.text }}
                      className="flex-1 px-3 py-2 rounded-md border text-sm outline-none focus:ring-2"
                    />
                    <ScanInput
                      value={value}
                      onValue={(t) =>
                        setModal({
                          ...modal,
                          values: modal.values.map((v, vi) =>
                            vi === idx ? t : v,
                          ),
                        })
                      }
                    />
                  </div>
                </div>
              ))}
              {error && (
                <p style={{ color: c.danger }} className="text-xs font-medium">
                  {error}
                </p>
              )}
            </div>
            <div
              className="px-4 py-3 flex items-center justify-end gap-2"
              style={{ borderTop: `1px solid ${c.border}` }}
            >
              <button
                onClick={() => setModal(null)}
                style={{ color: c.muted, borderColor: c.border }}
                className="px-4 py-1.5 rounded-md border text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={validateAndSave}
                style={{ background: c.primary }}
                className="px-4 py-1.5 rounded-md text-sm font-medium text-white hover:opacity-90"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {qrFor !== null && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setQrFor(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: c.card, border: `1px solid ${c.border}` }}
            className="rounded-lg overflow-hidden shadow-2xl"
          >
            <div
              className="px-4 py-3 flex items-center justify-between gap-6"
              style={{ borderBottom: `1px solid ${c.border}`, background: c.surface }}
            >
              <h4 style={{ color: c.text }} className="text-sm font-semibold">
                Bin QR
              </h4>
              <button
                onClick={() => setQrFor(null)}
                style={{ color: c.faint }}
                className="p-1 rounded hover:bg-gray-200"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 flex flex-col items-center gap-3">
              <QrImg text={qrFor} size={140} />
              <p style={{ color: c.muted }} className="text-sm font-medium">
                {qrFor}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigator.clipboard && navigator.clipboard.writeText(String(qrFor))}
                  style={{ color: c.primary, borderColor: c.primary }}
                  className="px-3 py-1.5 rounded-md border text-xs font-semibold hover:bg-blue-50"
                >
                  Copy code
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const url = await qrUrl(qrFor, 280);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${String(qrFor).replace(/[^\w-]/g, "_")}-qr.png`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  style={{ color: c.primary, borderColor: c.primary }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border text-xs font-semibold hover:bg-blue-50"
                >
                  <Download size={13} /> Download PNG
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {barcodeFor !== null && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setBarcodeFor(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: c.card, border: `1px solid ${c.border}` }}
            className="rounded-lg overflow-hidden shadow-2xl"
          >
            <div
              className="px-4 py-3 flex items-center justify-between gap-6"
              style={{ borderBottom: `1px solid ${c.border}`, background: c.surface }}
            >
              <h4 style={{ color: c.text }} className="text-sm font-semibold">
                {title.replace(/s$/, "")} Barcode
              </h4>
              <button
                onClick={() => setBarcodeFor(null)}
                style={{ color: c.faint }}
                className="p-1 rounded hover:bg-gray-200"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 flex flex-col items-center gap-3">
              <BarcodeView
                value={barcodeFor}
                filename={String(barcodeFor).replace(/[^\w-]/g, "_")}
              />
              <p style={{ color: c.muted }} className="text-sm font-medium">
                {barcodeFor}
              </p>
              <button
                onClick={() => navigator.clipboard && navigator.clipboard.writeText(String(barcodeFor))}
                style={{ color: c.primary, borderColor: c.primary }}
                className="px-3 py-1.5 rounded-md border text-xs font-semibold hover:bg-blue-50"
              >
                Copy code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TreeRow({
  node,
  depth = 0,
  stages,
  tone,
  onOpenRow,
  onDeleteRow,
  expandedSet,
  onToggle,
  forceOpen = false,
  selectedStep,
}) {
  const hasChildren = !!node.children && node.children.length > 0;
  const isExpanded = forceOpen || expandedSet.has(node.id);
  const step = node.step;
  const activeColor = tone === "inward" ? c.primary : "#7C3AED";
  const isStageSelected = selectedStep !== undefined && selectedStep === step - 1;
  const [labelOpen, setLabelOpen] = useState(null); // {type, value}
  const labelValue = node.documentId || node.id || "";
  const isInwardRecord = node.flow === "inward" && node.step === stages.length;
  const qrPayload = [
    labelValue,
    node.productName ? `Product: ${node.productName}` : "",
    node.productId ? `SKU: ${node.productId}` : "",
    node.binRef ? `Bin: ${node.binRef}` : "",
    node.party && node.party !== "—" ? `Party: ${node.party}` : "",
    node.ref && node.ref !== "—" ? (node.flow === "inward" ? `Vehicle: ${node.ref}` : `Ref: ${node.ref}`) : "",
    node.stageLabel ? `Stage: ${node.stageLabel}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const closeLabel = () => setLabelOpen(null);

  return (
    <React.Fragment>
      <tr
        className="border-t align-middle"
        style={{
          borderColor: c.border,
          background: isExpanded
            ? c.bg
            : isStageSelected
              ? `${activeColor}0F`
              : undefined,
          opacity: isExpanded ? 0.55 : 1,
          boxShadow: isStageSelected ? `inset 3px 0 0 ${activeColor}` : undefined,
        }}
      >
        <td
          className="px-3 py-2.5 text-xs sm:text-sm"
          style={{ color: c.text, paddingLeft: 12 + depth * 22 }}
        >
          <div className="flex items-center gap-1.5">
            {hasChildren ? (
              <button
                onClick={() => onToggle(node.id)}
                className="p-0.5 shrink-0"
                style={{ color: c.muted }}
                aria-label={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
              </button>
            ) : (
              <span className="w-4 shrink-0" />
            )}
            <span
              className="font-medium"
              style={{ color: c.primary }}
            >
              {node.documentId || node.id}
            </span>
          </div>
        </td>
        <td className="px-3 py-2.5 text-xs sm:text-sm" style={{ color: c.text }}>
          {node.party || node.ref || "—"}
        </td>
        <td className="px-3 py-2.5 text-xs sm:text-sm" style={{ color: c.muted }}>
          {node.ref || "—"}
        </td>
        <td className="px-3 py-2.5" style={{ color: c.text }}>
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium"
            style={{
              background: c.soft,
              color: step > 1 ? activeColor : c.primary,
            }}
          >
            {node.stageLabel}
          </span>
        </td>
        <td className="px-3 py-2.5 text-xs sm:text-sm" style={{ color: c.muted }}>
          {node.flow === "inward" ? "Inward" : "Outward"}
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ width: 70, background: c.soft }}
            >
              <div
                style={{
                  width: `${Math.max(8, Math.min(100, (step / Math.max(1, stages.length)) * 100))}%`,
                  background: activeColor,
                }}
                className="h-full"
              />
            </div>
            <span className="text-[11px]" style={{ color: c.muted }}>
              {step}/{stages.length}
            </span>
          </div>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onOpenRow(node)}
              className="text-xs px-2 py-1 rounded flex items-center gap-1 hover:opacity-80"
              style={{ color: activeColor, background: c.soft }}
            >
              <Eye size={13} /> Open
            </button>
            {onDeleteRow && (
              <button
                onClick={() => onDeleteRow(node)}
                className="text-xs px-2 py-1 rounded flex items-center gap-1 hover:opacity-80"
                style={{ color: "#DC2626", background: "rgba(220,38,38,0.1)" }}
              >
                <Trash2 size={13} /> Delete
              </button>
            )}
            {isInwardRecord && (
              <>
                <button
                  onClick={() => setLabelOpen({ type: "qr", value: qrPayload })}
                  className="p-1.5 rounded hover:opacity-80"
                  style={{ color: activeColor, background: c.soft }}
                  title="View & download Inward QR"
                >
                  <QrCode size={13} />
                </button>
                <button
                  onClick={() => setLabelOpen({ type: "barcode", value: labelValue })}
                  className="p-1.5 rounded hover:opacity-80"
                  style={{ color: activeColor, background: c.soft }}
                  title="View & download barcode"
                >
                  <Barcode size={13} />
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
      {labelOpen && (
        <tr>
          <td colSpan={8}>
            <div
              className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-4"
              onClick={closeLabel}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{ background: c.card, border: `1px solid ${c.border}` }}
                className="rounded-lg overflow-hidden shadow-2xl"
              >
                <div
                  className="px-4 py-3 flex items-center justify-between gap-6"
                  style={{ borderBottom: `1px solid ${c.border}`, background: c.surface }}
                >
                  <h4 style={{ color: c.text }} className="text-sm font-semibold">
                    {labelOpen.type === "qr" ? "QR Code" : "Barcode"}
                  </h4>
                  <button
                    onClick={closeLabel}
                    style={{ color: c.faint }}
                    className="p-1 rounded hover:bg-gray-200"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="p-5 flex flex-col items-center gap-3">
                  {labelOpen.type === "qr" ? (
                    <>
                      <QrImg text={labelOpen.value} size={140} />
                      <button
                        type="button"
                        onClick={async () => {
                          const url = await qrUrl(labelOpen.value, 280);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `${String(labelOpen.value).replace(/[^\w-]/g, "_")}-qr.png`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }}
                        style={{ color: c.primary, borderColor: c.primary }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border text-xs font-semibold hover:bg-blue-50"
                      >
                        <Download size={13} /> Download PNG
                      </button>
                    </>
                  ) : (
                    <BarcodeView
                      value={labelOpen.value}
                      filename={String(labelOpen.value).replace(/[^\w-]/g, "_")}
                    />
                  )}
                  <p style={{ color: c.muted }} className="text-sm font-medium">
                    {labelOpen.value}
                  </p>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
      {isExpanded &&
        hasChildren &&
        node.children.map((child, i) => (
          <TreeRow
            key={child.id || i}
            node={child}
            depth={depth + 1}
            stages={stages}
            tone={tone}
            onOpenRow={onOpenRow}
            onDeleteRow={onDeleteRow}
            expandedSet={expandedSet}
            onToggle={onToggle}
            forceOpen={child.forceOpen}
            selectedStep={selectedStep}
          />
        ))}
    </React.Fragment>
  );
}

function WorkflowRow({ r, stages, tone, onOpenRow, onDeleteRow, forcedStepIndex }) {
  const defaultStep =
    forcedStepIndex !== undefined ? forcedStepIndex : r.step - 1;
  const [selectedStep, setSelectedStep] = useState(defaultStep);

  useEffect(() => {
    if (forcedStepIndex !== undefined) {
      setSelectedStep(forcedStepIndex);
    }
  }, [forcedStepIndex]);

  const activeColor = tone === "inward" ? c.primary : "#7C3AED";
  const currentDocNo = r.documentId || getStepDocNo(r.docBase, tone, selectedStep);
  const isOutwardStage = r.flow === "outward" && r.step === stages.length;
  const [labelOpen, setLabelOpen] = useState(null); // {type, value}
  const closeLabel = () => setLabelOpen(null);
  const outQrPayload = [
    currentDocNo,
    r.productName ? `Product: ${r.productName}` : "",
    r.productId ? `SKU: ${r.productId}` : "",
    r.binRef ? `Bin: ${r.binRef}` : "",
    r.party && r.party !== "—" ? `Customer: ${r.party}` : "",
    r.ref && r.ref !== "—" ? `Vehicle: ${r.ref}` : "",
    r.stageLabel ? `Stage: ${r.stageLabel}` : "Stage: Outward",
  ].filter(Boolean).join("\n");

  const prevDisabled = selectedStep === 0;
  const nextDisabled = selectedStep >= r.step - 1;

  const handlePrev = (e) => {
    e.stopPropagation();
    if (!prevDisabled) setSelectedStep((prev) => prev - 1);
  };

  const handleNext = (e) => {
    e.stopPropagation();
    if (!nextDisabled) setSelectedStep((prev) => prev + 1);
  };

  return (
    <React.Fragment>
    <tr style={{ borderTop: `1px solid ${c.border}` }}>
      <td className="py-3 pr-4">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={prevDisabled}
            onClick={handlePrev}
            title={prevDisabled ? "First step" : "View Previous Step Doc No."}
            className="p-1 sm:p-1.5 rounded-md border transition-all flex items-center justify-center"
            style={{
              borderColor: c.border,
              color: prevDisabled ? c.faint : c.text,
              opacity: prevDisabled ? 0.35 : 1,
              cursor: prevDisabled ? "not-allowed" : "pointer",
              background: prevDisabled ? c.surface : "#ffffff",
            }}
          >
            <ChevronLeft size={14} />
          </button>

          <div className="flex flex-col min-w-[130px] sm:min-w-[140px] px-1">
            <span
              className="font-semibold text-xs sm:text-sm tracking-tight"
              style={{ color: c.text }}
            >
              {currentDocNo}
            </span>
            <span
              className="text-[10px] sm:text-[11px] font-medium truncate"
              style={{ color: activeColor }}
            >
              S{selectedStep + 1}: {stages[selectedStep]}
            </span>
          </div>

          <button
            type="button"
            disabled={nextDisabled}
            onClick={handleNext}
            title={
              nextDisabled ? "No next step available" : "View Next Step Doc No."
            }
            className="p-1 sm:p-1.5 rounded-md border transition-all flex items-center justify-center"
            style={{
              borderColor: c.border,
              color: nextDisabled ? c.faint : c.text,
              opacity: nextDisabled ? 0.35 : 1,
              cursor: nextDisabled ? "not-allowed" : "pointer",
              background: nextDisabled ? c.surface : "#ffffff",
            }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </td>
      <td className="py-3 pr-4 font-medium" style={{ color: c.text }}>
        {r.party}
      </td>
      <td className="py-3 pr-4 text-xs sm:text-sm" style={{ color: c.muted }}>
        {r.ref}
      </td>
      <td className="py-3 pr-4" style={{ color: c.muted }}>
        Step {selectedStep + 1} of {stages.length}
        <div className="text-xs font-medium" style={{ color: activeColor }}>
          {stages[selectedStep]}
        </div>
      </td>
      <td className="py-3 pr-4">
        <Pill
          tone={
            selectedStep + 1 === r.step
              ? r.tone
              : selectedStep < r.step
                ? "success"
                : "muted"
          }
        >
          {stages[selectedStep]}
        </Pill>
      </td>
      <td className="py-3 pr-4">
        <div
          style={{ background: c.surface }}
          className="h-1.5 w-20 sm:w-24 rounded-full overflow-hidden"
        >
          <div
            style={{
              background: activeColor,
              width: ((selectedStep + 1) / stages.length) * 100 + "%",
            }}
            className="h-full rounded-full"
          />
        </div>
      </td>
      <td className="py-3">
        <button
          onClick={() => onOpenRow(r, selectedStep)}
          style={{ color: activeColor }}
          className="text-xs sm:text-sm font-semibold hover:underline whitespace-nowrap"
        >
          Open Step {selectedStep + 1}
        </button>
        {onDeleteRow && (
          <button
            onClick={() => onDeleteRow(r)}
            style={{ color: c.danger }}
            className="text-xs sm:text-sm font-medium hover:underline whitespace-nowrap ml-3"
          >
            Delete
          </button>
        )}
        {isOutwardStage && currentDocNo && (
          <>
            <button
              onClick={() => setLabelOpen({ type: "qr", value: outQrPayload })}
              className="ml-2 p-1.5 rounded"
              style={{ color: activeColor, background: c.soft }}
              title="View & download Outward QR"
            >
              <QrCode size={13} />
            </button>
            <button
              onClick={() => setLabelOpen({ type: "barcode", value: currentDocNo })}
              className="ml-1 p-1.5 rounded"
              style={{ color: activeColor, background: c.soft }}
              title="View & download barcode"
            >
              <Barcode size={13} />
            </button>
          </>
        )}
      </td>
    </tr>
    {labelOpen && (
      <tr>
        <td colSpan={7}>
          <div
            className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-4"
            onClick={closeLabel}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: c.card, border: `1px solid ${c.border}` }}
              className="rounded-lg overflow-hidden shadow-2xl"
            >
              <div
                className="px-4 py-3 flex items-center justify-between gap-6"
                style={{ borderBottom: `1px solid ${c.border}`, background: c.surface }}
              >
                <h4 style={{ color: c.text }} className="text-sm font-semibold">
                  {labelOpen.type === "qr" ? "QR Code" : "Barcode"}
                </h4>
                <button
                  onClick={closeLabel}
                  style={{ color: c.faint }}
                  className="p-1 rounded hover:bg-gray-200"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-5 flex flex-col items-center gap-3">
                {labelOpen.type === "qr" ? (
                  <>
                    <QrImg text={labelOpen.value} size={140} />
                    <button
                      type="button"
                      onClick={async () => {
                        const url = await qrUrl(labelOpen.value, 280);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${String(currentDocNo).replace(/[^\w-]/g, "_")}-qr.png`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      }}
                      style={{ color: c.primary, borderColor: c.primary }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border text-xs font-semibold hover:bg-blue-50"
                    >
                      <Download size={13} /> Download PNG
                    </button>
                  </>
                ) : (
                  <BarcodeView
                    value={labelOpen.value}
                    filename={`${String(currentDocNo).replace(/[^\w-]/g, "_")}-barcode`}
                  />
                )}
                <p style={{ color: c.muted }} className="text-sm font-medium">
                  {labelOpen.value}
                </p>
              </div>
            </div>
          </div>
        </td>
      </tr>
    )}
  </React.Fragment>
  );
}

function WorkflowPage({
  title,
  note,
  stages,
  rows,
  tone,
  addLabel,
  onAdd,
  onOpenRow,
  onDeleteRow,
  footnote,
  globalSearch = "",
}) {
  const [filterStage, setFilterStage] = useState(null);
  const [expandedSet, setExpandedSet] = useState(() => new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const activeColor = tone === "inward" ? c.primary : "#7C3AED";
  const treeMode = Array.isArray(rows) && rows.some((r) => r && Array.isArray(r.children));

  const flatNodes = useMemo(() => {
    if (!treeMode) return [];
    const out = [];
    const walk = (nodes) =>
      (nodes || []).forEach((n) => {
        out.push(n);
        if (n.children) walk(n.children);
      });
    walk(rows);
    return out;
  }, [rows, treeMode]);

  const matchesQuery = (r, q) => {
    const docNo = (r.documentId || getStepDocNo(r.docBase, tone, (r.step || 1) - 1) || "").toLowerCase();
    const baseId = (r.docBase || r.id || "").toLowerCase();
    const party = (r.party || "").toLowerCase();
    const ref = (r.ref || "").toLowerCase();
    const stage = (r.stageLabel || "").toLowerCase();
    return (
      docNo.includes(q) ||
      baseId.includes(q) ||
      party.includes(q) ||
      ref.includes(q) ||
      stage.includes(q)
    );
  };

  const filterTree = (nodes, q) => {
    const out = [];
    for (const n of nodes) {
      const matchSelf = !q || matchesQuery(n, q);
      const kids = n.children ? filterTree(n.children, q) : [];
      if (matchSelf || (kids && kids.length)) {
        out.push(matchSelf ? { ...n, children: kids } : { ...n, children: kids, forceOpen: true });
      }
    }
    return out;
  };

  const searchedRows = useMemo(() => {
    if (!globalSearch.trim() || !treeMode) {
      return treeMode ? rows : rows;
    }
    const q = globalSearch.toLowerCase();
    return filterTree(rows, q);
  }, [rows, globalSearch, tone, treeMode]);

  const filteredRows = useMemo(() => {
    if (filterStage === null || !treeMode) {
      if (filterStage !== null && !treeMode) {
        return searchedRows.filter((r) => r.step >= filterStage + 1);
      }
      return searchedRows;
    }
    const targetStep = filterStage + 1;
    const keep = (nodes) => {
      const out = [];
      for (const r of nodes) {
        const kids = r.children ? keep(r.children) : [];
        const selfMatch = r.step === targetStep;
        if (selfMatch || kids.length) {
          out.push(
            selfMatch
              ? { ...r, children: kids, forceOpen: true }
              : { ...r, children: kids, forceOpen: kids.length > 0 },
          );
        }
      }
      return out;
    };
    return keep(searchedRows);
  }, [searchedRows, filterStage, treeMode]);

  useEffect(() => {
    setPage(1);
  }, [searchedRows, filterStage, pageSize]);
  const pagedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  const toggleNode = (id) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };


  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2
            style={{ color: c.text }}
            className="text-lg sm:text-xl font-semibold"
          >
            {title}
          </h2>
          <p
            style={{ color: c.muted }}
            className="text-xs sm:text-sm mt-0.5 sm:mt-1"
          >
            {note}
          </p>
        </div>
        <button
          onClick={onAdd}
          style={{ background: activeColor }}
          className="text-white px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-medium flex items-center gap-1.5 hover:opacity-90"
        >
          <Plus size={16} /> {addLabel}
        </button>
      </div>

      <div
        style={{ background: c.card, border: `1px solid ${c.border}` }}
        className="rounded-md p-4 sm:p-5 flex flex-col gap-3"
      >
        <div className="flex items-center justify-between">
          <span
            style={{ color: c.muted }}
            className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider"
          >
            Click any step to filter document numbers:
          </span>
          {filterStage !== null && (
            <button
              onClick={() => setFilterStage(null)}
              style={{ color: activeColor }}
              className="text-xs font-semibold hover:underline"
            >
              Clear Filter
            </button>
          )}
        </div>
        <div className="flex items-center overflow-x-auto pb-1 gap-y-3">
          <button
            type="button"
            onClick={() => setFilterStage(null)}
            className="flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-md transition-all cursor-pointer border shadow-sm flex-shrink-0"
            style={{
              background: filterStage === null ? activeColor : c.surface,
              color: filterStage === null ? "#ffffff" : c.text,
              borderColor: filterStage === null ? activeColor : c.border,
            }}
          >
            <span className="text-xs sm:text-sm font-semibold whitespace-nowrap">
              All Steps ({treeMode ? flatNodes.length : searchedRows.length})
            </span>
          </button>
          <ChevronRight
            size={16}
            style={{ color: c.faint }}
            className="mx-1 flex-shrink-0"
          />

          {stages.map((s, i) => {
            const isSelected = filterStage === i;
            const count = treeMode
              ? flatNodes.filter((r) => r.step === i + 1).length
              : searchedRows.filter((r) => r.step >= i + 1).length;
            return (
              <React.Fragment key={s}>
                <button
                  type="button"
                  onClick={() => setFilterStage(filterStage === i ? null : i)}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-md transition-all cursor-pointer border hover:shadow-md flex-shrink-0"
                  style={{
                    background: isSelected ? activeColor : c.surface,
                    color: isSelected ? "#ffffff" : c.text,
                    borderColor: isSelected ? activeColor : c.border,
                  }}
                >
                  <span
                    style={{
                      background: isSelected ? "#ffffff" : activeColor,
                      color: isSelected ? activeColor : "#ffffff",
                    }}
                    className="w-4 h-4 sm:w-5 sm:h-5 rounded-full text-[10px] sm:text-xs flex items-center justify-center font-bold"
                  >
                    {i + 1}
                  </span>
                  <span className="text-xs sm:text-sm font-medium whitespace-nowrap">
                    {s}
                  </span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-bold"
                    style={{
                      background: isSelected
                        ? "rgba(255,255,255,0.25)"
                        : c.border,
                      color: isSelected ? "#ffffff" : c.muted,
                    }}
                  >
                    {count}
                  </span>
                </button>
                {i < stages.length - 1 && (
                  <ChevronRight
                    size={16}
                    style={{ color: c.faint }}
                    className="mx-1 flex-shrink-0"
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div
        style={{ background: c.card, border: `1px solid ${c.border}` }}
        className="rounded-md p-3 sm:p-4"
      >
        {globalSearch && (
          <div
            className="mb-3 px-1 text-xs font-semibold"
            style={{ color: activeColor }}
          >
            Showing search results for: "{globalSearch}" ({filteredRows.length}{" "}
            matches)
          </div>
        )}
        <div className="flex justify-end mb-3">
          <Pager
            total={filteredRows.length}
            page={page}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={setPageSize}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm border-collapse min-w-[700px]">
            <thead>
              <tr style={{ color: c.muted }} className="text-left">
                <th className="font-medium py-2 pr-4">
                  {treeMode ? "Document No." : "Step Doc No. (Use Arrows)"}
                </th>
                <th className="font-medium py-2 pr-4">Party</th>
                <th className="font-medium py-2 pr-4">Ref.</th>
                <th className="font-medium py-2 pr-4">
                  {treeMode ? "Stage" : "Selected Step"}
                </th>
                <th className="font-medium py-2 pr-4">
                  {treeMode ? "Flow" : "Stage Status"}
                </th>
                <th className="font-medium py-2 pr-4">Completion</th>
                <th className="font-medium py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length > 0 ? (
                treeMode ? (
                  pagedRows.map((r, i) => (
                    <TreeRow
                      key={r.id || i}
                      node={r}
                      stages={stages}
                      tone={tone}
                      onOpenRow={onOpenRow}
                      onDeleteRow={onDeleteRow}
                      expandedSet={expandedSet}
                      onToggle={toggleNode}
                      forceOpen={r.forceOpen}
                      selectedStep={filterStage}
                    />
                  ))
                ) : (
                  pagedRows.map((r, i) => (
                    <WorkflowRow
                      key={i}
                      r={r}
                      stages={stages}
                      tone={tone}
                      onOpenRow={onOpenRow}
                      onDeleteRow={onDeleteRow}
                      forcedStepIndex={
                        filterStage !== null ? filterStage : undefined
                      }
                    />
                  ))
                )
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 text-center"
                    style={{ color: c.muted }}
                  >
                    No matching consignments found for query:{" "}
                    <strong style={{ color: c.text }}>"{globalSearch}"</strong>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {footnote && (
        <p style={{ color: c.faint }} className="text-xs">
          {footnote}
        </p>
      )}
    </div>
  );
}

function StageDots({ stages, stageIndex, tone }) {
  return (
    <div className="flex items-center gap-1.5">
      {stages.map((s, i) => (
        <span
          key={s}
          title={s}
          style={{
            background: i <= stageIndex ? tone : "transparent",
            border: `1.5px solid ${i <= stageIndex ? tone : c.border}`,
            width: i === stageIndex ? 9 : 7,
            height: i === stageIndex ? 9 : 7,
          }}
          className="rounded-full inline-block"
        />
      ))}
    </div>
  );
}

function FloatingForm({
  form,
  onChange,
  onClose,
  onMinimize,
  onFocus,
  onSave,
  onSaveCopy,
  onStep,
  onMove,
  onAddPhoto,
  onRemovePhoto,
  onAddChild,
  onRemoveChild,
  onUpdateChild,
  onSaveChild,
  onToggleChild,
  binOptions = [],
}) {
  const [showFields, setShowFields] = useState(
    !form.flowStages || form.stageIndex === 0,
  );
  const tone = FLOW_COLORS[form.tone] || FLOW_COLORS.simple;
  const isFlow = !!form.flowStages;
  const stageLabel = isFlow ? form.flowStages[form.stageIndex] : form.title;

  useEffect(() => {
    setShowFields(!isFlow || form.stageIndex === 0 || (form.childForms || []).length > 0);
  }, [form.stageIndex, form.childForms?.length, isFlow]);

  const leftDisabled = !isFlow || form.stageIndex === 0;
  const rightDisabled =
    !isFlow || form.stageIndex === form.flowStages.length - 1;

  const currentDocId =
    form.documentId || (isFlow && form.docBase
      ? getStepDocNo(form.docBase, form.tone, form.stageIndex)
      : form.docId);

  const canAddChild = isFlow && form.stageIndex < form.flowStages.length - 1;
  const isFirstStep = !isFlow || form.stageIndex === 0;
  const childForms = form.childForms || [];
  const stageChildren = childForms.filter((c) => c.stageIndex === form.stageIndex);

  const currentFields = form.fields ||
    STAGE_FIELDS[stageLabel] ||
    STAGE_FIELDS[form.title] || [
      {
        key: "f1",
        label: `${stageLabel} Reference ID`,
        placeholder: "Enter code / ID",
      },
      {
        key: "f2",
        label: `${stageLabel} Specification / Notes`,
        placeholder: "Enter notes",
      },
      {
        key: "f3",
        label: "Assigned Supervisor",
        placeholder: "Enter supervisor name",
      },
    ];

  const handleHeaderMouseDown = (e) => {
    if (window.innerWidth < 768) return; // Disable drag on mobile (full screen modal)
    if (e.button !== 0) return;
    if (
      e.target.closest("button") ||
      e.target.closest("input") ||
      e.target.closest("label")
    )
      return;

    onFocus(form.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = form.left;
    const startTop = form.top;

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      onMove(
        form.id,
        Math.max(0, startLeft + deltaX),
        Math.max(0, startTop + deltaY),
      );
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        onAddPhoto(form.id, evt.target.result);
      };
      reader.readAsDataURL(file);
    });
  };

  const addSamplePhoto = () => {
    const samples = [
      "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=200&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1616401784845-180882ba9ba8?w=200&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=200&auto=format&fit=crop&q=80",
    ];
    const picked = samples[Math.floor(Math.random() * samples.length)];
    onAddPhoto(form.id, picked);
  };

  return (
    <div
      onMouseDown={() => onFocus(form.id)}
      style={{
        zIndex: form.zIndex,
        boxShadow: `0 24px 48px -14px ${tone}66, 0 0 0 1px ${c.border}`,
        background: c.card,
      }}
      /* 
        Mobile: Fixed full page overlay (inset-0, w-full, h-full)
        Desktop (md:): Floating draggable modal card with absolute positioning
      */
      className="fixed inset-0 w-full h-full md:h-auto md:w-[395px] md:absolute md:inset-auto rounded-none md:rounded-lg overflow-hidden flex flex-col transition-all duration-150"
      ref={(el) => {
        if (el && window.innerWidth >= 768) {
          el.style.left = `${form.left}px`;
          el.style.top = `${form.top}px`;
        }
      }}
    >
      <div style={{ background: tone, height: 4 }} />
      <div
        onMouseDown={handleHeaderMouseDown}
        className="px-4 pt-3 pb-2 flex items-start justify-between gap-2 md:cursor-grab md:active:cursor-grabbing select-none"
        style={{ borderBottom: `1px solid ${c.border}` }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              style={{ background: `${tone}1A`, color: tone }}
              className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
            >
              {form.tone === "inward"
                ? "Inward"
                : form.tone === "outward"
                  ? "Outward"
                  : "Form"}
            </span>
            {currentDocId && (
              <span
                style={{ color: c.faint }}
                className="text-xs font-semibold"
              >
                {currentDocId}
              </span>
            )}
          </div>
          <h4
            style={{ color: c.text }}
            className="text-[15px] font-semibold truncate mt-0.5"
          >
            {stageLabel}
          </h4>
          {isFlow && (
            <p style={{ color: c.muted }} className="text-xs mt-0.5">
              Step {form.stageIndex + 1} of {form.flowStages.length}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onMinimize(form.id)}
            style={{ color: c.faint }}
            className="p-2 md:p-1.5 rounded hover:bg-gray-100"
            title="Minimize Form"
          >
            <Minus size={18} className="md:w-[15px] md:h-[15px]" />
          </button>
          <button
            onClick={() => onClose(form.id)}
            style={{ color: c.faint }}
            className="p-2 md:p-1.5 rounded hover:bg-gray-100"
            title="Close Form"
          >
            <X size={18} className="md:w-[15px] md:h-[15px]" />
          </button>
        </div>
      </div>

      {isFlow && (
        <div
          className="px-4 py-2 flex items-center justify-between"
          style={{
            borderBottom: `1px solid ${c.border}`,
            background: c.surface,
          }}
        >
          <button
            disabled={leftDisabled}
            onClick={() => onStep(form.id, -1)}
            style={{
              color: leftDisabled ? c.faint : tone,
              opacity: leftDisabled ? 0.4 : 1,
              cursor: leftDisabled ? "not-allowed" : "pointer",
            }}
            className="p-1 rounded flex items-center gap-1 text-xs font-medium"
          >
            <ChevronLeft size={16} /> Prev
          </button>
          <StageDots
            stages={form.flowStages}
            stageIndex={form.stageIndex}
            tone={tone}
          />
          <button
            disabled={rightDisabled}
            onClick={() => onStep(form.id, 1)}
            style={{
              color: rightDisabled ? c.faint : tone,
              opacity: rightDisabled ? 0.4 : 1,
              cursor: rightDisabled ? "not-allowed" : "pointer",
            }}
            className="p-1 rounded flex items-center gap-1 text-xs font-medium"
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Stage Document History Stepper Bar in Floating Form */}
      {isFlow && (
        <div
          className="px-3 py-1.5 flex items-center justify-between gap-1.5 select-none"
          style={{
            background: c.surface,
            borderBottom: `1px solid ${c.border}`,
          }}
        >
          <button
            type="button"
            disabled={leftDisabled}
            onClick={() => onStep(form.id, -1)}
            className="p-1 rounded border transition-all flex items-center justify-center"
            style={{
              borderColor: c.border,
              color: leftDisabled ? c.faint : c.text,
              opacity: leftDisabled ? 0.35 : 1,
              cursor: leftDisabled ? "not-allowed" : "pointer",
              background: leftDisabled ? c.surface : "#ffffff",
            }}
          >
            <ChevronLeft size={13} />
          </button>

          <span
            className="text-xs font-semibold text-center flex-1"
            style={{ color: c.text }}
          >
            Step {form.stageIndex + 1}:{" "}
            <span style={{ color: tone }}>{currentDocId}</span>
          </span>

          <button
            type="button"
            disabled={rightDisabled}
            onClick={() => onStep(form.id, 1)}
            className="p-1 rounded border transition-all flex items-center justify-center"
            style={{
              borderColor: c.border,
              color: rightDisabled ? c.faint : c.text,
              opacity: rightDisabled ? 0.35 : 1,
              cursor: rightDisabled ? "not-allowed" : "pointer",
              background: rightDisabled ? c.surface : "#ffffff",
            }}
          >
            <ChevronRight size={13} />
          </button>
        </div>
      )}

      <div className="px-4 py-4 flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto md:max-h-[calc(100vh-230px)]">
        {!isFlow ? (
          showFields &&
          currentFields.map((f) => (
            <div key={f.key} className="flex flex-col gap-1">
              <label style={{ color: c.muted }} className="text-xs font-medium">
                {f.label}
              </label>
              <div className="flex items-center gap-1">
                {f.type === "select" ? (
                  <select
                    value={
                      form.values[`${stageLabel}_${f.key}`] ||
                      form.values[f.key] ||
                      ""
                    }
                    onChange={(e) =>
                      onChange(form.id, `${stageLabel}_${f.key}`, e.target.value)
                    }
                    style={{ borderColor: c.border, color: c.text }}
                    className="flex-1 px-3 py-2.5 sm:py-2 rounded-md border text-sm outline-none focus:ring-2 bg-white"
                  >
                    <option value="">
                      {f.placeholder || `Select ${f.label.toLowerCase()}`}
                    </option>
                    {(f.options?.length ? f.options : binOptions).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.type || "text"}
                    value={
                      form.values[`${stageLabel}_${f.key}`] ||
                      form.values[f.key] ||
                      ""
                    }
                    onChange={(e) =>
                      onChange(form.id, `${stageLabel}_${f.key}`, e.target.value)
                    }
                    placeholder={f.type === "date" ? undefined : (f.placeholder || `Enter ${f.label.toLowerCase()}`)}
                    style={{ borderColor: c.border, color: c.text }}
                    className="flex-1 px-3 py-2.5 sm:py-2 rounded-md border text-sm outline-none focus:ring-2"
                  />
                )}
                {(f.type !== "date") && (
                  <ScanInput
                    value={form.values[`${stageLabel}_${f.key}`] || form.values[f.key] || ""}
                    onValue={(t) => onChange(form.id, `${stageLabel}_${f.key}`, t)}
                  />
                )}
              </div>
            </div>
          ))
        ) : stageChildren.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <button
              type="button"
              onClick={() => onAddChild(form.id)}
              style={{ background: tone }}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold text-white hover:opacity-90"
            >
              <Plus size={18} /> New {form.flowStages[(form.stageIndex || 0)]}
            </button>
            <span style={{ color: c.faint }} className="text-xs">
              Click to add a new {form.flowStages[(form.stageIndex || 0)]} document
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pt-1">
            <div className="flex items-center justify-between">
              <h5 style={{ color: c.text }} className="text-sm font-semibold">
                {form.flowStages[(form.stageIndex || 0)]} documents
              </h5>
              <span style={{ color: c.muted }} className="text-xs">
                {stageChildren.length} form{stageChildren.length === 1 ? "" : "s"}
              </span>
            </div>
            {stageChildren.map((child) => {
          const childFields = STAGE_FIELDS[child.stageLabel] || currentFields;
          const isInward = child.stageLabel === "Good Receipt Note";
          const childQrPayload = [
            child.docId,
            child.values && child.values.productId ? `SKU: ${child.values.productId}` : "",
            child.values && child.values.productName ? `Product: ${child.values.productName}` : "",
            child.values && child.values.binRef ? `Bin: ${child.values.binRef}` : "",
            child.values && child.values.vendor ? `Vendor: ${child.values.vendor}` : "",
            child.values && child.values.customer ? `Customer: ${child.values.customer}` : "",
          ].filter(Boolean).join("\n");
          return (
            <section
              key={child.id}
              className="rounded-md border overflow-hidden"
              style={{ borderColor: c.border }}
            >
              <button
                type="button"
                onClick={() => onToggleChild(form.id, child.id)}
                className="w-full px-3 py-3 flex items-center justify-between gap-3 text-left"
                style={{ background: c.surface, color: c.text }}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <ChevronDown
                    size={16}
                    className={child.open ? "transition-transform" : "-rotate-90 transition-transform"}
                    style={{ color: tone }}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold truncate">{child.stageLabel}</span>
                    <span style={{ color: tone }} className="block text-xs font-bold mt-0.5">{child.docId}</span>
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {!child.saved && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveChild(form.id, child.id);
                      }}
                      style={{ color: c.danger }}
                      className="p-1 rounded hover:bg-red-50"
                      title="Remove this form"
                    >
                      <X size={14} />
                    </button>
                  )}
                  <Pill tone={child.saved ? "success" : "primary"}>{child.saved ? "Saved" : "Draft"}</Pill>
                </span>
              </button>
              {child.open && (
                <div className="p-3 flex flex-col gap-3" style={{ background: c.card }}>
                {childFields.map((field) => (
                  <div key={field.key} className="flex flex-col gap-1">
                    <label style={{ color: c.muted }} className="text-xs font-medium">
                      {field.label}
                    </label>
                    <div className="flex items-center gap-1">
                      {field.type === "select" ? (
                        <select
                          value={child.values[field.key] || ""}
                          onChange={(event) => onUpdateChild(form.id, child.id, field.key, event.target.value)}
                          disabled={child.saved}
                          style={{ borderColor: c.border, color: c.text }}
                          className="flex-1 px-3 py-2 rounded-md border text-sm outline-none focus:ring-2 disabled:bg-gray-50 disabled:text-gray-500 bg-white"
                        >
                          <option value="">
                            {field.placeholder || `Select ${field.label.toLowerCase()}`}
                          </option>
                          {(field.options?.length ? field.options : binOptions).map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type || "text"}
                          value={child.values[field.key] || ""}
                          onChange={(event) => onUpdateChild(form.id, child.id, field.key, event.target.value)}
                          placeholder={field.type === "date" ? undefined : field.placeholder || `Enter ${field.label.toLowerCase()}`}
                          disabled={child.saved}
                          style={{ borderColor: c.border, color: c.text }}
                          className="flex-1 px-3 py-2 rounded-md border text-sm outline-none focus:ring-2 disabled:bg-gray-50 disabled:text-gray-500"
                        />
                      )}
                      {(!child.saved && field.type !== "date") && (
                        <ScanInput
                          value={child.values[field.key] || ""}
                          onValue={(t) => onUpdateChild(form.id, child.id, field.key, t)}
                        />
                      )}
                    </div>
                  </div>
                ))}
                {!child.saved && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => onSaveChild(form.id, child.id)}
                      style={{ background: tone }}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold text-white"
                    >
                      Save
                    </button>
                  </div>
                )}
                {isInward && child.saved && (
                  <div
                    className="flex flex-col gap-3 rounded-md border p-3"
                    style={{ borderColor: c.border, background: c.surface }}
                  >
                    <span style={{ color: c.muted }} className="text-xs font-semibold uppercase">
                      Inward Label
                    </span>
                    <div className="flex items-center gap-6 flex-wrap">
                      <div className="flex flex-col items-center gap-1">
                        <BarcodeView
                          value={child.docId}
                          filename={`${String(child.docId).replace(/[^\w-]/g, "_")}-barcode`}
                          width={190}
                          height={50}
                        />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <QrImg text={childQrPayload} size={96} />
                        <button
                          type="button"
                          onClick={async () => {
                            const url = await qrUrl(childQrPayload, 200);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `${String(child.docId).replace(/[^\w-]/g, "_")}-qr.png`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                          }}
                          style={{ color: c.primary }}
                          className="text-xs font-medium hover:underline flex items-center gap-1"
                        >
                          <Download size={12} /> Download
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                </div>
              )}
            </section>
          );
            })}

            {canAddChild && (
              <button
                type="button"
                onClick={() => onAddChild(form.id)}
                style={{ color: tone, borderColor: tone }}
                className="self-start px-3 py-1.5 rounded-md border text-xs font-semibold hover:bg-blue-50"
              >
                <Plus size={14} className="inline mr-1" /> New {form.flowStages[(form.stageIndex || 0)]}
              </button>
            )}
          </div>
        )}

        {/* Photo Attachment Section */}
        {!form.hidePhoto && (
          <div
            className="flex flex-col gap-2 pt-3 border-t mt-1"
            style={{ borderColor: c.border }}
          >
            <div className="flex items-center justify-between">
              <label
                style={{ color: c.muted }}
                className="text-xs font-medium flex items-center gap-1.5"
              >
                <Camera size={15} style={{ color: tone }} />
                <span>Inspection / Proof Photo</span>
              </label>
              <button
                type="button"
                onClick={addSamplePhoto}
                style={{ color: tone }}
                className="text-xs font-semibold hover:underline"
              >
                + Quick Sample
              </button>
            </div>

            {form.photos && form.photos.length > 0 ? (
              <div className="flex items-center gap-2 flex-wrap pt-1">
                {form.photos.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative w-20 h-20 md:w-16 md:h-16 rounded-md overflow-hidden border flex-shrink-0"
                    style={{ borderColor: c.border }}
                  >
                    <img
                      src={img}
                      alt="Attachment"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => onRemovePhoto(form.id, idx)}
                      className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <label
                  className="w-20 h-20 md:w-16 md:h-16 rounded-md border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-colors"
                  style={{ borderColor: c.border }}
                >
                  <Plus size={18} style={{ color: c.faint }} />
                  <span
                    style={{ color: c.faint }}
                    className="text-[10px] mt-0.5"
                  >
                    Add
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoSelect}
                    multiple
                  />
                </label>
              </div>
            ) : (
              <label
                className="w-full py-3 md:py-2 px-3 rounded-md border border-dashed flex items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 transition-colors"
                style={{ borderColor: c.border }}
              >
                <Camera size={16} style={{ color: tone }} />
                <span style={{ color: c.text }} className="text-xs font-medium">
                  Upload Gate / QC Photo
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoSelect}
                  multiple
                />
              </label>
            )}
          </div>
        )}
      </div>

<div
  className="px-4 py-3 pb-20 md:pb-3 flex items-center justify-end gap-2"
  style={{ borderTop: `1px solid ${c.border}`, background: c.card }}
>
  <button
    onClick={() => onClose(form.id)}
    style={{ color: c.muted, borderColor: c.border }}
    className="px-4 py-2 md:py-1.5 rounded-md border text-sm font-medium hover:bg-gray-50"
  >
    Cancel
  </button>
  <button
    onClick={() => onSaveCopy(form.id)}
    style={{ color: tone, borderColor: tone }}
    className="px-3.5 py-2 md:py-1.5 rounded-md border text-sm font-medium flex items-center gap-1.5 hover:opacity-80"
  >
    <Copy size={14} /> Save & Copy
  </button>
  <button
    onClick={() => onSave(form.id)}
    style={{ background: tone }}
    className="px-4 py-2 md:py-1.5 rounded-md text-sm font-medium text-white hover:opacity-90"
  >
    Save
  </button>
</div>
    </div>
  );
}

function Dock({ forms, onRestore, onClose }) {
  const minimized = forms.filter((f) => f.minimized);
  if (minimized.length === 0) return null;
  return (
    <div
      className="fixed bottom-0 left-0 right-0 flex items-center gap-2 px-3 sm:px-4 py-2 z-50 overflow-x-auto"
      style={{ background: c.ink, borderTop: `1px solid ${c.inkLine}` }}
    >
      {minimized.map((f) => {
        const tone = FLOW_COLORS[f.tone] || FLOW_COLORS.simple;
        const currentDocId =
          f.flowStages && f.docBase
            ? getStepDocNo(f.docBase, f.tone, f.stageIndex)
            : f.docId;
        const label = f.flowStages
          ? `${f.tone === "inward" ? "Inward" : "Outward"} · ${currentDocId || f.flowStages[f.stageIndex]}`
          : f.title;
        return (
          <div
            key={f.id}
            className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-md cursor-pointer flex-shrink-0"
            style={{ background: c.inkSoft, borderLeft: `3px solid ${tone}` }}
            onClick={() => onRestore(f.id)}
          >
            <span className="text-white text-xs font-medium whitespace-nowrap max-w-[140px] sm:max-w-[160px] truncate">
              {label}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose(f.id);
              }}
              style={{ color: c.faint }}
              className="p-1 rounded hover:bg-white/10"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function DetailModal({ title, subtitle, columns, rows, linkLabel, onLink, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(15,23,42,0.55)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: c.card, border: `1px solid ${c.border}`, maxHeight: "88vh" }}
        className="w-full sm:max-w-2xl rounded-t-lg sm:rounded-lg flex flex-col overflow-hidden"
      >
        <div className="flex items-start justify-between gap-2 px-4 py-3 border-b" style={{ borderColor: c.border }}>
          <div>
            <h4 style={{ color: c.text }} className="font-semibold text-sm sm:text-base">
              {title}
            </h4>
            {subtitle && (
              <p style={{ color: c.muted }} className="text-xs mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ color: c.faint }}
            className="p-1.5 rounded hover:bg-gray-100"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-auto flex-1 min-h-0 p-4">
          {rows && rows.length > 0 ? (
            <table className="w-full text-xs sm:text-sm border-collapse">
              <thead>
                <tr style={{ color: c.muted }} className="text-left">
                  {columns.map((col) => (
                    <th key={col} className="font-medium py-1.5 px-2 first:pl-0 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${c.border}` }}>
                    {row.map((cell, j) => (
                      <td key={j} className="py-2 px-2 first:pl-0 whitespace-nowrap" style={{ color: c.text }}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: c.muted }} className="text-sm">No records found.</p>
          )}
        </div>
        {onLink && (
          <div className="px-4 py-3 border-t flex justify-end" style={{ borderColor: c.border }}>
            <button
              onClick={onLink}
              style={{ background: c.primary, color: "#fff" }}
              className="px-3.5 py-2 rounded-md text-xs font-semibold flex items-center gap-1.5 hover:opacity-90"
            >
              {linkLabel || "View full listing"} <ExternalLink size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ReportsPage({ appData }) {
  const [tab, setTab] = useState("inventory");
  const tabs = [
    { id: "inventory", label: "Inventory" },
    { id: "inbound", label: "Inbound (GRN)" },
    { id: "outbound", label: "Outbound (Dispatch)" },
    { id: "billing", label: "Billing" },
    { id: "expiry", label: "Product Expiry" },
  ];

  const binCells = appData.bins.cells;
  const occupied = binCells.filter((c) => c !== "empty");
  const occupiedBins = occupied.length;
  const totalBins = binCells.length;
  const utilization = totalBins ? Math.round((occupiedBins / totalBins) * 100) : 0;
  const grns = appData.inward.filter((r) => r.type === "goodReceiptNote");
  const dispatched = appData.outward.filter((r) => r.type === "outward");

  const billTotal = (pred) =>
    appData.bills.filter(pred).reduce((sum, b) => {
      const n = parseInt(String(b.amount).replace(/[^\d]/g, ""), 10) || 0;
      return sum + n;
    }, 0);

  const renderSummary = (cards) => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
      {cards.map(([label, value, tone]) => (
        <div key={label} style={{ background: c.card, border: `1px solid ${c.border}` }} className="rounded-md p-4">
          <span style={{ color: c.muted }} className="text-xs">{label}</span>
          <div style={{ color: c.text }} className="text-xl sm:text-2xl font-semibold mt-1">{value}</div>
        </div>
      ))}
    </div>
  );

  const Table = ({ columns, rows }) => (
    <div style={{ background: c.card, border: `1px solid ${c.border}` }} className="rounded-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm border-collapse min-w-[560px]">
          <thead>
            <tr style={{ color: c.muted }} className="text-left border-b" >
              {columns.map((col) => (
                <th key={col} className="font-medium py-2.5 px-4 whitespace-nowrap">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${c.border}` }}>
                {row.map((cell, j) => (
                  <td key={j} className="py-2.5 px-4 whitespace-nowrap" style={{ color: c.text }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const stageCounts = (records, meta) => {
    const acc = {};
    meta.forEach((m) => (acc[m.label] = 0));
    records.forEach((r) => {
      const m = meta.find((x) => x.key === r.type);
      if (m) acc[m.label] = (acc[m.label] || 0) + 1;
    });
    return acc;
  };
  const inCounts = stageCounts(appData.inward, IN_STAGE_META);
  const outCounts = stageCounts(appData.outward, OUT_STAGE_META);

  const content = {
    inventory: (
      <>
        {renderSummary([
          ["Total bins", totalBins, "primary"],
          ["Occupied", occupiedBins, "success"],
          ["Empty", totalBins - occupiedBins, "muted"],
          ["Utilization", `${utilization}%`, "primary"],
        ])}
        <Table
          columns={["Bin", "Product", "Category", "Status", "Expiry"]}
          rows={binCells.map((c, i) => {
            const bin = c && c.bin ? c.bin : `Bin ${i + 1}`;
            if (c === "empty") return [bin, "—", "—", "Empty", "—"];
            return [bin, c.productName || "—", (c.category || "—"), c.status || "—", c.expiryDate && c.expiryDate !== "none" ? c.expiryDate : "Non-expiring"];
          })}
        />
      </>
    ),
    inbound: (
      <>
        {renderSummary([
          ["Inward roots", appData.inwardConsignments.length, "primary"],
          ["Total inward docs", appData.inward.length, "primary"],
          ["GRN raised", grns.length, "success"],
          ["Pending inward QC", appData.inwardConsignments.filter((c) => c.currentStage && c.currentStage <= 4).length, "warning"],
        ])}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
          {Object.entries(inCounts).map(([label, count]) => (
            <div key={label} style={{ background: c.card, border: `1px solid ${c.border}` }} className="rounded-md p-3 flex items-center justify-between">
              <span style={{ color: c.muted }} className="text-xs">{label}</span>
              <span style={{ color: c.text }} className="font-semibold text-sm">{count}</span>
            </div>
          ))}
        </div>
        <Table
          columns={["GRN #", "Batch", "Product", "Bin", "Date"]}
          rows={grns.map((r) => {
            const p = appData.products.find((x) => x.id === r.productId);
            return [r.id, r.commonNumber, p ? p.name : "—", r.binRef || "—", r.createdAt];
          })}
        />
      </>
    ),
    outbound: (
      <>
        {renderSummary([
          ["Outward consignments", appData.outwardConsignments.length, "primary"],
          ["Total outward docs", appData.outward.length, "primary"],
          ["Dispatched", appData.outwardConsignments.filter((c) => c.currentStage >= 5).length, "success"],
          ["Pending outward QC", appData.outwardConsignments.filter((c) => c.currentStage && c.currentStage <= 3).length, "warning"],
        ])}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
          {Object.entries(outCounts).map(([label, count]) => (
            <div key={label} style={{ background: c.card, border: `1px solid ${c.border}` }} className="rounded-md p-3 flex items-center justify-between">
              <span style={{ color: c.muted }} className="text-xs">{label}</span>
              <span style={{ color: c.text }} className="font-semibold text-sm">{count}</span>
            </div>
          ))}
        </div>
        <Table
          columns={["Doc #", "Batch", "Customer", "Vehicle", "Date"]}
          rows={dispatched.map((r) => [r.id, r.commonNumber, r.customer || "—", r.vehicleNo || "—", r.createdAt])}
        />
      </>
    ),
    billing: (
      <>
        {renderSummary([
          ["Total bills", appData.bills.length, "primary"],
          ["Inward value", `₹${billTotal((b) => b.flow === "Inward").toLocaleString("en-IN")}`, "success"],
          ["Outward value", `₹${billTotal((b) => b.flow === "Outward").toLocaleString("en-IN")}`, "primary"],
          ["Total value", `₹${billTotal(() => true).toLocaleString("en-IN")}`, "success"],
        ])}
        <Table
          columns={["Bill #", "Customer", "Linked doc", "Amount", "Date", "Flow", "Status"]}
          rows={appData.bills.map((b) => [
            b.billNo,
            b.customer,
            b.linkedDoc,
            b.amount,
            b.date,
            b.flow,
            b.status,
          ])}
        />
      </>
    ),
    expiry: (
      <>
        {renderSummary([
          ["Fresh", appData.products.filter((p) => p.status === "fresh").length, "success"],
          ["Near expiry", appData.products.filter((p) => p.status === "near expiry").length, "warning"],
          ["Expired", appData.products.filter((p) => p.status === "expired").length, "danger"],
          ["Non-expiring", appData.products.filter((p) => p.status === "non expiring").length, "primary"],
        ])}
        <Table
          columns={["SKU", "Product", "Category", "Expiry", "Status"]}
          rows={appData.products.map((p) => [
            p.id,
            p.name,
            p.category,
            p.expiryDate && p.expiryDate !== "none" ? p.expiryDate : "Non-expiring",
            p.status,
          ])}
        />
      </>
    ),
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b" style={{ borderColor: c.border }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-3.5 py-2 rounded-t-md text-xs sm:text-sm font-medium whitespace-nowrap"
            style={{
              color: tab === t.id ? c.primary : c.muted,
              borderBottom: tab === t.id ? `2px solid ${c.primary}` : "2px solid transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>{content[tab]}</div>
    </div>
  );
}

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [openSection, setOpenSection] = useState(null);
  const [activePage, setActivePage] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [forms, setForms] = useState([]);
  const [appData, setAppData] = useState(initialAppData);
  const [savedWorkflowRows, setSavedWorkflowRows] = useState([]);
  const [detail, setDetail] = useState(null);
  const idRef = useRef(0);
  const zRef = useRef(60);
  const cascadeRef = useRef(0);
  const { fresh, near, expired, non, total } = useMemo(() => {
    const counts = appData.products.reduce(
      (acc, product) => {
        const status = product.status;
        if (status === "fresh") acc.fresh++;
        else if (status === "near expiry") acc.near++;
        else if (status === "expired") acc.expired++;
        else if (status === "non expiring") acc.non++;
        return acc;
      },
      { fresh: 0, near: 0, expired: 0, non: 0 },
    );
    return {
      ...counts,
      total: counts.fresh + counts.near + counts.expired + counts.non,
    };
  }, [appData.products]);

  // Pipeline counts: number of completed stage records at or beyond each step
  // in the (now hierarchical) inward tree.
  const inwardCounts = useMemo(() => {
    const acc = Object.fromEntries(IN_TYPE_KEYS.map((k) => [k, 0]));
    const byType = { preGateInward: 0, gateInward: 0, inward: 0, checklistUnloading: 0, qualityCheck: 0, goodReceiptNote: 0 };
    appData.inward.forEach((r) => {
      if (r.status === "completed" && byType[r.type] !== undefined) byType[r.type]++;
    });
    IN_TYPE_KEYS.forEach((key, idx) => {
      // funnel: records at this stage or deeper
      for (let j = idx; j < IN_TYPE_KEYS.length; j++) acc[IN_TYPE_KEYS[j]] += byType[key];
    });
    return acc;
  }, [appData.inward]);

  const outwardCounts = useMemo(() => {
    const acc = {
      pickList: 0,
      pick: 0,
      qualityCheckOutward: 0,
      checklistLoading: 0,
      dispatch: 0,
      outward: 0,
    };
    appData.outwardConsignments.forEach((c) => {
      const stage = c.currentStage || 0;
      OUT_TYPE_KEYS.forEach((key, idx) => {
        if (stage >= idx + 1) acc[key]++;
      });
    });
    return acc;
  }, [appData.outwardConsignments]);

  // Derived lists for tables from real data
  // Build the inward flow as a tree keyed by parentId, rooted at PreGateInward.
  const inwardRows = useMemo(() => {
    const nodesById = {};
    const byParent = {};
    appData.inward.forEach((rec) => {
      const typeMeta = IN_STAGE_META.find((m) => m.key === rec.type);
      const prod =
        rec.productId &&
        appData.products.find((p) => p.id === rec.productId);
      nodesById[rec.id] = {
        id: rec.id,
        docBase: rec.rootId || rec.id,
        documentId: rec.id,
        party: rec.customer || rec.vendor || "—",
        ref: rec.vehicleNo || "—",
        productName: prod ? prod.name : null,
        productId: rec.productId || null,
        binRef: rec.binRef || null,
        step: typeMeta ? IN_STAGE_META.indexOf(typeMeta) + 1 : 1,
        stageLabel: typeMeta ? typeMeta.label : rec.type,
        tone:
          rec.status === "completed"
            ? "success"
            : primaryForStep((typeMeta ? IN_STAGE_META.indexOf(typeMeta) : 0) + 1),
        flow: "inward",
        children: [],
      };
      const parentKey = rec.parentId || "__root__";
      (byParent[parentKey] = byParent[parentKey] || []).push(rec.id);
    });
    // attach children in insertion order
    appData.inward.forEach((rec) => {
      const kids = byParent[rec.id] || [];
      nodesById[rec.id].children = kids.map((id) => nodesById[id]);
    });
    const roots = (byParent["__root__"] || []).map((id) => nodesById[id]);
    return roots;
  }, [appData]);

  const outwardRows = useMemo(() => {
    const nodesById = {};
    const byParent = {};
    appData.outward.forEach((rec) => {
      const typeMeta = OUT_STAGE_META.find((m) => m.key === rec.type);
      const prod =
        rec.productId &&
        appData.products.find((p) => p.id === rec.productId);
      nodesById[rec.id] = {
        id: rec.id,
        docBase: rec.rootId || rec.id,
        documentId: rec.id,
        party: rec.customer || "—",
        ref: rec.vehicleNo || "—",
        productName: prod ? prod.name : null,
        productId: rec.productId || null,
        binRef: rec.binRef || null,
        step: typeMeta ? OUT_STAGE_META.indexOf(typeMeta) + 1 : 1,
        stageLabel: typeMeta ? typeMeta.label : rec.type,
        tone:
          rec.status === "completed"
            ? "success"
            : primaryForStep((typeMeta ? OUT_STAGE_META.indexOf(typeMeta) : 0) + 1),
        flow: "outward",
        children: [],
      };
      const parentKey = rec.parentId || "__root__";
      (byParent[parentKey] = byParent[parentKey] || []).push(rec.id);
    });
    appData.outward.forEach((rec) => {
      const kids = byParent[rec.id] || [];
      nodesById[rec.id].children = kids.map((id) => nodesById[id]);
    });
    const roots = (byParent["__root__"] || []).map((id) => nodesById[id]);
    return roots;
  }, [appData]);

  // Dashboard summary stats computed from real data
  const dashboardStats = useMemo(() => {
    const cellStatus = (s) =>
      s && typeof s === "object" ? s.status : s && s !== "empty" ? s : s;
    const totalBins = appData.bins.cells.length;
    const occupiedBins = appData.bins.cells.filter(
      (s) => s && (typeof s !== "string" || s !== "empty"),
    ).length;
    const utilization = totalBins
      ? Math.round((occupiedBins / totalBins) * 100)
      : 0;

    // QC waiting = consignments whose current stage is QC (qualityCheck / qualityCheckOutward)
    const pendingInwardQC = appData.inwardConsignments.filter(
      (c) => c.currentStage && c.currentStage <= 4,
    ).length;
    const pendingOutwardQC = appData.outwardConsignments.filter(
      (c) => c.currentStage && c.currentStage <= 3,
    ).length;

    // Dispatches = outward consignments that have reached dispatch or beyond
    const dispatched = appData.outwardConsignments.filter(
      (c) => c.currentStage >= 5,
    ).length;

    const binsDetail = {};
    appData.bins.cells.forEach((s) => {
      const key = cellStatus(s) || "empty";
      binsDetail[key] = (binsDetail[key] || 0) + 1;
    });

    return {
      utilization,
      occupiedBins,
      totalBins,
      binsDetail,
      pendingInwardQC,
      pendingOutwardQC,
      dispatched,
    };
  }, [appData]);

  const openForm = (config) => {
    idRef.current += 1;
    zRef.current += 1;
    const idx = cascadeRef.current % 6;
    cascadeRef.current += 1;
    const newForm = {
      id: idRef.current,
      minimized: false,
      zIndex: zRef.current,
      left: 60 + idx * 34,
      top: 50 + idx * 30,
      values: config.values || {},
      photos: [],
      ...config,
    };
    setForms((prev) => [...prev, newForm]);
  };

  const updateForm = (id, patch) =>
    setForms((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const moveForm = (id, left, top) =>
    setForms((prev) =>
      prev.map((f) => (f.id === id ? { ...f, left, top } : f)),
    );
  const closeForm = (id) => setForms((prev) => prev.filter((f) => f.id !== id));
  const minimizeForm = (id) => updateForm(id, { minimized: true });
  const restoreForm = (id) => {
    zRef.current += 1;
    updateForm(id, { minimized: false, zIndex: zRef.current });
  };
  const focusForm = (id) => {
    zRef.current += 1;
    updateForm(id, { zIndex: zRef.current });
  };
  const changeField = (id, key, val) =>
    setForms((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, values: { ...f.values, [key]: val } } : f,
      ),
    );

  const addChildForm = (parentId) =>
    setForms((previousForms) =>
      previousForms.map((form) => {
        if (form.id !== parentId || !form.flowStages) return form;
        const childStageIndex = form.stageIndex;
        const childPrefix = (form.tone === "inward" ? IN_PREFIXES : OUT_PREFIXES)[childStageIndex] || "DOC";
        const childId = childHierarchyId(childPrefix, genBaseDoc());
        const child = {
          id: childId,
          docId: childId,
          stageIndex: childStageIndex,
          stageLabel: form.flowStages[childStageIndex],
          values: {},
          open: true,
          saved: false,
        };
        return { ...form, childForms: [...(form.childForms || []), child] };
      }),
    );

  const removeChildForm = (parentId, childId) =>
    setForms((previousForms) =>
      previousForms.map((form) =>
        form.id !== parentId
          ? form
          : {
              ...form,
              childForms: (form.childForms || []).filter((c) => c.id !== childId),
            },
      ),
    );

  const updateChildForm = (parentId, childId, key, value) =>
    setForms((previousForms) =>
      previousForms.map((form) =>
        form.id !== parentId
          ? form
          : {
              ...form,
              childForms: form.childForms.map((child) =>
                child.id === childId
                  ? { ...child, values: { ...child.values, [key]: value } }
                  : child,
              ),
            },
      ),
    );

  const toggleChildForm = (parentId, childId) =>
    setForms((previousForms) =>
      previousForms.map((form) =>
        form.id !== parentId
          ? form
          : {
              ...form,
              childForms: form.childForms.map((child) =>
                child.id === childId ? { ...child, open: !child.open } : child,
              ),
            },
      ),
    );

  const saveChildForm = (parentId, childId) => {
    const parent = forms.find((form) => form.id === parentId);
    const child = parent?.childForms?.find((item) => item.id === childId);
    if (!parent || !child || child.saved) return;

    const collection = parent.tone === "inward" ? "inward" : "outward";
    const typeKeys = parent.tone === "inward" ? IN_TYPE_KEYS : OUT_TYPE_KEYS;
    const parentDocId =
      parent.documentId ||
      getStepDocNo(parent.docBase, parent.tone, parent.stageIndex);
    const record = {
      id: child.docId,
      type: typeKeys[child.stageIndex] || child.stageLabel,
      parentId: parentDocId,
      rootId:
        parent.documentId && parent.documentId.startsWith("PR-")
          ? parent.documentId
          : undefined,
      commonNumber: child.values.commonNumber || parent.docBase,
      status: child.values.status || "pending",
      values: child.values,
    };

    setAppData((previousData) => ({
      ...previousData,
      [collection]: [...previousData[collection], record],
    }));
    setSavedWorkflowRows((previousRows) => [
      ...previousRows,
      {
        documentId: child.docId,
        docBase: parent.docBase,
        party: child.values.vendor || child.values.customer || "New consignment",
        ref: child.values.vehicleNo || child.values.ewayBill || "—",
        step: child.stageIndex + 1,
        stageLabel: child.stageLabel,
        tone: "primary",
        flow: parent.tone,
      },
    ]);
    setForms((previousForms) =>
      previousForms.map((form) =>
        form.id !== parentId
          ? form
          : {
              ...form,
              childForms: form.childForms.map((item) =>
                item.id === childId ? { ...item, saved: true } : item,
              ),
            },
      ),
    );
  };

  const addPhotoToForm = (id, photoUrl) =>
    setForms((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, photos: [...(f.photos || []), photoUrl] } : f,
      ),
    );

  const removePhotoFromForm = (id, photoIndex) =>
    setForms((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              photos: (f.photos || []).filter((_, idx) => idx !== photoIndex),
            }
          : f,
      ),
    );

  const stepForm = (id, dir) =>
    setForms((prev) =>
      prev.map((f) => {
        if (f.id !== id || !f.flowStages) return f;
        const next = Math.min(
          f.flowStages.length - 1,
          Math.max(0, f.stageIndex + dir),
        );
        return { ...f, stageIndex: next };
      }),
    );

  const saveForm = (id) => {
    const form = forms.find((f) => f.id === id);
    if (!form) return;
    const values = form.values || {};
    const collection = form.tone && form.tone.includes("inward") ? "inward" : "outward";

    // Build a primary-key record. If this is a workflow form, we create a stage record
    // keyed off the consignment's common number so it can be linked as a foreign key later.
    const commonNumber =
      values.commonNumber ||
      (form.flowStages
        ? `${form.tone === "inward" ? "CN-IN" : "CN-OUT"}-${Date.now().toString().slice(-6)}`
        : `${form.tone === "inward" ? "I" : "O"}${Date.now().toString().slice(-6)}`);

    const recordId =
      values.id ||
      (form.documentId ||
        (form.flowStages
          ? getStepDocNo(form.docBase || String(genBaseDoc()), form.tone, form.stageIndex || 0)
          : `${String(form.tone || "DOC").toUpperCase()}-${genBaseDoc()}`));

    const existing = (appData[collection] || []).find((x) => x.id === recordId);
    const typeKey = form.flowStages
      ? (form.tone === "inward" ? IN_TYPE_KEYS : OUT_TYPE_KEYS)[form.stageIndex || 0]
      : form.title;

    if (existing) {
      // EDIT mode: merge edited values into the existing record, preserving
      // relational keys (id, type, parentId, commonNumber, sequence, status).
      const merged = {
        ...existing,
        values,
        customer:
          values.customer !== undefined ? values.customer : existing.customer,
        vendor: values.vendor !== undefined ? values.vendor : existing.vendor,
        vehicleNo:
          values.vehicleNo !== undefined ? values.vehicleNo : existing.vehicleNo,
        productId:
          values.productId !== undefined ? values.productId : existing.productId,
        binRef: values.binRef !== undefined ? values.binRef : existing.binRef,
      };
      setAppData((prev) => ({
        ...prev,
        [collection]: prev[collection].map((x) =>
          x.id === recordId ? merged : x,
        ),
      }));
      closeForm(id);
      return;
    }

    const newRecord = {
      id: recordId,
      type: typeKey,
      commonNumber,
      parentId: values.parentId || null,
      status: values.status || "completed",
      values,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    setAppData((prev) => ({
      ...prev,
      [collection]: [...prev[collection], newRecord],
    }));
    setSavedWorkflowRows((prev) => [
      ...prev,
      {
        documentId: newRecord.id,
        docBase: form.docBase,
        party: values.vendor || values.customer || "New consignment",
        ref: values.vehicleNo || values.ewayBill || "—",
        step: (form.stageIndex || 0) + 1,
        stageLabel: form.flowStages
          ? form.flowStages[form.stageIndex || 0]
          : form.title,
        tone: "primary",
        flow: form.tone ? (form.tone.includes("inward") ? "inward" : "outward") : "simple",
      },
    ]);
    closeForm(id);
  };
  const saveAndCopy = (id) => {
    const f = forms.find((x) => x.id === id);
    if (!f) return;
    closeForm(id);
    openForm({
      kind: f.kind,
      title: f.title,
      tone: f.tone,
      flowStages: f.flowStages,
      stageIndex: f.flowStages ? f.stageIndex : undefined,
      docBase: f.flowStages ? genBaseDoc() : undefined,
      values: { ...f.values },
    });
  };

  const openSimpleForm = (title, tone = "simple", hidePhoto = false, initialValues = {}, fields = null) =>
    openForm({ kind: "simple", title, tone, hidePhoto, values: initialValues, fields });

  // Build form values from an existing stage record, keeping only fields that
  // the current stage's form can edit (so JSON data round-trips correctly).
  const recordToValues = (record, tone) => {
    if (!record) return {};
    const stages = tone === "inward" ? IN_STAGE_META : OUT_STAGE_META;
    const fieldKeys = [];
    stages.forEach((meta) => {
      const fields = STAGE_FIELDS[meta.label];
      if (fields) fields.forEach((f) => fieldKeys.push(f.key));
    });
    const out = {};
    fieldKeys.forEach((key) => {
      if (record[key] != null && record[key] !== "") out[key] = record[key];
    });
    out.id = record.id;
    if (record.commonNumber) out.commonNumber = record.commonNumber;
    if (record.productId) out.productId = record.productId;
    if (record.binRef) out.binRef = record.binRef;
    return out;
  };

  // When opening an existing workflow document for edit, seed collapsible
  // child forms for the ENTIRE tree (from the consignment root down) so every
  // stage has its saved data whether you navigate forward OR backward with the
  // stepper. Values are pulled from each record's direct fields (records store
  // stage fields top-level, not in a `values` object).
  const seedChildForms = (flow, documentId, stageIndex) => {
    if (!documentId) return [];
    const col = flow === "inward" ? "inward" : "outward";
    const keys = flow === "inward" ? IN_TYPE_KEYS : OUT_TYPE_KEYS;
    const stagesArr = flow === "inward" ? INWARD_STAGES : OUTWARD_STAGES;
    const all = appData[col] || [];
    const byParent = {};
    all.forEach((r) => {
      (byParent[r.parentId] = byParent[r.parentId] || []).push(r);
    });

    // Walk up the parent chain to the consignment ROOT so earlier stages are
    // included too (otherwise going Back to a previous step is blank).
    let rec = all.find((r) => r.id === documentId) || null;
    const seen = new Set();
    while (rec && rec.parentId && !seen.has(rec.parentId)) {
      seen.add(rec.parentId);
      const p = all.find((r) => r.id === rec.parentId);
      if (!p) break;
      rec = p;
    }
    const rootId = rec ? rec.id : documentId;

    const forms = [];
    const collect = (r) => {
      const stIdx = keys.indexOf(r.type);
      const label = stagesArr[stIdx] || stagesArr[0];
      forms.push({
        id: r.id,
        docId: r.id,
        stageIndex: stIdx >= 0 ? stIdx : 0,
        stageLabel: label,
        values: recordToValues(r, flow),
        open: r.id === documentId,
        saved: true,
        isSelf: r.id === documentId,
      });
      (byParent[r.id] || []).forEach(collect);
    };
    const root = all.find((r) => r.id === rootId);
    if (root) collect(root);
    return forms;
  };

  const openInwardForm = (stageIndex = 0, docBase = "3021", documentId, values = {}) =>
    openForm({
      kind: "workflow",
      tone: "inward",
      flowStages: INWARD_STAGES,
      stageIndex,
      docBase,
      documentId,
      values,
      isEdit: !!documentId,
      childForms: seedChildForms("inward", documentId, stageIndex),
    });
  const openOutwardForm = (stageIndex = 0, docBase = "0552", documentId, values = {}) =>
    openForm({
      kind: "workflow",
      tone: "outward",
      flowStages: OUTWARD_STAGES,
      stageIndex,
      docBase,
      documentId,
      values,
      isEdit: !!documentId,
      childForms: seedChildForms("outward", documentId, stageIndex),
    });

  // Masters CRUD -> persistent appData + soft-delete via Recycle Bin.
  const MASTER_FIELDS = {
    customers: ["id", "name", "gstin", "city", "contact"],
    products: ["id", "name", "category", "unit", "reorderLevel", "expiryDate", "status"],
    vendors: ["id", "name", "gstin", "city", "contact"],
    locations: ["code", "zone", "capacity", "status"],
    users: ["id", "name", "role", "status"],
  };

  const addMaster = (collection, row) =>
    setAppData((prev) => {
      const fields = MASTER_FIELDS[collection] || [];
      const record = {};
      fields.forEach((k, i) => {
        record[k] = row[i] !== undefined ? row[i] : "";
      });
      return { ...prev, [collection]: [...(prev[collection] || []), record] };
    });

  const updateMaster = (collection, row, index) =>
    setAppData((prev) => {
      const fields = MASTER_FIELDS[collection] || [];
      const record = {};
      fields.forEach((k, i) => {
        record[k] = row[i] !== undefined ? row[i] : "";
      });
      const list = prev[collection] || [];
      const idx = index >= 0 && index < list.length ? index : -1;
      const updated = list.map((r, i) => (i === idx ? record : r));
      return { ...prev, [collection]: updated };
    });

  const moveToTrash = (collection, index) =>
    setAppData((prev) => {
      const list = prev[collection] || [];
      const record = list[index];
      if (!record) return prev;
      return {
        ...prev,
        [collection]: list.filter((_, i) => i !== index),
        trash: [
          ...prev.trash,
          { collection, record, deletedAt: new Date().toISOString().slice(0, 10) },
        ],
      };
    });

  const restoreFromTrash = (trashIndex) =>
    setAppData((prev) => {
      const item = prev.trash[trashIndex];
      if (!item) return prev;
      const nextTrash = prev.trash.filter((_, i) => i !== trashIndex);

      // Single stage/document record (e.g. one Quality Check) -> restore into flow list.
      if (item.kind === "stageRecord" && item.flow && item.record) {
        return {
          ...prev,
          trash: nextTrash,
          [item.flow]: [...(prev[item.flow] || []), item.record],
        };
      }

      // Whole consignment tree (root delete) -> restore consignment + all stage records.
      if (item.kind === "transaction" && item.flow) {
        const consignmentCol =
          item.flow === "inward" ? "inwardConsignments" : "outwardConsignments";
        return {
          ...prev,
          trash: nextTrash,
          [item.flow]: [...(prev[item.flow] || []), ...(item.stageRecords || [])],
          [consignmentCol]: item.consignment
            ? [...(prev[consignmentCol] || []), item.consignment]
            : prev[consignmentCol],
        };
      }

      // Master record -> restore into its collection.
      return {
        ...prev,
        trash: nextTrash,
        [item.collection]: [...(prev[item.collection] || []), item.record],
      };
    });

  const deletePermanently = (trashIndex) =>
    setAppData((prev) => ({
      ...prev,
      trash: prev.trash.filter((_, i) => i !== trashIndex),
    }));

  // Soft-delete a whole transaction: its consignment metadata + every stage
  // record move to the Recycle Bin as a single restore-able bundle.
  const deleteConsignment = (row) => {
    const flow = row.flow || (row.docBase && row.docBase.startsWith("INQ") ? "inward" : "outward");
    const flowKey = flow === "inward" ? "inward" : "outward";
    const targetId = row.documentId || row.id;

    // Find the target record. Child tree nodes point to a single stage record.
    const targetRecord = (appData[flowKey] || []).find((r) => r.id === targetId);

    // A node is a consignment ROOT when it has no parent (PreGateInward / outward consignment).
    const isRoot = !targetRecord || !targetRecord.parentId;
    const consignmentCol = flow === "inward" ? "inwardConsignments" : "outwardConsignments";

    if (isRoot) {
      // Deleting a root deletes its whole tree + consignment (one trash bundle).
      const rootRec =
        targetRecord ||
        (appData[flowKey] || []).find(
          (r) => r.rootId === targetId || r.id === row.docBase || r.id === targetId,
        );
      const rootId = rootRec ? rootRec.rootId || rootRec.id : targetId;
      const root = (appData[flowKey] || []).find((r) => r.id === rootId);
      const consignment = (appData[consignmentCol] || []).find(
        (c) => c.commonNumber === root?.commonNumber || c.id === row.docBase,
      );
      const treeRecords = (appData[flowKey] || []).filter(
        (r) => r.rootId === rootId || r.id === rootId || r.commonNumber === consignment?.commonNumber,
      );
      const item = {
        collection: "transaction",
        kind: "transaction",
        flow,
        consignment,
        stageRecords: treeRecords,
        deletedAt: new Date().toISOString().slice(0, 10),
      };
      setAppData((prev) => ({
        ...prev,
        trash: [...prev.trash, item],
        [flowKey]: (prev[flowKey] || []).filter(
          (r) => !treeRecords.some((x) => x.id === r.id),
        ),
        [consignmentCol]: (prev[consignmentCol] || []).filter(
          (c) => c.id !== (consignment && consignment.id),
        ),
      }));
      return;
    }

    // Delete a single stage/document record (e.g. one Quality Check) only.
    const item = {
      collection: "transaction",
      kind: "stageRecord",
      flow,
      record: targetRecord,
      deletedAt: new Date().toISOString().slice(0, 10),
    };
    setAppData((prev) => ({
      ...prev,
      trash: [...prev.trash, item],
      [flowKey]: (prev[flowKey] || []).filter((r) => r.id !== targetId),
    }));
  };

  const handleNavClick = (item) => {
    if (item.children) {
      if (collapsed) {
        setCollapsed(false);
        setOpenSection(item.id);
      } else {
        setOpenSection(openSection === item.id ? null : item.id);
      }
    } else {
      setActivePage(item.id);
      setMobileNavOpen(false);
    }
  };

  const [section, sub] = PAGE_TITLES[activePage] || ["Dashboard", null];

  const openDetail = (d) => setDetail(d);
  const closeDetail = () => setDetail(null);
  const goToPage = (pageId) => {
    setActivePage(pageId);
    setMobileNavOpen(false);
    setDetail(null);
  };

  return (
    <div
      style={{ fontFamily: "Manrope, sans-serif", background: c.surface }}
      className="relative w-full h-screen flex overflow-hidden"
    >
      {/* Mobile Drawer Overlay Backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Sidebar (Responsive Desktop & Mobile Drawer) */}
      <div
        style={{ background: c.ink }}
        className={`
          fixed md:relative z-40 h-full flex-shrink-0 flex flex-col transition-all duration-200 ease-in-out
          ${mobileNavOpen ? "translate-x-0 w-72" : "-translate-x-full md:translate-x-0"}
          ${collapsed ? "md:w-[72px]" : "md:w-[280px]"}
        `}
      >
        <div
          style={{ borderBottom: `1px solid ${c.inkLine}` }}
          className="flex items-center justify-between px-4 h-16 flex-shrink-0"
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <Warehouse size={20} color={c.primary} />
            {(!collapsed || mobileNavOpen) && (
              <span className="text-white font-semibold tracking-tight text-[15px] whitespace-nowrap">
                DEPOT
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCollapsed(!collapsed)}
              style={{ color: c.faint }}
              className="hidden md:block hover:text-white flex-shrink-0"
            >
              {collapsed ? (
                <PanelLeftOpen size={20} />
              ) : (
                <PanelLeftClose size={20} />
              )}
            </button>
            <button
              onClick={() => setMobileNavOpen(false)}
              style={{ color: c.faint }}
              className="md:hidden hover:text-white p-1"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-3 flex flex-col gap-0.5">
          {NAV.map((item) => {
            const isParentActive =
              section === item.label ||
              (item.children &&
                item.children.some((ch) => ch.id === activePage));
            return (
              <div key={item.id}>
                <button
                  onClick={() => handleNavClick(item)}
                  title={collapsed && !mobileNavOpen ? item.label : undefined}
                  style={{
                    color: isParentActive ? "#fff" : c.faint,
                    background:
                      isParentActive && !item.children
                        ? c.primary
                        : "transparent",
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium hover:text-white transition-colors ${collapsed && !mobileNavOpen ? "justify-center" : ""}`}
                >
                  <item.icon size={19} className="flex-shrink-0" />
                  {(!collapsed || mobileNavOpen) && (
                    <>
                      <span className="flex-1 text-left whitespace-nowrap">
                        {item.label}
                      </span>
                      {item.children && (
                        <ChevronDown
                          size={15}
                          style={{
                            transform:
                              openSection === item.id
                                ? "rotate(180deg)"
                                : "none",
                            transition: "transform 0.15s",
                          }}
                        />
                      )}
                    </>
                  )}
                </button>
                {(!collapsed || mobileNavOpen) &&
                  item.children &&
                  openSection === item.id && (
                    <div className="flex flex-col pl-11 pr-2 pb-1">
                      {item.children.map((ch) => (
                        <button
                          key={ch.id}
                          onClick={() => {
                            setActivePage(ch.id);
                            setMobileNavOpen(false);
                          }}
                          style={{
                            color: activePage === ch.id ? c.primary : c.faint,
                          }}
                          className="text-left text-sm py-1.5 hover:text-white whitespace-nowrap"
                        >
                          {ch.label}
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            );
          })}
        </div>

        <div
          style={{ borderTop: `1px solid ${c.inkLine}` }}
          className={`flex items-center gap-2.5 px-4 h-16 flex-shrink-0 ${collapsed && !mobileNavOpen ? "justify-center" : ""}`}
        >
          <div
            style={{ background: c.inkSoft }}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          >
            <User size={16} color={c.faint} />
          </div>
          {(!collapsed || mobileNavOpen) && (
            <div className="overflow-hidden">
              <div className="text-white text-sm font-medium whitespace-nowrap">
                R. Deshpande
              </div>
              <div
                style={{ color: c.faint }}
                className="text-xs whitespace-nowrap"
              >
                Warehouse Manager
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        {/* Header Bar */}
        <div
          style={{ background: c.card, borderBottom: `1px solid ${c.border}` }}
          className="h-16 flex-shrink-0 flex items-center justify-between px-4 sm:px-6"
        >
          <div className="flex items-center gap-3">
            {/* Hamburger Button on Mobile */}
            <button
              onClick={() => setMobileNavOpen(true)}
              style={{ color: c.text }}
              className="md:hidden p-1.5 rounded-md hover:bg-gray-100 focus:outline-none"
              title="Open Menu"
            >
              <Menu size={22} />
            </button>

            <div
              style={{ color: c.muted }}
              className="text-xs sm:text-sm font-medium"
            >
              {section}
              {sub && (
                <>
                  <span className="mx-1.5">/</span>
                  <span style={{ color: c.text }} className="font-semibold">
                    {sub}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Real-time Working Search Bar (Visible on mobile & desktop) */}
            <div className="relative">
              <Search
                size={15}
                style={{ color: c.faint }}
                className="absolute left-3 top-1/2 -translate-y-1/2"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                style={{
                  borderColor: c.border,
                  background: c.surface,
                  color: c.text,
                }}
                className="pl-8 pr-7 py-1.5 rounded-md border text-xs sm:text-sm outline-none w-36 sm:w-64 focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
            <Bell
              size={18}
              style={{ color: c.muted }}
              className="hidden sm:block"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 sm:pb-16">
          {activePage === "dashboard" && (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Bin utilization"
                  value={`${dashboardStats.utilization}%`}
                  sub={{
                    pct: dashboardStats.utilization,
                    text: `${dashboardStats.occupiedBins} / ${dashboardStats.totalBins}`,
                  }}
                  tone="primary"
                  onClick={() =>
                    openDetail({
                      title: "Bin utilization",
                      subtitle: `${dashboardStats.occupiedBins} of ${dashboardStats.totalBins} bins occupied (${dashboardStats.utilization}%)`,
                      columns: ["Bin", "Status", "Product"],
                      rows: appData.bins.cells.map((c, i) => {
                        const bin = c && c.bin ? c.bin : `Bin ${i + 1}`;
                        if (c === "empty") return [bin, "Empty", "—"];
                        return [bin, c.status || "—", c.productName || "—"];
                      }),
                      linkLabel: "Open Bin Locations",
                      onLink: () => goToPage("masters-locations"),
                    })
                  }
                  tooltip={[
                    [
                      "Fresh",
                      dashboardStats.binsDetail?.fresh || 0,
                      "#188A5A",
                    ],
                    [
                      "Non-expiring",
                      dashboardStats.binsDetail?.["non expiring"] || 0,
                      "#2F6FED",
                    ],
                    [
                      "Near expiry",
                      dashboardStats.binsDetail?.["near expiry"] || 0,
                      "#D23C3C",
                    ],
                    [
                      "Expired",
                      dashboardStats.binsDetail?.expired || 0,
                      "#000000",
                    ],
                    [
                      "Empty",
                      dashboardStats.binsDetail?.empty || 0,
                      "#E3E7EC",
                    ],
                  ]}
                />
                <StatCard
                  label="Pending inward QC"
                  value={dashboardStats.pendingInwardQC}
                  sub={{ pct: 45, text: "lots waiting" }}
                  tone="warning"
                  onClick={() =>
                    openDetail({
                      title: "Pending inward QC",
                      subtitle: "Consignments still moving through inward QC stages",
                      columns: ["Batch", "Customer", "Stage", "Date"],
                      rows: appData.inwardConsignments
                        .filter((c) => c.currentStage && c.currentStage <= 4)
                        .map((c) => [
                          c.commonNumber,
                          c.customer || "—",
                          IN_STAGE_META[(c.currentStage || 1) - 1]?.label || "—",
                          c.createdDate,
                        ]),
                      linkLabel: "Open Inward",
                      onLink: () => goToPage("txn-inward"),
                    })
                  }
                />
                <StatCard
                  label="Pending outward QC"
                  value={dashboardStats.pendingOutwardQC}
                  sub={{ pct: 28, text: "lots waiting" }}
                  tone="warning"
                  onClick={() =>
                    openDetail({
                      title: "Pending outward QC",
                      subtitle: "Consignments still moving through outward QC stages",
                      columns: ["Batch", "Customer", "Vehicle", "Stage"],
                      rows: appData.outwardConsignments
                        .filter((c) => c.currentStage && c.currentStage <= 3)
                        .map((c) => [
                          c.commonNumber,
                          c.customer || "—",
                          c.vehicleNo || "—",
                          OUT_STAGE_META[(c.currentStage || 1) - 1]?.label || "—",
                        ]),
                      linkLabel: "Open Outward",
                      onLink: () => goToPage("txn-outward"),
                    })
                  }
                />
                <StatCard
                  label="Today's dispatches"
                  value={dashboardStats.dispatched}
                  sub={{ pct: 80, text: "dispatched to date" }}
                  tone="success"
                  onClick={() =>
                    openDetail({
                      title: "Dispatched consignments",
                      subtitle: "Outward consignments that reached Dispatch or beyond",
                      columns: ["Batch", "Customer", "Vehicle", "Stage"],
                      rows: appData.outwardConsignments
                        .filter((c) => c.currentStage >= 5)
                        .map((c) => [
                          c.commonNumber,
                          c.customer || "—",
                          c.vehicleNo || "—",
                          OUT_STAGE_META[(c.currentStage || 1) - 1]?.label || "—",
                        ]),
                      linkLabel: "Open Outward",
                      onLink: () => goToPage("txn-outward"),
                    })
                  }
                />
              </div>

              <BinMap
                bins={appData.bins}
                onSelectCell={(entry, i) =>
                  openDetail({
                    title: entry === "empty" ? "Empty bin" : (entry.bin || `Bin ${i + 1}`),
                    subtitle: entry === "empty" ? "Slot freed by dispatch" : "Occupied bin details",
                    columns: ["Field", "Value"],
                    rows:
                      entry === "empty"
                        ? [["Status", "Empty"]]
                        : [
                            ["Bin", entry.bin || `Bin ${i + 1}`],
                            ["Product", entry.productName || "—"],
                            ["SKU", entry.productId || "—"],
                            ["Category", entry.category || "—"],
                            ["Status", entry.status || "—"],
                            ["Expiry", entry.expiryDate && entry.expiryDate !== "none" ? entry.expiryDate : "Non-expiring"],
                          ],
                    linkLabel: "Open Bin Locations",
                    onLink: () => goToPage("masters-locations"),
                  })
                }
              />

              <StatCard
                label="Product expiry"
                value={`Fresh ${fresh}, Near ${near}, Expired ${expired}, Non‑expiring ${non}`}
                sub={{ pct: total ? Math.round(((fresh + near + non) / total) * 100) : 0, text: `${total} total SKUs` }}
                tone="primary"
                onClick={() =>
                  openDetail({
                    title: "Product expiry",
                    subtitle: `${total} SKUs by shelf-life status`,
                    columns: ["SKU", "Product", "Category", "Expiry", "Status"],
                    rows: appData.products.map((p) => [
                      p.id,
                      p.name,
                      p.category,
                      p.expiryDate && p.expiryDate !== "none" ? p.expiryDate : "Non-expiring",
                      p.status,
                    ]),
                    linkLabel: "Open Products",
                    onLink: () => goToPage("masters-products"),
                  })
                }
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Pipeline
                  title="Inward pipeline — today"
                  stages={[
                    { label: "Pre Gate Inward", count: inwardCounts.preGateInward, icon: ClipboardList },
                    { label: "Gate Inward", count: inwardCounts.gateInward, icon: Truck },
                    { label: "Inward", count: inwardCounts.inward, icon: ClipboardList },
                    {
                      label: "Checklist Unloading",
                      count: inwardCounts.checklistUnloading,
                      icon: ClipboardCheck,
                    },
                    { label: "Quality Check", count: inwardCounts.qualityCheck, icon: PackageCheck },
                    { label: "Good Receipt Note", count: inwardCounts.goodReceiptNote, icon: FileCheck },
                  ]}
                  onSelectStage={(s, i) =>
                    openDetail({
                      title: `Inward · ${s.label}`,
                      subtitle: `${s.count} records at this stage`,
                      columns: ["Doc #", "Batch", "Product", "Bin", "Date"],
                      rows: appData.inward
                        .filter((r) => IN_STAGE_META[i] && r.type === IN_STAGE_META[i].key)
                        .map((r) => {
                          const p = appData.products.find((x) => x.id === r.productId);
                          return [r.id, r.commonNumber, p ? p.name : "—", r.binRef || "—", r.createdAt || "—"];
                        }),
                      linkLabel: "Open Inward",
                      onLink: () => goToPage("txn-inward"),
                    })
                  }
                />
                <Pipeline
                  title="Outward pipeline — today"
                  stages={[
                    { label: "Pick List", count: outwardCounts.pickList, icon: ClipboardList },
                    { label: "Pick", count: outwardCounts.pick, icon: PackageCheck },
                    { label: "QC Outward", count: outwardCounts.qualityCheckOutward, icon: ClipboardCheck },
                    {
                      label: "Checklist Loading",
                      count: outwardCounts.checklistLoading,
                      icon: ClipboardList,
                    },
                    { label: "Dispatch", count: outwardCounts.dispatch, icon: Truck },
                    { label: "Outward", count: outwardCounts.outward, icon: FileCheck },
                  ]}
                  onSelectStage={(s, i) =>
                    openDetail({
                      title: `Outward · ${s.label}`,
                      subtitle: `${s.count} records at this stage`,
                      columns: ["Doc #", "Batch", "Customer", "Vehicle", "Date"],
                      rows: appData.outward
                        .filter((r) => OUT_STAGE_META[i] && r.type === OUT_STAGE_META[i].key)
                        .map((r) => [r.id, r.commonNumber, r.customer || "—", r.vehicleNo || "—", r.createdAt || "—"]),
                      linkLabel: "Open Outward",
                      onLink: () => goToPage("txn-outward"),
                    })
                  }
                />
              </div>

              <ActivityTable
                searchQuery={searchQuery}
                inward={appData.inward}
                outward={appData.outward}
                inwardConsignments={appData.inwardConsignments}
                outwardConsignments={appData.outwardConsignments}
              />
            </div>
          )}

          {activePage === "masters-customers" && (
            <CrudPage
              title="Customers"
              note="Same list-and-edit pattern applies across every Masters screen."
              addLabel="Add Customer"
              globalSearch={searchQuery}
              columns={["Customer code", "Name", "GSTIN", "City", "Contact"]}
              rows={appData.customers.map((r) => [
                r.id,
                r.name,
                r.gstin,
                r.city,
                r.contact,
              ])}
              reservedKeys={appData.trash
                .filter((t) => t.collection === "customers")
                .map((t) => t.record && t.record.id)}
              onAdd={(row) => addMaster("customers", row)}
              onEdit={(row, idx) => updateMaster("customers", row, idx)}
              onDelete={(idx) => moveToTrash("customers", idx)}
            />
          )}

          {activePage === "masters-products" && (
            <CrudPage
              title="Products"
              note="Every SKU stored in the warehouse is registered here before it can appear on any Inward or Outward document."
              addLabel="Add Product"
              globalSearch={searchQuery}
              columns={[
                "SKU code",
                "Product name",
                "Category",
                "Unit",
                "Reorder level",
                "Expiry date",
                "Status",
              ]}
              rows={appData.products.map((p) => [
                p.id,
                p.name,
                p.category,
                p.unit,
                String(p.reorderLevel),
                p.expiryDate === "none" ? "Non-expiring" : p.expiryDate,
                p.status,
              ])}
              reservedKeys={appData.trash
                .filter((t) => t.collection === "products")
                .map((t) => t.record && t.record.id)}
              onAdd={(row) => addMaster("products", row)}
              onEdit={(row, idx) => updateMaster("products", row, idx)}
              onDelete={(idx) => moveToTrash("products", idx)}
            />
          )}

          {activePage === "masters-vendors" && (
            <CrudPage
              title="Vendors"
              note="Vendors are linked to every Gate Inward entry so goods can be traced back to source."
              addLabel="Add Vendor"
              globalSearch={searchQuery}
              columns={["Vendor code", "Name", "GSTIN", "City", "Contact"]}
              rows={appData.vendors.map((r) => [
                r.id,
                r.name,
                r.gstin,
                r.city,
                r.contact,
              ])}
              reservedKeys={appData.trash
                .filter((t) => t.collection === "vendors")
                .map((t) => t.record && t.record.id)}
              onAdd={(row) => addMaster("vendors", row)}
              onEdit={(row, idx) => updateMaster("vendors", row, idx)}
              onDelete={(idx) => moveToTrash("vendors", idx)}
            />
          )}

          {activePage === "masters-locations" && (
            <CrudPage
              title="Bin Locations"
              note="Generated from the 10 × 6 bin grid across zones A–D — bins are named {Zone}-{Row}-{Col} and sourced from Inward GRN putaway."
              addLabel="Add Bin"
              globalSearch={searchQuery}
              columns={["Bin code", "Zone", "Capacity (units)", "Status"]}
              qrIndex={0}
              rows={appData.locations.map((r) => [
                r.code,
                r.zone,
                r.capacity,
                r.status,
              ])}
              reservedKeys={appData.trash
                .filter((t) => t.collection === "locations")
                .map((t) => t.record && t.record.code)}
              onAdd={(row) => addMaster("locations", row)}
              onEdit={(row, idx) => updateMaster("locations", row, idx)}
              onDelete={(idx) => moveToTrash("locations", idx)}
            />
          )}

          {activePage === "masters-users" && (
            <CrudPage
              title="Users"
              note="Controls who can act at each stage — for example, only QC staff can clear Quality Checks."
              addLabel="Add User"
              globalSearch={searchQuery}
              columns={["User ID", "Name", "Role", "Status"]}
              rows={appData.users.map((r) => [
                r.id,
                r.name,
                r.role,
                r.status,
              ])}
              reservedKeys={appData.trash
                .filter((t) => t.collection === "users")
                .map((t) => t.record && t.record.id)}
              onAdd={(row) => addMaster("users", row)}
              onEdit={(row, idx) => updateMaster("users", row, idx)}
              onDelete={(idx) => moveToTrash("users", idx)}
            />
          )}

          {activePage === "txn-inward" && (
            <WorkflowPage
              title="Inward Consignments"
              note="Click any step in the header pipeline to filter & view document numbers for that stage."
              addLabel="New Gate Entry"
              stages={INWARD_STAGES}
              tone="inward"
              globalSearch={searchQuery}
              rows={inwardRows}
              onAdd={() => openInwardForm(0, genBaseDoc())}
              onOpenRow={(r, stepIdx) => {
                const rec = r.documentId
                  ? appData.inward.find((x) => x.id === r.documentId)
                  : null;
                const stageIndex = stepIdx !== undefined ? stepIdx : (r.step && r.step - 1) || 0;
                openInwardForm(
                  stageIndex,
                  r.docBase,
                  r.documentId,
                  recordToValues(rec, "inward"),
                );
              }}
              footnote="Outward follows the same structure across its six stages."
              onDeleteRow={deleteConsignment}
            />
          )}

          {activePage === "txn-outward" && (
            <WorkflowPage
              title="Outward Dispatches"
              note="Click any step in the header pipeline to filter & view document numbers for that stage."
              addLabel="New Pick List"
              stages={OUTWARD_STAGES}
              tone="outward"
              globalSearch={searchQuery}
              rows={outwardRows}
              onAdd={() => openOutwardForm(0, genBaseDoc())}
              onOpenRow={(r, stepIdx) => {
                const rec = r.documentId
                  ? appData.outward.find((x) => x.id === r.documentId)
                  : null;
                const stageIndex = stepIdx !== undefined ? stepIdx : (r.step && r.step - 1) || 0;
                openOutwardForm(
                  stageIndex,
                  r.docBase,
                  r.documentId,
                  recordToValues(rec, "outward"),
                );
              }}
              footnote="Inward mirrors this with its five stages."
              onDeleteRow={deleteConsignment}
            />
          )}

          {activePage === "txn-billing" && (
            <CrudPage
              title="Billing"
              note="Bills are raised against completed Inward or Outward documents."
              addLabel="New Bill"
              globalSearch={searchQuery}
              columns={[
                "Bill no.",
                "Customer",
                "Linked doc.",
                "Amount",
                "Date",
                "Flow",
                "Status",
              ]}
              rows={appData.bills.map((b) => [
                b.billNo,
                b.customer,
                b.linkedDoc,
                b.amount,
                b.date,
                b.flow,
                b.status,
              ])}
              onAdd={() => openSimpleForm("New Bill", "simple", true, {}, STAGE_FIELDS["Bill"])}
              onEdit={(row) =>
                openSimpleForm(`Edit Bill — ${row[0]}`, "simple", true, { amount: row[3], date: row[4], flow: row[5], customer: row[1] }, STAGE_FIELDS["Bill"])
              }
            />
          )}

          {activePage === "fin-invoices" && (
            <CrudPage
              title="Invoices"
              note="All invoices issued to customers, whether or not tied to a specific warehouse transaction."
              addLabel="New Invoice"
              globalSearch={searchQuery}
              columns={["Invoice no.", "Customer", "Date", "Amount", "Status"]}
              rows={[
                [
                  "INV-5502",
                  "Nimbus Retail Pvt Ltd",
                  "28 Aug 2026",
                  "₹18,400",
                  "Paid",
                ],
                [
                  "INV-5498",
                  "Kalash Distributors",
                  "27 Aug 2026",
                  "₹9,750",
                  "Pending",
                ],
                [
                  "INV-5491",
                  "Meridian Textiles",
                  "24 Aug 2026",
                  "₹22,900",
                  "Overdue",
                ],
              ]}
              onAdd={() => openSimpleForm("New Invoice")}
              onEdit={(row) => openSimpleForm(`Edit Invoice — ${row[0]}`)}
            />
          )}

          {activePage === "fin-payments" && (
            <CrudPage
              title="Payments"
              note="Payments received against invoices, reconciled by reference number."
              addLabel="Record Payment"
              globalSearch={searchQuery}
              columns={[
                "Payment ID",
                "Customer",
                "Invoice ref.",
                "Amount",
                "Mode",
              ]}
              rows={[
                [
                  "PAY-2210",
                  "Nimbus Retail Pvt Ltd",
                  "INV-5502",
                  "₹18,400",
                  "Bank Transfer",
                ],
                ["PAY-2204", "Aravali Foods", "INV-5480", "₹6,300", "UPI"],
                ["PAY-2196", "Orbit Hardware", "INV-5471", "₹11,050", "Cheque"],
              ]}
              onAdd={() => openSimpleForm("Record Payment")}
              onEdit={(row) => openSimpleForm(`Edit Payment — ${row[0]}`)}
            />
          )}

          {activePage === "attendance" && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2
                    style={{ color: c.text }}
                    className="text-lg sm:text-xl font-semibold"
                  >
                    Attendance & MHE Operations
                  </h2>
                  <p
                    style={{ color: c.muted }}
                    className="text-xs sm:text-sm mt-1"
                  >
                    Manage daily labor shifts, contractor headcounts, and MHE
                    equipment status.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      openSimpleForm("Labour Attendance", "simple")
                    }
                    style={{ background: c.primary }}
                    className="text-white px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium flex items-center gap-1.5 hover:opacity-90"
                  >
                    <Plus size={16} /> Record Labour Attendance
                  </button>
                  <button
                    onClick={() => openSimpleForm("MHE Attendance", "outward")}
                    style={{ background: c.inkSoft, borderColor: c.inkLine }}
                    className="text-white px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium flex items-center gap-1.5 hover:bg-gray-800"
                  >
                    <Wrench size={16} /> Log MHE Status
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Labour On-Duty"
                  value="42 / 50"
                  sub={{ pct: 84, text: "84% shift coverage" }}
                  tone="success"
                />
                <StatCard
                  label="Contractor Staff"
                  value="28"
                  sub={{ pct: 70, text: "Apex & Spot Agency" }}
                  tone="primary"
                />
                <StatCard
                  label="Active MHE Fleet"
                  value="12 / 15"
                  sub={{ pct: 80, text: "3 in maintenance" }}
                  tone="warning"
                />
                <StatCard
                  label="Logged Machine Hours"
                  value="86.5 h"
                  sub={{ pct: 90, text: "Today's usage" }}
                  tone="success"
                />
              </div>

              <CrudPage
                title="Labour Attendance"
                note="Real-time shift log for warehouse operators, loaders, and contractor workers."
                addLabel="Record Labour Attendance"
                globalSearch={searchQuery}
                columns={[
                  "Worker ID",
                  "Name",
                  "Role / Vendor",
                  "Shift",
                  "Check-in",
                  "Status",
                ]}
                rows={[
                  [
                    "WRK-088",
                    "Ramesh Patil",
                    "Loader · Apex Logistics",
                    "Morning (8 AM - 4 PM)",
                    "07:50 AM",
                    "Present",
                  ],
                  [
                    "WRK-092",
                    "Vikram Singh",
                    "Forklift Helper · Spot Agency",
                    "Morning (8 AM - 4 PM)",
                    "08:02 AM",
                    "Present",
                  ],
                  [
                    "WRK-104",
                    "Anil Deshmukh",
                    "Packer · In-house",
                    "General (9 AM - 5 PM)",
                    "08:55 AM",
                    "Present",
                  ],
                  [
                    "WRK-077",
                    "Sanjay More",
                    "Unloader · Apex Logistics",
                    "Morning (8 AM - 4 PM)",
                    "—",
                    "Absent",
                  ],
                ]}
                onAdd={() => openSimpleForm("Labour Attendance", "simple")}
                onEdit={(row) =>
                  openSimpleForm(`Edit Attendance — ${row[0]}`, "simple")
                }
              />

              <CrudPage
                title="Material Handling Equipment (MHE) Fleet"
                note="Tracking operational availability, operator assignment, and health status for forklifts, reach trucks, and cranes."
                addLabel="Log MHE Status"
                globalSearch={searchQuery}
                columns={[
                  "MHE Code",
                  "Equipment Type",
                  "Assigned Operator",
                  "Fuel / Battery",
                  "Hours Logged",
                  "Status",
                ]}
                rows={[
                  [
                    "MHE-FL-01",
                    "2.5 Ton Electric Forklift",
                    "Suresh Shinde",
                    "88% Battery",
                    "6.5 Hrs",
                    "In Use",
                  ],
                  [
                    "MHE-RT-02",
                    "Reach Truck High-Bay",
                    "Dinesh Kadam",
                    "95% Battery",
                    "7.0 Hrs",
                    "In Use",
                  ],
                  [
                    "MHE-CR-01",
                    "10 Ton Overhead Crane",
                    "R. V. Pawar",
                    "Main Power",
                    "4.2 Hrs",
                    "Operational",
                  ],
                  [
                    "MHE-FL-03",
                    "3 Ton Diesel Forklift",
                    "Unassigned",
                    "20% Fuel",
                    "1.5 Hrs",
                    "Maintenance Hold",
                  ],
                ]}
                onAdd={() => openSimpleForm("MHE Attendance", "outward")}
                onEdit={(row) =>
                  openSimpleForm(`Update MHE — ${row[0]}`, "outward")
                }
              />
            </div>
          )}

          {activePage === "reports" && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 style={{ color: c.text }} className="text-lg sm:text-xl font-semibold">
                  Reports
                </h2>
                <p style={{ color: c.muted }} className="text-xs sm:text-sm mt-0.5">
                  Generated live from warehouse data — inventory, inbound, outbound, billing and product expiry.
                </p>
              </div>
              <ReportsPage appData={appData} />
            </div>
          )}

          {activePage === "tracktrace" && (
            <div className="flex flex-col gap-4">
              <h2
                style={{ color: c.text }}
                className="text-lg sm:text-xl font-semibold"
              >
                Track & Trace
              </h2>
              <div
                style={{ background: c.card, border: `1px solid ${c.border}` }}
                className="rounded-md p-4 sm:p-6"
              >
                <div className="relative max-w-md mb-5">
                  <Search
                    size={15}
                    style={{ color: c.faint }}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Enter GRN, doc no. or batch no."
                    style={{ borderColor: c.border, color: c.text }}
                    className="w-full pl-9 pr-3 py-2 rounded-md border text-xs sm:text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-4 pl-1">
                  {(() => {
                    const q = searchQuery.trim().toLowerCase();
                    if (!q) {
                      return (
                        <p style={{ color: c.muted }} className="text-sm">
                          Enter a GRN, batch no., or document number to trace its
                          full journey and linked bill.
                        </p>
                      );
                    }
                    // Resolve the query to a document + join billing by the
                    // SAME primary key (commonNumber).
                    const bill = appData.bills.find(
                      (b) =>
                        b.billNo.toLowerCase().includes(q) ||
                        b.linkedDoc.toLowerCase().includes(q) ||
                        b.commonNumber.toLowerCase().includes(q),
                    );
                    const ba = bill ? bill.commonNumber : null;
                    const resolveIn = (coll, m) =>
                      coll
                        .filter(
                          (r) =>
                            r.id.toLowerCase().includes(q) ||
                            (ba
                              ? r.commonNumber === ba
                              : r.commonNumber.toLowerCase().includes(q)),
                        )
                        .sort(
                          (a, b) =>
                            m.findIndex((x) => x.key === a.type) -
                            m.findIndex((x) => x.key === b.type),
                        );
                    // Pick the collection by the matched flow (bill), else guess
                    // from which of the two collections actually matches.
                    const outCand = bill && bill.flow !== "Outward" ? [] : resolveIn(appData.outward, OUT_STAGE_META);
                    const inCand = bill && bill.flow === "Outward" ? [] : resolveIn(appData.inward, IN_STAGE_META);
                    const useOutward = bill ? bill.flow === "Outward" : outCand.length > 0;
                    const meta = useOutward ? OUT_STAGE_META : IN_STAGE_META;
                    const raw = useOutward ? outCand : inCand;
                    // one step per stage (a batch has many child records per stage)
                    const seenType = new Set();
                    const resolved = raw.filter((r) => {
                      if (seenType.has(r.type)) return false;
                      seenType.add(r.type);
                      return true;
                    });
                    if (!resolved.length) {
                      return (
                        <p style={{ color: c.muted }} className="text-sm">
                          No document matches “{searchQuery}”. Try a GRN number
                          like “GRN-188” or a batch like “CN-IN-057”.
                        </p>
                      );
                    }
                    const last = resolved[resolved.length - 1];
                    const prod =
                      last.productId &&
                      appData.products.find((p) => p.id === last.productId);
                    const flow = resolved[0] && resolved[0].type.includes("preGate") ? "Inward" : "Outward";
                    return (
                      <>
                        <div
                          className="rounded-md border p-3"
                          style={{ borderColor: c.border }}
                        >
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <div style={{ color: c.muted }} className="text-[10px] font-semibold uppercase tracking-wider">
                                {flow} · {resolved[0].commonNumber}
                              </div>
                              <div style={{ color: c.text }} className="text-sm font-semibold">
                                {prod ? prod.name : "—"}
                                {last.binRef ? ` → ${last.binRef}` : ""}
                              </div>
                            </div>
                            <span
                              className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
                              style={{
                                background:
                                  flow === "Inward"
                                    ? `${c.primary}1A`
                                    : "#7C3AED1A",
                                color: flow === "Inward" ? c.primary : "#7C3AED",
                              }}
                            >
                              {flow}
                            </span>
                          </div>
                          {bill && (
                            <div
                              className="mt-2 pt-2 text-xs"
                              style={{ borderTop: `1px solid ${c.border}`, color: c.muted }}
                            >
                              <span className="font-semibold" style={{ color: c.text }}>
                                {bill.billNo}
                              </span>{" "}
                              · {bill.amount} · {bill.date} ·{" "}
                              <span
                                className="font-medium"
                                style={{
                                  color:
                                    bill.status === "Paid"
                                      ? "#16A34A"
                                      : bill.status === "Pending"
                                        ? "#D97706"
                                        : c.muted,
                                }}
                              >
                                {bill.status}
                              </span>
                            </div>
                          )}
                        </div>
                        {resolved.map((step, idx) => {
                          const m = meta.find((x) => x.key === step.type);
                          const done = step.status === "completed";
                          return (
                            <div key={step.id} className="flex items-center gap-3">
                              <div className="flex flex-col items-center">
                                <span
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{
                                    background: done ? "#16A34A" : c.faint,
                                  }}
                                />
                                {idx < resolved.length - 1 && (
                                  <span
                                    style={{ background: c.border }}
                                    className="w-px h-8"
                                  />
                                )}
                              </div>
                              <div className="flex flex-col">
                                <span
                                  style={{ color: c.text }}
                                  className="text-xs sm:text-sm font-medium"
                                >
                                  {m ? m.label : step.type}
                                  <span
                                    className="ml-2 text-[10px] font-bold uppercase"
                                    style={{ color: done ? "#16A34A" : c.faint }}
                                  >
                                    {done ? "Done" : "Pending"}
                                  </span>
                                </span>
                                <span
                                  style={{ color: c.muted }}
                                  className="text-[11px]"
                                >
                                  {step.id} · {step.createdAt}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {activePage === "recyclebin" && (
            <div className="flex flex-col gap-4">
              <h2
                style={{ color: c.text }}
                className="text-lg sm:text-xl font-semibold"
              >
                Recycle Bin
              </h2>
              <p style={{ color: c.muted }} className="text-xs sm:text-sm">
                Deleted records are held here. Restore brings an item back; Delete
                Permanently frees its name/code for reuse.
              </p>
              {appData.trash.length === 0 ? (
                <div
                  style={{ background: c.card, border: `1px solid ${c.border}` }}
                  className="rounded-md p-8 text-center text-sm"
                >
                  <p style={{ color: c.muted }}>Recycle Bin is empty.</p>
                </div>
              ) : (
                <div
                  style={{ background: c.card, border: `1px solid ${c.border}` }}
                  className="rounded-md overflow-hidden"
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm border-collapse min-w-[520px]">
                      <thead>
                        <tr style={{ color: c.muted }} className="text-left">
                          <th className="font-medium py-2 px-4">Section</th>
                          <th className="font-medium py-2 px-4">Name / Code</th>
                          <th className="font-medium py-2 px-4">Deleted on</th>
                          <th className="font-medium py-2 px-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {appData.trash.map((item, i) => {
                          const label =
                            item.record &&
                            (item.record.name ||
                              item.record.id ||
                              item.record.code ||
                              "Unnamed");
                          return (
                            <tr
                              key={i}
                              style={{ borderTop: `1px solid ${c.border}` }}
                            >
                              <td
                                className="py-3 px-4 capitalize"
                                style={{ color: c.muted }}
                              >
                                {item.collection}
                              </td>
                              <td className="py-3 px-4 font-semibold" style={{ color: c.text }}>
                                {label}
                              </td>
                              <td className="py-3 px-4" style={{ color: c.muted }}>
                                {item.deletedAt}
                              </td>
                              <td className="py-3 px-4">
                                <button
                                  onClick={() => restoreFromTrash(i)}
                                  style={{ color: c.primary }}
                                  className="text-xs sm:text-sm font-medium hover:underline mr-3 inline-flex items-center gap-1"
                                >
                                  <RotateCcw size={14} /> Restore
                                </button>
                                <button
                                  onClick={() => deletePermanently(i)}
                                  style={{ color: c.danger }}
                                  className="text-xs sm:text-sm font-medium hover:underline inline-flex items-center gap-1"
                                >
                                  <Trash2 size={14} /> Delete Permanently
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Floating / Fullpage Overlay Forms layer */}
        {forms
          .filter((f) => !f.minimized)
          .map((f) => (
            <FloatingForm
              key={f.id}
              form={f}
              onChange={changeField}
              onClose={closeForm}
              onMinimize={minimizeForm}
              onFocus={focusForm}
              onSave={saveForm}
              onSaveCopy={saveAndCopy}
              onStep={stepForm}
              onMove={moveForm}
              onAddPhoto={addPhotoToForm}
              onRemovePhoto={removePhotoFromForm}
              onAddChild={addChildForm}
              onRemoveChild={removeChildForm}
              onUpdateChild={updateChildForm}
              onSaveChild={saveChildForm}
              onToggleChild={toggleChildForm}
              binOptions={appData.binsList || []}
            />
          ))}
      </div>

      <Dock forms={forms} onRestore={restoreForm} onClose={closeForm} />

      {detail && (
        <DetailModal
          title={detail.title}
          subtitle={detail.subtitle}
          columns={detail.columns}
          rows={detail.rows}
          linkLabel={detail.linkLabel}
          onLink={detail.onLink}
          onClose={closeDetail}
        />
      )}
    </div>
  );
}
