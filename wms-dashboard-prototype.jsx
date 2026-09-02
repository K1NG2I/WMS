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
} from "lucide-react";

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

const FLOW_COLORS = { inward: "#2F6FED", outward: "#7C3AED", simple: "#334155" };

const INWARD_STAGES = ["Gate Inward", "Inward", "Checklist Unloading", "Quality Check", "Good Receipt Note"];
const OUTWARD_STAGES = ["Pick List", "Pick", "Quality Check Outward", "Checklist Loading", "Dispatch", "Outward"];

function getStepDocNo(baseId, tone, stageIndex) {
  if (!baseId) return "";
  if (tone === "inward") {
    const prefixes = ["GT-IN", "IN", "CL-IN", "QC-IN", "GRN"];
    return `${prefixes[stageIndex] || "DOC"}-${baseId}`;
  } else if (tone === "outward") {
    const prefixes = ["PK-LST", "PK", "QC-OUT", "CL-LD", "DSP", "OUT-DSP"];
    return `${prefixes[stageIndex] || "DOC"}-${baseId}`;
  }
  return `DOC-${baseId}`;
}

const STAGE_FIELDS = {
  "Gate Inward": [
    { key: "vehicleNo", label: "Vehicle Number", placeholder: "e.g. MH12 AB 1234" },
    { key: "driverName", label: "Driver Name & Phone", placeholder: "e.g. Rajesh Kumar (+91 98220...)" },
    { key: "ewayBill", label: "E-Way Bill / LR No.", placeholder: "e.g. EWB-99182371" },
  ],
  "Inward": [
    { key: "vendor", label: "Vendor / Consignor", placeholder: "e.g. Aravali Foods Ltd." },
    { key: "poNumber", label: "PO Reference Number", placeholder: "e.g. PO-2026-8841" },
    { key: "boxCount", label: "Total Package Count", placeholder: "e.g. 150 Cartons / 4 Pallets" },
  ],
  "Checklist Unloading": [
    { key: "sealStatus", label: "Container Seal Status", placeholder: "Intact / Broken / Re-sealed" },
    { key: "dockNo", label: "Unloading Dock Bay", placeholder: "Bay 4 - North Bay" },
    { key: "unloadingSupervisor", label: "Unloading Supervisor", placeholder: "Supervisor Name" },
  ],
  "Quality Check": [
    { key: "sampleTested", label: "Sample Units Inspected", placeholder: "e.g. 25 Units" },
    { key: "passQty", label: "Passed Quantity", placeholder: "e.g. 145 Units" },
    { key: "rejectReason", label: "Defect / Damage Notes", placeholder: "e.g. 5 boxes corner crushed" },
  ],
  "Good Receipt Note": [
    { key: "grnCode", label: "GRN Serial Code", placeholder: "Auto GRN-3021" },
    { key: "putawayZone", label: "Target Bin / Rack Location", placeholder: "Zone A - Bin A-04-12" },
    { key: "receivedBy", label: "Warehouse Officer Sign-off", placeholder: "Officer Name" },
  ],
  "Pick List": [
    { key: "pickOrder", label: "Pick Request ID", placeholder: "e.g. PK-2026-091" },
    { key: "customer", label: "Customer Name", placeholder: "e.g. Nimbus Retail Pvt Ltd" },
    { key: "priority", label: "Dispatch Priority", placeholder: "High / Normal / Express" },
  ],
  "Pick": [
    { key: "pickerName", label: "Assigned Picker", placeholder: "Picker ID / Name" },
    { key: "pickedQty", label: "Quantity Picked", placeholder: "e.g. 80 Cartons" },
    { key: "sourceBin", label: "Source Bin Tag", placeholder: "Bin B-11-02" },
  ],
  "Quality Check Outward": [
    { key: "outwardQcStatus", label: "Packaging Integrity Check", placeholder: "Passed / Re-pack Required" },
    { key: "verifiedWeight", label: "Gross Weight (Kg)", placeholder: "e.g. 540.2 Kg" },
    { key: "qcInspector", label: "Outward QC Officer", placeholder: "Inspector Badge ID" },
  ],
  "Checklist Loading": [
    { key: "loadingBay", label: "Loading Dock Bay", placeholder: "Bay 2 - Main Gate" },
    { key: "truckNo", label: "Assigned Dispatch Vehicle", placeholder: "e.g. MH14 GH 2290" },
    { key: "lashingStatus", label: "Cargo Strapping & Lashing", placeholder: "Secured & Verified" },
  ],
  "Dispatch": [
    { key: "lrNumber", label: "Transporter LR / B/L No.", placeholder: "e.g. VRL-9901" },
    { key: "transporter", label: "Logistics Vendor", placeholder: "e.g. Gati KWE / Spot Fleet" },
    { key: "containerSeal", label: "Container Outward Seal No.", placeholder: "SEAL-88192" },
  ],
  "Outward": [
    { key: "gateOutTime", label: "Gate Out Time", placeholder: "e.g. 11:45 AM" },
    { key: "gatePassNo", label: "Gate Pass No.", placeholder: "GP-2026-88" },
    { key: "deliveryAck", label: "Delivery Ack Copy", placeholder: "Signed & Uploaded" },
  ],
  "Labour Attendance": [
    { key: "workerName", label: "Worker / Labour Name", placeholder: "e.g. Ramesh Patil" },
    { key: "agency", label: "Vendor / Contractor Agency", placeholder: "e.g. Apex Manpower Services" },
    { key: "shift", label: "Assigned Shift", placeholder: "Morning (08:00 AM - 04:00 PM)" },
    { key: "status", label: "Attendance Status", placeholder: "Present / Overtime / Absent" },
  ],
  "MHE Attendance": [
    { key: "equipmentCode", label: "Equipment ID & Model", placeholder: "e.g. FL-03 (3 Ton Electric Forklift)" },
    { key: "operator", label: "Assigned Operator", placeholder: "e.g. Suresh Shinde" },
    { key: "hoursOrBattery", label: "Logged Operating Hours / Battery %", placeholder: "e.g. 7.5 Hrs · 90% Charge" },
    { key: "condition", label: "Maintenance / Health Status", placeholder: "Operational / Needs Maintenance" },
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
  { id: "tracktrace", label: "Track & Trace", icon: Radar },
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
  tracktrace: ["Track & Trace", null],
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
    <span style={{ background: t.bg, color: t.fg }} className="px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap">
      {children}
    </span>
  );
}

