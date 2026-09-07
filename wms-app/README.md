# WMS Prototype

A warehouse management prototype with a PDF import pipeline (OCR + document-type detection), PDF generation, and per-transaction document workflows.

- **Frontend**: React 19 + Vite + Tailwind CSS 4
- **OCR service**: Node.js + Express microservice (MuPDF WASM + Tesseract.js WASM)

> Note: data is persisted in browser `localStorage` — there is no backend database yet. The OCR service is a prototype and will be replaced by the main .NET backend.

## Requirements

- Node.js `^20.19.0` or `>=22.12.0` (Vite 8)

## Setup

Two npm installs — one for the app, one for the OCR service.

```bash
# app dependencies
cd wms-app/wms-app
npm install

# OCR service dependencies
cd server
npm install
```

## Run

Start the OCR service first, then the dev server (two terminals).

**Terminal 1 — OCR service (port 4001):**

```bash
cd wms-app/wms-app/server
npm start          # or `npm run dev` for file-watch reload
```

Verify it's up:

```bash
curl localhost:4001/api/health
# {"ok":true,"service":"wms-import-api"}
```

**Terminal 2 — app (port 5173):**

```bash
cd wms-app/wms-app
npm run dev
```

Open http://localhost:5173

The Vite dev server proxies `/api` to `http://localhost:4001`, so the PDF Import page talks to the OCR service automatically.

## PDF Import

The **Import** page accepts PDF, PNG, or JPEG uploads (drag-and-drop or browse, up to 20MB):

1. OCR extracts text (embedded text layer preferred; scanned pages are rasterized + OCR'd).
2. Document type is auto-detected across **17 types** (12 workflow stages + Bill, Invoice, Payment, Labour Attendance, MHE Attendance), with alternatives + manual override.
3. Field values are extracted and shown for review before saving.
4. Save **directly** to a workflow collection or **open a pre-filled form**; mid-flow documents can be linked into an existing consignment (linked via `parentId`).
5. Generated PDFs are cached and visible in the Recycle Bin under **Generated PDFs** (download / delete / restore).

Test with the sample: `server/sample.pdf` (a PR-101 Pre Gate Inward document).

## Common commands

```bash
npm run dev       # Vite dev server
npm run build     # production build
npm run lint      # oxlint
npm run preview   # preview the built app
```

## Structure

```
wms-app/
├── server/            # OCR microservice (Express + MuPDF + Tesseract.js)
│   ├── index.js       #   HTTP routes (/api/health, /api/import/ocr)
│   ├── ocr.js         #   PDF text extraction + OCR pipeline
│   └── sample.pdf     #   sample document for testing
├── pdfs/              # generated sample PDFs
├── src/
│   ├── lib/
│   │   ├── import.js  #   DOC_TYPES, doc-type detection, field extraction
│   │   ├── pdf.js     #   generic jsPDF form generator
│   │   └── pdfCache.js#   localStorage PDF cache
│   ├── ImportPage.jsx #   upload → OCR → detect → review → save
│   └── App.jsx        #   routing, workflows, billing, reports, recycle bin
└── vite.config.js     # /api → localhost:4001 proxy
```