function StatCard({ label, value, sub, tone = "primary" }) {
  const tones = { primary: c.primary, warning: c.warning, success: c.success, danger: c.danger };
  return (
    <div style={{ background: c.card, border: `1px solid ${c.border}` }} className="rounded-md p-4 sm:p-5 flex flex-col gap-2">
      <span style={{ color: c.muted }} className="text-xs sm:text-sm">{label}</span>
      <span style={{ color: c.text }} className="text-2xl sm:text-3xl font-semibold">{value}</span>
      <div className="flex items-center gap-2">
        <div style={{ background: c.surface }} className="h-1.5 flex-1 rounded-full overflow-hidden">
          <div style={{ background: tones[tone], width: sub.pct + "%" }} className="h-full rounded-full" />
        </div>
        <span style={{ color: c.faint }} className="text-[11px] sm:text-xs font-medium">{sub.text}</span>
      </div>
    </div>
  );
}

function BinMap() {
  const cols = 40;
  const rows = 12;
  const cells = useMemo(() => {
    const arr = [];
    for (let i = 0; i < cols * rows; i++) {
      const r = Math.random();
      if (r < 0.58) arr.push("occupied");
      else if (r < 0.82) arr.push("empty");
      else if (r < 0.94) arr.push("hold");
      else arr.push("blocked");
    }
    return arr;
  }, []);
  const colorFor = { occupied: c.primary, empty: c.border, hold: c.warning, blocked: c.danger };
  return (
    <div style={{ background: c.card, border: `1px solid ${c.border}` }} className="rounded-md p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 style={{ color: c.text }} className="font-semibold text-sm sm:text-base">Bin utilization</h3>
          <p style={{ color: c.muted }} className="text-xs sm:text-sm">
            Sample view across zones A–D · 10,000 bins total
          </p>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 text-xs" style={{ color: c.muted }}>
          {[["occupied", "Occupied"], ["empty", "Empty"], ["hold", "QC hold"], ["blocked", "Blocked"]].map(([k, l]) => (
            <span key={k} className="flex items-center gap-1">
              <span style={{ background: colorFor[k] }} className="w-2.5 h-2.5 rounded-sm inline-block" />
              {l}
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 2 }}>
        {cells.map((s, i) => (
          <div key={i} style={{ background: colorFor[s], aspectRatio: "1 / 1", borderRadius: 1 }} />
        ))}
      </div>
    </div>
  );
}

function Pipeline({ title, stages }) {
  return (
    <div style={{ background: c.card, border: `1px solid ${c.border}` }} className="rounded-md p-4 sm:p-5">
      <h3 style={{ color: c.text }} className="font-semibold text-sm sm:text-base mb-4">{title}</h3>
      <div className="flex items-stretch overflow-x-auto pb-2 gap-y-3">
        {stages.map((s, i) => (
          <React.Fragment key={s.label}>
            <div className="flex flex-col items-center gap-2 px-2 sm:px-3 min-w-[76px] sm:min-w-[86px]">
              <div style={{ background: c.surface, color: c.text }} className="w-9 h-9 sm:w-10 sm:h-10 rounded-md flex items-center justify-center">
                <s.icon size={16} />
              </div>
              <span style={{ color: c.text }} className="text-[11px] sm:text-xs text-center font-medium leading-tight">{s.label}</span>
              <span style={{ color: c.primary }} className="text-xs sm:text-sm font-semibold">{s.count}</span>
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

function ActivityTable({ searchQuery = "" }) {
  const rows = [
    { doc: "GRN-3021", party: "Nimbus Retail Pvt Ltd", type: "Inward", stage: "Good Receipt Note", status: "success", time: "10:42 AM" },
    { doc: "GT-IN-1187", party: "Aravali Foods", type: "Inward", stage: "Gate Inward", status: "muted", time: "10:15 AM" },
    { doc: "OUT-DSP-552", party: "Kalash Distributors", type: "Outward", stage: "Dispatch", status: "success", time: "9:58 AM" },
    { doc: "QC-IN-0912", party: "Meridian Textiles", type: "Inward", stage: "Quality Check", status: "warning", time: "9:40 AM" },
    { doc: "PK-2209", party: "Orbit Hardware", type: "Outward", stage: "Pick", status: "primary", time: "9:21 AM" },
    { doc: "QC-OUT-0447", party: "Silverline Pharma", type: "Outward", stage: "Quality Check Outward", status: "danger", time: "8:55 AM" },
  ];

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter((r) =>
      r.doc.toLowerCase().includes(q) ||
      r.party.toLowerCase().includes(q) ||
      r.type.toLowerCase().includes(q) ||
      r.stage.toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  return (
    <div style={{ background: c.card, border: `1px solid ${c.border}` }} className="rounded-md overflow-hidden">
      <div className="p-4 sm:p-5 pb-0 flex items-center justify-between">
        <h3 style={{ color: c.text }} className="font-semibold text-sm sm:text-base">Recent activity</h3>
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
                  <td className="py-3 pr-4 font-semibold text-xs sm:text-sm" style={{ color: c.text }}>{r.doc}</td>
                  <td className="py-3 pr-4" style={{ color: c.text }}>{r.party}</td>
                  <td className="py-3 pr-4" style={{ color: c.muted }}>{r.type}</td>
                  <td className="py-3 pr-4" style={{ color: c.muted }}>{r.stage}</td>
                  <td className="py-3 pr-4"><Pill tone={r.status}>{r.stage}</Pill></td>
                  <td className="py-3 text-xs" style={{ color: c.faint }}>{r.time}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-6 text-center" style={{ color: c.muted }}>
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

function CrudPage({ title, note, addLabel, columns, rows, onAdd, onEdit, globalSearch = "" }) {
  const [localSearch, setLocalSearch] = useState("");

  const activeSearch = localSearch || globalSearch;

  const filteredRows = useMemo(() => {
    if (!activeSearch.trim()) return rows;
    const q = activeSearch.toLowerCase();
    return rows.filter((row) =>
      row.some((cell) => String(cell).toLowerCase().includes(q))
    );
  }, [rows, activeSearch]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 style={{ color: c.text }} className="text-lg sm:text-xl font-semibold">{title}</h2>
          {note && <p style={{ color: c.muted }} className="text-xs sm:text-sm mt-0.5 sm:mt-1">{note}</p>}
        </div>
        <button onClick={onAdd} style={{ background: c.primary }} className="text-white px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-medium flex items-center gap-1.5 hover:opacity-90">
          <Plus size={16} /> {addLabel}
        </button>
      </div>
      <div style={{ background: c.card, border: `1px solid ${c.border}` }} className="rounded-md p-3 sm:p-4">
        <div className="relative mb-4 max-w-xs">
          <Search size={16} style={{ color: c.faint }} className="absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search this list..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            style={{ borderColor: c.border, color: c.text }}
            className="w-full pl-9 pr-3 py-1.5 sm:py-2 rounded-md border text-xs sm:text-sm outline-none focus:ring-2"
          />
          {localSearch && (
            <button
              onClick={() => setLocalSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm border-collapse min-w-[600px]">
            <thead>
              <tr style={{ color: c.muted }} className="text-left">
                {columns.map((col) => <th key={col} className="font-medium py-2 pr-4">{col}</th>)}
                <th className="font-medium py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length > 0 ? (
                filteredRows.map((row, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${c.border}` }}>
                    {row.map((cell, j) => (
                      <td key={j} className="py-3 pr-4" style={{ color: j === 0 ? c.text : c.muted, fontWeight: j === 0 ? 600 : 400 }}>{cell}</td>
                    ))}
                    <td className="py-3">
                      <button onClick={() => onEdit(row[0])} style={{ color: c.primary }} className="text-xs sm:text-sm font-medium hover:underline mr-3">Edit</button>
                      <button style={{ color: c.danger }} className="text-xs sm:text-sm font-medium hover:underline">Remove</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length + 1} className="py-6 text-center" style={{ color: c.muted }}>
                    No results found matching "{activeSearch}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function WorkflowRow({ r, stages, tone, onOpenRow, forcedStepIndex }) {
  const defaultStep = forcedStepIndex !== undefined ? forcedStepIndex : r.step - 1;
  const [selectedStep, setSelectedStep] = useState(defaultStep);

  useEffect(() => {
    if (forcedStepIndex !== undefined) {
      setSelectedStep(forcedStepIndex);
    }
  }, [forcedStepIndex]);

  const activeColor = tone === "inward" ? c.primary : "#7C3AED";
  const currentDocNo = getStepDocNo(r.docBase, tone, selectedStep);

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
            <span className="font-semibold text-xs sm:text-sm tracking-tight" style={{ color: c.text }}>
              {currentDocNo}
            </span>
            <span className="text-[10px] sm:text-[11px] font-medium truncate" style={{ color: activeColor }}>
              S{selectedStep + 1}: {stages[selectedStep]}
            </span>
          </div>

          <button
            type="button"
            disabled={nextDisabled}
            onClick={handleNext}
            title={nextDisabled ? "No next step available" : "View Next Step Doc No."}
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
      <td className="py-3 pr-4 font-medium" style={{ color: c.text }}>{r.party}</td>
      <td className="py-3 pr-4 text-xs sm:text-sm" style={{ color: c.muted }}>{r.ref}</td>
      <td className="py-3 pr-4" style={{ color: c.muted }}>
        Step {selectedStep + 1} of {stages.length}
        <div className="text-xs font-medium" style={{ color: activeColor }}>
          {stages[selectedStep]}
        </div>
      </td>
      <td className="py-3 pr-4">
        <Pill tone={selectedStep + 1 === r.step ? r.tone : selectedStep < r.step ? "success" : "muted"}>
          {stages[selectedStep]}
        </Pill>
      </td>
      <td className="py-3 pr-4">
        <div style={{ background: c.surface }} className="h-1.5 w-20 sm:w-24 rounded-full overflow-hidden">
          <div style={{ background: activeColor, width: ((selectedStep + 1) / stages.length) * 100 + "%" }} className="h-full rounded-full" />
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
      </td>
    </tr>
  );
}

function WorkflowPage({ title, note, stages, rows, tone, addLabel, onAdd, onOpenRow, footnote, globalSearch = "" }) {
  const [filterStage, setFilterStage] = useState(null);
  const activeColor = tone === "inward" ? c.primary : "#7C3AED";

  const searchedRows = useMemo(() => {
    if (!globalSearch.trim()) return rows;
    const q = globalSearch.toLowerCase();
    return rows.filter((r) => {
      const docNo = getStepDocNo(r.docBase, tone, r.step - 1).toLowerCase();
      const baseId = (r.docBase || "").toLowerCase();
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
    });
  }, [rows, globalSearch, tone]);

  const filteredRows = useMemo(() => {
    if (filterStage === null) return searchedRows;
    return searchedRows.filter((r) => r.step >= filterStage + 1);
  }, [searchedRows, filterStage]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 style={{ color: c.text }} className="text-lg sm:text-xl font-semibold">{title}</h2>
          <p style={{ color: c.muted }} className="text-xs sm:text-sm mt-0.5 sm:mt-1">{note}</p>
        </div>
        <button onClick={onAdd} style={{ background: activeColor }} className="text-white px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-medium flex items-center gap-1.5 hover:opacity-90">
          <Plus size={16} /> {addLabel}
        </button>
      </div>

      <div style={{ background: c.card, border: `1px solid ${c.border}` }} className="rounded-md p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span style={{ color: c.muted }} className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider">
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
            <span className="text-xs sm:text-sm font-semibold whitespace-nowrap">All Steps ({searchedRows.length})</span>
          </button>
          <ChevronRight size={16} style={{ color: c.faint }} className="mx-1 flex-shrink-0" />

          {stages.map((s, i) => {
            const isSelected = filterStage === i;
            const count = searchedRows.filter((r) => r.step >= i + 1).length;
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
                  <span className="text-xs sm:text-sm font-medium whitespace-nowrap">{s}</span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-bold"
                    style={{
                      background: isSelected ? "rgba(255,255,255,0.25)" : c.border,
                      color: isSelected ? "#ffffff" : c.muted,
                    }}
                  >
                    {count}
                  </span>
                </button>
                {i < stages.length - 1 && <ChevronRight size={16} style={{ color: c.faint }} className="mx-1 flex-shrink-0" />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div style={{ background: c.card, border: `1px solid ${c.border}` }} className="rounded-md p-3 sm:p-4">
        {globalSearch && (
          <div className="mb-3 px-1 text-xs font-semibold" style={{ color: activeColor }}>
            Showing search results for: "{globalSearch}" ({filteredRows.length} matches)
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm border-collapse min-w-[700px]">
            <thead>
              <tr style={{ color: c.muted }} className="text-left">
                <th className="font-medium py-2 pr-4">Step Doc No. (Use Arrows)</th>
                <th className="font-medium py-2 pr-4">Party</th>
                <th className="font-medium py-2 pr-4">Ref.</th>
                <th className="font-medium py-2 pr-4">Selected Step</th>
                <th className="font-medium py-2 pr-4">Stage Status</th>
                <th className="font-medium py-2 pr-4">Completion</th>
                <th className="font-medium py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length > 0 ? (
                filteredRows.map((r, i) => (
                  <WorkflowRow
                    key={i}
                    r={r}
                    stages={stages}
                    tone={tone}
                    onOpenRow={onOpenRow}
                    forcedStepIndex={filterStage !== null ? filterStage : undefined}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center" style={{ color: c.muted }}>
                    No matching consignments found for query: <strong style={{ color: c.text }}>"{globalSearch}"</strong>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {footnote && <p style={{ color: c.faint }} className="text-xs">{footnote}</p>}
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

function FloatingForm({ form, onChange, onClose, onMinimize, onFocus, onSave, onSaveCopy, onStep, onSetStage, onMove, onAddPhoto, onRemovePhoto }) {
  const tone = FLOW_COLORS[form.tone] || FLOW_COLORS.simple;
  const isFlow = !!form.flowStages;
  const stageLabel = isFlow ? form.flowStages[form.stageIndex] : form.title;
  const leftDisabled = !isFlow || form.stageIndex === 0;
  const rightDisabled = !isFlow || form.stageIndex === form.flowStages.length - 1;

  const currentDocId = isFlow && form.docBase ? getStepDocNo(form.docBase, form.tone, form.stageIndex) : form.docId;

  const currentFields = STAGE_FIELDS[stageLabel] || STAGE_FIELDS[form.title] || [
    { key: "f1", label: `${stageLabel} Reference ID`, placeholder: "Enter code / ID" },
    { key: "f2", label: `${stageLabel} Specification / Notes`, placeholder: "Enter notes" },
    { key: "f3", label: "Assigned Supervisor", placeholder: "Enter supervisor name" },
  ];

  const handleHeaderMouseDown = (e) => {
    if (window.innerWidth < 768) return; // Disable drag on mobile (full screen modal)
    if (e.button !== 0) return;
    if (e.target.closest("button") || e.target.closest("input") || e.target.closest("label")) return;

    onFocus(form.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = form.left;
    const startTop = form.top;

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      onMove(form.id, Math.max(0, startLeft + deltaX), Math.max(0, startTop + deltaY));
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
            <span style={{ background: `${tone}1A`, color: tone }} className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded">
              {form.tone === "inward" ? "Inward" : form.tone === "outward" ? "Outward" : "Form"}
            </span>
            {currentDocId && <span style={{ color: c.faint }} className="text-xs font-semibold">{currentDocId}</span>}
          </div>
          <h4 style={{ color: c.text }} className="text-[15px] font-semibold truncate mt-0.5">
            {stageLabel}
          </h4>
          {isFlow && <p style={{ color: c.muted }} className="text-xs mt-0.5">Step {form.stageIndex + 1} of {form.flowStages.length}</p>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onMinimize(form.id)} style={{ color: c.faint }} className="p-2 md:p-1.5 rounded hover:bg-gray-100" title="Minimize Form">
            <Minus size={18} className="md:w-[15px] md:h-[15px]" />
          </button>
          <button onClick={() => onClose(form.id)} style={{ color: c.faint }} className="p-2 md:p-1.5 rounded hover:bg-gray-100" title="Close Form">
            <X size={18} className="md:w-[15px] md:h-[15px]" />
          </button>
        </div>
      </div>

      {isFlow && (
        <div className="px-4 py-2 flex items-center justify-between" style={{ borderBottom: `1px solid ${c.border}`, background: c.surface }}>
          <button
            disabled={leftDisabled}
            onClick={() => onStep(form.id, -1)}
            style={{ color: leftDisabled ? c.faint : tone, opacity: leftDisabled ? 0.4 : 1, cursor: leftDisabled ? "not-allowed" : "pointer" }}
            className="p-1 rounded flex items-center gap-1 text-xs font-medium"
          >
            <ChevronLeft size={16} /> Prev
          </button>
          <StageDots stages={form.flowStages} stageIndex={form.stageIndex} tone={tone} />
          <button
            disabled={rightDisabled}
            onClick={() => onStep(form.id, 1)}
            style={{ color: rightDisabled ? c.faint : tone, opacity: rightDisabled ? 0.4 : 1, cursor: rightDisabled ? "not-allowed" : "pointer" }}
            className="p-1 rounded flex items-center gap-1 text-xs font-medium"
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Stage Document History Stepper Bar in Floating Form */}
      {isFlow && (
        <div className="px-3 py-1.5 flex items-center justify-between gap-1.5 select-none" style={{ background: c.surface, borderBottom: `1px solid ${c.border}` }}>
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

          <span className="text-xs font-semibold text-center flex-1" style={{ color: c.text }}>
            Step {form.stageIndex + 1}: <span style={{ color: tone }}>{currentDocId}</span>
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

      <div className="px-4 py-4 flex-1 md:flex-initial flex flex-col gap-4 overflow-y-auto max-h-none md:max-h-[420px]">
        {isFlow && (
          <p style={{ color: c.faint }} className="text-xs -mt-1">
            Fields update dynamically as this consignment advances through stages.
          </p>
        )}
        {currentFields.map((f) => (
          <div key={f.key} className="flex flex-col gap-1">
            <label style={{ color: c.muted }} className="text-xs font-medium">{f.label}</label>
            <input
              type="text"
              value={form.values[`${stageLabel}_${f.key}`] || form.values[f.key] || ""}
              onChange={(e) => onChange(form.id, `${stageLabel}_${f.key}`, e.target.value)}
              placeholder={f.placeholder || `Enter ${f.label.toLowerCase()}`}
              style={{ borderColor: c.border, color: c.text }}
              className="px-3 py-2.5 sm:py-2 rounded-md border text-sm outline-none focus:ring-2"
            />
          </div>
        ))}

        {/* Photo Attachment Section */}
        <div className="flex flex-col gap-2 pt-3 border-t mt-1" style={{ borderColor: c.border }}>
          <div className="flex items-center justify-between">
            <label style={{ color: c.muted }} className="text-xs font-medium flex items-center gap-1.5">
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
                <div key={idx} className="relative w-20 h-20 md:w-16 md:h-16 rounded-md overflow-hidden border flex-shrink-0" style={{ borderColor: c.border }}>
                  <img src={img} alt="Attachment" className="w-full h-full object-cover" />
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
                <span style={{ color: c.faint }} className="text-[10px] mt-0.5">Add</span>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} multiple />
              </label>
            </div>
          ) : (
            <label
              className="w-full py-3 md:py-2 px-3 rounded-md border border-dashed flex items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 transition-colors"
              style={{ borderColor: c.border }}
            >
              <Camera size={16} style={{ color: tone }} />
              <span style={{ color: c.text }} className="text-xs font-medium">Upload Gate / QC Photo</span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} multiple />
            </label>
          )}
        </div>
      </div>

      <div className="px-4 py-3 pb-6 md:pb-3 flex items-center justify-end gap-2" style={{ borderTop: `1px solid ${c.border}`, background: c.card }}>
        <button onClick={() => onClose(form.id)} style={{ color: c.muted, borderColor: c.border }} className="px-4 py-2 md:py-1.5 rounded-md border text-sm font-medium hover:bg-gray-50">
          Cancel
        </button>
        <button onClick={() => onSaveCopy(form.id)} style={{ color: tone, borderColor: tone }} className="px-3.5 py-2 md:py-1.5 rounded-md border text-sm font-medium flex items-center gap-1.5 hover:opacity-80">
          <Copy size={14} /> Save & Copy
        </button>
        <button onClick={() => onSave(form.id)} style={{ background: tone }} className="px-4 py-2 md:py-1.5 rounded-md text-sm font-medium text-white hover:opacity-90">
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
    <div className="fixed bottom-0 left-0 right-0 flex items-center gap-2 px-3 sm:px-4 py-2 z-50 overflow-x-auto" style={{ background: c.ink, borderTop: `1px solid ${c.inkLine}` }}>
      {minimized.map((f) => {
        const tone = FLOW_COLORS[f.tone] || FLOW_COLORS.simple;
        const currentDocId = f.flowStages && f.docBase ? getStepDocNo(f.docBase, f.tone, f.stageIndex) : f.docId;
        const label = f.flowStages ? `${f.tone === "inward" ? "Inward" : "Outward"} · ${currentDocId || f.flowStages[f.stageIndex]}` : f.title;
        return (
          <div
            key={f.id}
            className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-md cursor-pointer flex-shrink-0"
            style={{ background: c.inkSoft, borderLeft: `3px solid ${tone}` }}
            onClick={() => onRestore(f.id)}
          >
            <span className="text-white text-xs font-medium whitespace-nowrap max-w-[140px] sm:max-w-[160px] truncate">{label}</span>
            <button onClick={(e) => { e.stopPropagation(); onClose(f.id); }} style={{ color: c.faint }} className="p-1 rounded hover:bg-white/10">
              <X size={13} />
            </button>
          </div>
        );
      })}
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
  const idRef = useRef(0);
  const zRef = useRef(10);
  const cascadeRef = useRef(0);

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

  const updateForm = (id, patch) => setForms((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const moveForm = (id, left, top) => setForms((prev) => prev.map((f) => (f.id === id ? { ...f, left, top } : f)));
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
    setForms((prev) => prev.map((f) => (f.id === id ? { ...f, values: { ...f.values, [key]: val } } : f)));

  const addPhotoToForm = (id, photoUrl) =>
    setForms((prev) =>
      prev.map((f) => (f.id === id ? { ...f, photos: [...(f.photos || []), photoUrl] } : f))
    );

  const removePhotoFromForm = (id, photoIndex) =>
    setForms((prev) =>
      prev.map((f) =>
        f.id === id
          ? { ...f, photos: (f.photos || []).filter((_, idx) => idx !== photoIndex) }
          : f
      )
    );

  const stepForm = (id, dir) =>
    setForms((prev) =>
      prev.map((f) => {
        if (f.id !== id || !f.flowStages) return f;
        const next = Math.min(f.flowStages.length - 1, Math.max(0, f.stageIndex + dir));
        return { ...f, stageIndex: next };
      })
    );

  const setStageForm = (id, stageIndex) =>
    setForms((prev) =>
      prev.map((f) => {
        if (f.id !== id || !f.flowStages) return f;
        return { ...f, stageIndex };
      })
    );

  const saveForm = (id) => closeForm(id);
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

  const openSimpleForm = (title, tone = "simple") => openForm({ kind: "simple", title, tone });
  const openInwardForm = (stageIndex = 0, docBase = "3021") =>
    openForm({ kind: "workflow", tone: "inward", flowStages: INWARD_STAGES, stageIndex, docBase });
  const openOutwardForm = (stageIndex = 0, docBase = "0552") =>
    openForm({ kind: "workflow", tone: "outward", flowStages: OUTWARD_STAGES, stageIndex, docBase });

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

  return (
    <div style={{ fontFamily: "Manrope, sans-serif", background: c.surface }} className="relative w-full h-screen flex overflow-hidden">
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
        <div style={{ borderBottom: `1px solid ${c.inkLine}` }} className="flex items-center justify-between px-4 h-16 flex-shrink-0">
          <div className="flex items-center gap-2 overflow-hidden">
            <Warehouse size={20} color={c.primary} />
            {(!collapsed || mobileNavOpen) && (
              <span className="text-white font-semibold tracking-tight text-[15px] whitespace-nowrap">DEPOT</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setCollapsed(!collapsed)} style={{ color: c.faint }} className="hidden md:block hover:text-white flex-shrink-0">
              {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            </button>
            <button onClick={() => setMobileNavOpen(false)} style={{ color: c.faint }} className="md:hidden hover:text-white p-1">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-3 flex flex-col gap-0.5">
          {NAV.map((item) => {
            const isParentActive = section === item.label || (item.children && item.children.some((ch) => ch.id === activePage));
            return (
              <div key={item.id}>
                <button
                  onClick={() => handleNavClick(item)}
                  title={collapsed && !mobileNavOpen ? item.label : undefined}
                  style={{ color: isParentActive ? "#fff" : c.faint, background: isParentActive && !item.children ? c.primary : "transparent" }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium hover:text-white transition-colors ${collapsed && !mobileNavOpen ? "justify-center" : ""}`}
                >
                  <item.icon size={19} className="flex-shrink-0" />
                  {(!collapsed || mobileNavOpen) && (
                    <>
                      <span className="flex-1 text-left whitespace-nowrap">{item.label}</span>
                      {item.children && <ChevronDown size={15} style={{ transform: openSection === item.id ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />}
                    </>
                  )}
                </button>
                {(!collapsed || mobileNavOpen) && item.children && openSection === item.id && (
                  <div className="flex flex-col pl-11 pr-2 pb-1">
                    {item.children.map((ch) => (
                      <button
                        key={ch.id}
                        onClick={() => {
                          setActivePage(ch.id);
                          setMobileNavOpen(false);
                        }}
                        style={{ color: activePage === ch.id ? c.primary : c.faint }}
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

        <div style={{ borderTop: `1px solid ${c.inkLine}` }} className={`flex items-center gap-2.5 px-4 h-16 flex-shrink-0 ${collapsed && !mobileNavOpen ? "justify-center" : ""}`}>
          <div style={{ background: c.inkSoft }} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
            <User size={16} color={c.faint} />
          </div>
          {(!collapsed || mobileNavOpen) && (
            <div className="overflow-hidden">
              <div className="text-white text-sm font-medium whitespace-nowrap">R. Deshpande</div>
              <div style={{ color: c.faint }} className="text-xs whitespace-nowrap">Warehouse Manager</div>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        {/* Header Bar */}
        <div style={{ background: c.card, borderBottom: `1px solid ${c.border}` }} className="h-16 flex-shrink-0 flex items-center justify-between px-4 sm:px-6">
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

            <div style={{ color: c.muted }} className="text-xs sm:text-sm font-medium">
              {section}{sub && <><span className="mx-1.5">/</span><span style={{ color: c.text }} className="font-semibold">{sub}</span></>}
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Real-time Working Search Bar (Visible on mobile & desktop) */}
            <div className="relative">
              <Search size={15} style={{ color: c.faint }} className="absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                style={{ borderColor: c.border, background: c.surface, color: c.text }}
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
            <Bell size={18} style={{ color: c.muted }} className="hidden sm:block" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 sm:pb-16">
          {activePage === "dashboard" && (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Bin utilization" value="74%" sub={{ pct: 74, text: "7,412 / 10,000" }} tone="primary" />
                <StatCard label="Pending inward QC" value="18" sub={{ pct: 45, text: "lots waiting" }} tone="warning" />
                <StatCard label="Pending outward QC" value="9" sub={{ pct: 28, text: "lots waiting" }} tone="warning" />
                <StatCard label="Today's dispatches" value="32" sub={{ pct: 80, text: "of 40 planned" }} tone="success" />
              </div>

              <BinMap />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Pipeline
                  title="Inward pipeline — today"
                  stages={[
                    { label: "Gate Inward", count: 5, icon: Truck },
                    { label: "Inward", count: 12, icon: ClipboardList },
                    { label: "Checklist Unloading", count: 8, icon: ClipboardCheck },
                    { label: "Quality Check", count: 18, icon: PackageCheck },
                    { label: "Good Receipt Note", count: 6, icon: FileCheck },
                  ]}
                />
                <Pipeline
                  title="Outward pipeline — today"
                  stages={[
                    { label: "Pick List", count: 14, icon: ClipboardList },
                    { label: "Pick", count: 10, icon: PackageCheck },
                    { label: "QC Outward", count: 9, icon: ClipboardCheck },
                    { label: "Checklist Loading", count: 7, icon: ClipboardList },
                    { label: "Dispatch", count: 32, icon: Truck },
                    { label: "Outward", count: 28, icon: FileCheck },
                  ]}
                />
              </div>

              <ActivityTable searchQuery={searchQuery} />
            </div>
          )}

          {activePage === "masters-customers" && (
            <CrudPage
              title="Customers"
              note="Same list-and-edit pattern applies across every Masters screen."
              addLabel="Add Customer"
              globalSearch={searchQuery}
              columns={["Customer code", "Name", "GSTIN", "City", "Contact"]}
              rows={[
                ["CUST-0104", "Nimbus Retail Pvt Ltd", "27AAJCN1234K1ZP", "Pune", "+91 98220 11234"],
                ["CUST-0098", "Aravali Foods", "08AAJCA5567H1Z9", "Jaipur", "+91 97290 88213"],
                ["CUST-0112", "Meridian Textiles", "24AAJCM8890L1ZQ", "Surat", "+91 90990 44521"],
                ["CUST-0071", "Orbit Hardware", "27AAJCO3321J1ZT", "Nashik", "+91 98811 22076"],
              ]}
              onAdd={() => openSimpleForm("Add Customer")}
              onEdit={(name) => openSimpleForm(`Edit Customer — ${name}`)}
            />
          )}

          {activePage === "masters-products" && (
            <CrudPage
              title="Products"
              note="Every SKU stored in the warehouse is registered here before it can appear on any Inward or Outward document."
              addLabel="Add Product"
              globalSearch={searchQuery}
              columns={["SKU code", "Product name", "Category", "Unit", "Reorder level"]}
              rows={[
                ["SKU-0442", "Basmati Rice 25kg", "Grocery", "Bag", "200"],
                ["SKU-0187", "Cotton Yarn Cone", "Textile", "Cone", "500"],
                ["SKU-0925", "M8 Hex Bolt", "Hardware", "Box", "1000"],
                ["SKU-0310", "Paracetamol 500mg", "Pharma", "Carton", "150"],
              ]}
              onAdd={() => openSimpleForm("Add Product")}
              onEdit={(name) => openSimpleForm(`Edit Product — ${name}`)}
            />
          )}

          {activePage === "masters-vendors" && (
            <CrudPage
              title="Vendors"
              note="Vendors are linked to every Gate Inward entry so goods can be traced back to source."
              addLabel="Add Vendor"
              globalSearch={searchQuery}
              columns={["Vendor code", "Name", "GSTIN", "City", "Contact"]}
              rows={[
                ["VEND-0033", "Aravali Foods", "08AAJCA5567H1Z9", "Jaipur", "+91 97290 88213"],
                ["VEND-0051", "Meridian Textiles Mills", "24AAJCM8890L1ZQ", "Surat", "+91 90990 44521"],
                ["VEND-0018", "Precision Fasteners Co.", "27AAJCP2210F1ZR", "Aurangabad", "+91 96070 55182"],
              ]}
              onAdd={() => openSimpleForm("Add Vendor")}
              onEdit={(name) => openSimpleForm(`Edit Vendor — ${name}`)}
            />
          )}

          {activePage === "masters-locations" && (
            <CrudPage
              title="Bin Locations"
              note="Generated from the 10 × 10 sqft grid across the floor — 10,000 bins in total."
              addLabel="Add Bin"
              globalSearch={searchQuery}
              columns={["Bin code", "Zone", "Capacity (units)", "Status"]}
              rows={[
                ["A-04-12", "Zone A", "120", "Occupied"],
                ["B-11-02", "Zone B", "80", "Empty"],
                ["C-07-19", "Zone C", "150", "QC hold"],
                ["D-02-05", "Zone D", "100", "Blocked"],
              ]}
              onAdd={() => openSimpleForm("Add Bin Location")}
              onEdit={(name) => openSimpleForm(`Edit Bin — ${name}`)}
            />
          )}

          {activePage === "masters-users" && (
            <CrudPage
              title="Users"
              note="Controls who can act at each stage — for example, only QC staff can clear Quality Checks."
              addLabel="Add User"
              globalSearch={searchQuery}
              columns={["User ID", "Name", "Role", "Status"]}
              rows={[
                ["USR-011", "R. Deshpande", "Warehouse Manager", "Active"],
                ["USR-024", "S. Kulkarni", "QC Inspector", "Active"],
                ["USR-019", "A. Verma", "Gate Security", "Active"],
                ["USR-032", "P. Shinde", "Picker", "Inactive"],
              ]}
              onAdd={() => openSimpleForm("Add User")}
              onEdit={(name) => openSimpleForm(`Edit User — ${name}`)}
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
              rows={[
                { docBase: "3021", party: "Nimbus Retail Pvt Ltd", ref: "MH12 AB 4432", step: 5, stageLabel: "Good Receipt Note", tone: "success" },
                { docBase: "1187", party: "Aravali Foods", ref: "RJ14 CT 8821", step: 1, stageLabel: "Gate Inward", tone: "muted" },
                { docBase: "0912", party: "Meridian Textiles", ref: "GJ05 XZ 1190", step: 4, stageLabel: "Quality Check", tone: "warning" },
                { docBase: "2244", party: "Orbit Hardware", ref: "MH04 EF 3390", step: 2, stageLabel: "Inward", tone: "primary" },
              ]}
              onAdd={() => openInwardForm(0, genBaseDoc())}
              onOpenRow={(r, stepIdx) => openInwardForm(stepIdx !== undefined ? stepIdx : r.step - 1, r.docBase)}
              footnote="Outward follows the same structure across its six stages."
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
              rows={[
                { docBase: "0552", party: "Kalash Distributors", ref: "MH12 KP 7761", step: 6, stageLabel: "Outward", tone: "success" },
                { docBase: "2209", party: "Orbit Hardware", ref: "—", step: 2, stageLabel: "Pick", tone: "primary" },
                { docBase: "0447", party: "Silverline Pharma", ref: "GJ01 DT 5541", step: 3, stageLabel: "Quality Check Outward", tone: "danger" },
                { docBase: "0810", party: "Nimbus Retail Pvt Ltd", ref: "MH14 GH 2290", step: 4, stageLabel: "Checklist Loading", tone: "warning" },
              ]}
              onAdd={() => openOutwardForm(0, genBaseDoc())}
              onOpenRow={(r, stepIdx) => openInwardForm(stepIdx !== undefined ? stepIdx : r.step - 1, r.docBase)}
              footnote="Inward mirrors this with its five stages."
            />
          )}

          {activePage === "txn-billing" && (
            <CrudPage
              title="Billing"
              note="Bills are raised against completed Inward or Outward documents."
              addLabel="New Bill"
              globalSearch={searchQuery}
              columns={["Bill no.", "Customer", "Linked doc.", "Amount", "Status"]}
              rows={[
                ["BILL-1042", "Nimbus Retail Pvt Ltd", "GRN-3021", "₹18,400", "Paid"],
                ["BILL-1039", "Kalash Distributors", "OUT-DSP-0552", "₹9,750", "Pending"],
                ["BILL-1035", "Silverline Pharma", "QC-OUT-0447", "₹4,200", "Draft"],
              ]}
              onAdd={() => openSimpleForm("New Bill")}
              onEdit={(name) => openSimpleForm(`Edit Bill — ${name}`)}
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
                ["INV-5502", "Nimbus Retail Pvt Ltd", "28 Aug 2026", "₹18,400", "Paid"],
                ["INV-5498", "Kalash Distributors", "27 Aug 2026", "₹9,750", "Pending"],
                ["INV-5491", "Meridian Textiles", "24 Aug 2026", "₹22,900", "Overdue"],
              ]}
              onAdd={() => openSimpleForm("New Invoice")}
              onEdit={(name) => openSimpleForm(`Edit Invoice — ${name}`)}
            />
          )}

          {activePage === "fin-payments" && (
            <CrudPage
              title="Payments"
              note="Payments received against invoices, reconciled by reference number."
              addLabel="Record Payment"
              globalSearch={searchQuery}
              columns={["Payment ID", "Customer", "Invoice ref.", "Amount", "Mode"]}
              rows={[
                ["PAY-2210", "Nimbus Retail Pvt Ltd", "INV-5502", "₹18,400", "Bank Transfer"],
                ["PAY-2204", "Aravali Foods", "INV-5480", "₹6,300", "UPI"],
                ["PAY-2196", "Orbit Hardware", "INV-5471", "₹11,050", "Cheque"],
              ]}
              onAdd={() => openSimpleForm("Record Payment")}
              onEdit={(name) => openSimpleForm(`Edit Payment — ${name}`)}
            />
          )}

          {activePage === "attendance" && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 style={{ color: c.text }} className="text-lg sm:text-xl font-semibold">Attendance & MHE Operations</h2>
                  <p style={{ color: c.muted }} className="text-xs sm:text-sm mt-1">
                    Manage daily labor shifts, contractor headcounts, and MHE equipment status.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openSimpleForm("Labour Attendance", "simple")}
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
                <StatCard label="Labour On-Duty" value="42 / 50" sub={{ pct: 84, text: "84% shift coverage" }} tone="success" />
                <StatCard label="Contractor Staff" value="28" sub={{ pct: 70, text: "Apex & Spot Agency" }} tone="primary" />
                <StatCard label="Active MHE Fleet" value="12 / 15" sub={{ pct: 80, text: "3 in maintenance" }} tone="warning" />
                <StatCard label="Logged Machine Hours" value="86.5 h" sub={{ pct: 90, text: "Today's usage" }} tone="success" />
              </div>

              <CrudPage
                title="Labour Attendance"
                note="Real-time shift log for warehouse operators, loaders, and contractor workers."
                addLabel="Record Labour Attendance"
                globalSearch={searchQuery}
                columns={["Worker ID", "Name", "Role / Vendor", "Shift", "Check-in", "Status"]}
                rows={[
                  ["WRK-088", "Ramesh Patil", "Loader · Apex Logistics", "Morning (8 AM - 4 PM)", "07:50 AM", "Present"],
                  ["WRK-092", "Vikram Singh", "Forklift Helper · Spot Agency", "Morning (8 AM - 4 PM)", "08:02 AM", "Present"],
                  ["WRK-104", "Anil Deshmukh", "Packer · In-house", "General (9 AM - 5 PM)", "08:55 AM", "Present"],
                  ["WRK-077", "Sanjay More", "Unloader · Apex Logistics", "Morning (8 AM - 4 PM)", "—", "Absent"],
                ]}
                onAdd={() => openSimpleForm("Labour Attendance", "simple")}
                onEdit={(name) => openSimpleForm(`Edit Attendance — ${name}`, "simple")}
              />

              <CrudPage
                title="Material Handling Equipment (MHE) Fleet"
                note="Tracking operational availability, operator assignment, and health status for forklifts, reach trucks, and cranes."
                addLabel="Log MHE Status"
                globalSearch={searchQuery}
                columns={["MHE Code", "Equipment Type", "Assigned Operator", "Fuel / Battery", "Hours Logged", "Status"]}
                rows={[
                  ["MHE-FL-01", "2.5 Ton Electric Forklift", "Suresh Shinde", "88% Battery", "6.5 Hrs", "In Use"],
                  ["MHE-RT-02", "Reach Truck High-Bay", "Dinesh Kadam", "95% Battery", "7.0 Hrs", "In Use"],
                  ["MHE-CR-01", "10 Ton Overhead Crane", "R. V. Pawar", "Main Power", "4.2 Hrs", "Operational"],
                  ["MHE-FL-03", "3 Ton Diesel Forklift", "Unassigned", "20% Fuel", "1.5 Hrs", "Maintenance Hold"],
                ]}
                onAdd={() => openSimpleForm("MHE Attendance", "outward")}
                onEdit={(name) => openSimpleForm(`Update MHE — ${name}`, "outward")}
              />
            </div>
          )}

          {activePage === "tracktrace" && (
            <div className="flex flex-col gap-4">
              <h2 style={{ color: c.text }} className="text-lg sm:text-xl font-semibold">Track & Trace</h2>
              <div style={{ background: c.card, border: `1px solid ${c.border}` }} className="rounded-md p-4 sm:p-6">
                <div className="relative max-w-md mb-5">
                  <Search size={15} style={{ color: c.faint }} className="absolute left-3 top-1/2 -translate-y-1/2" />
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
                  {["Gate Inward — 8:10 AM", "Inward — 8:22 AM", "Checklist Unloading — 8:40 AM", "Quality Check — 9:05 AM", "Good Receipt Note — 9:30 AM"].map((s, i, arr) => (
                    <div key={s} className="flex items-center gap-3">
                      <div className="flex flex-col items-center">
                        <span style={{ background: c.primary }} className="w-2.5 h-2.5 rounded-full" />
                        {i < arr.length - 1 && <span style={{ background: c.border }} className="w-px h-8" />}
                      </div>
                      <span style={{ color: c.text }} className="text-xs sm:text-sm">{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Floating / Fullpage Overlay Forms layer */}
        {forms.filter((f) => !f.minimized).map((f) => (
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
            onSetStage={setStageForm}
            onMove={moveForm}
            onAddPhoto={addPhotoToForm}
            onRemovePhoto={removePhotoFromForm}
          />
        ))}
      </div>

      <Dock forms={forms} onRestore={restoreForm} onClose={closeForm} />
    </div>
  );
}
