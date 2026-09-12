# WMS Prototype

Warehouse Management System prototype with a PDF import pipeline (OCR + vision-based field extraction + document-type detection), PDF generation, per-transaction workflows, and an import queue fed by API + WhatsApp/Telegram bots.

- **Frontend**: React 19 + Vite + Tailwind CSS 4
- **Backend**: Node.js + Express microservice (`server/`) + serverless API on Vercel (`api/`)
- **OCR / Vision**: Google Vision (text), MuPDF (PDF → text/image), NVIDIA NIM (field extraction)
- **Event pipeline**: Java 21 + Spring Boot (WebFlux/Reactor) + Apache Kafka + PostgreSQL (R2DBC) + MinIO
- **Live demo**: https://wms-app-orpin.vercel.app

> Note: UI data is persisted in browser `localStorage` (`wms:appdata`, `wms:pdfcache`, `wms:drafts`). This is a prototype.

---

## Stack overview

```text
  React + Vite (localhost:5173)          Live site: wms-app-orpin.vercel.app
        │  /api (dev proxy)                        │  serverless /api/*
        ▼                                          
   Node OCR service (localhost:4001) ───────────────────────────────► Vercel function (sync OCR only)
        │  POST /api/ingest
        ▼
   Kafka: document.received ──► Java worker (Spring WebFlux/Reactor)
        │                          ├─ GET presigned MinIO object
        │                          ├─ POST /api/import/ocr (Node)
        │                          ├─ classifier (17 doc types)
        │                          ├─ POST /api/extract (NVIDIA)
        │                          ├─ Postgres: document_processing (idempotent)
        │                          └─ PATCH /api/imports/:id (back-fill queue)
        ▼
   ImportPage (local)  ◄── results back-filled
        ▲
        └── mirror.mjs ◄── pushes local processed items ─► live Vercel queue
```

There are two processing paths:

1. **Synchronous** (default, on Vercel too): upload → OCR → extract → queue. No Kafka/Java needed.
2. **Event-driven** (local `docker compose` stack): ingest → MinIO + Kafka → Java worker → results back-filled; optionally **mirrored** to the live Vercel site.

---

## How to run it

### Prerequisites

- Node.js `^20.19.0` or `>=22.12.0` (Vite 8)
- Docker + Docker Compose (only for the Kafka/Java pipeline)
- API keys for OCR/extraction (see [Keys](#2-add-keys) below)

### 1. Clone & install

```bash
git clone git@github.com:Kulkarni-Yash/WMS.git
cd WMS/wms-app/wms-app

npm install        # frontend
cd server
npm install        # OCR service + Kafka producer + bots
cd ..
```

### 2. Add keys

Create `server/.env` (the server loads it with `dotenv`; it is git-ignored):

```bash
GOOGLE_VISION_API_KEY=...
TELEGRAM_BOT_TOKEN=...            # optional: enables the Telegram bot
NVIDIA_API_KEY=...
NVIDIA_MODEL=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning
NVIDIA_API_KEY_FALLBACK=...
NVIDIA_MODEL_FALLBACK=nvidia/nemotron-3-super-120b-a12b
NVIDIA_API_KEY_FALLBACK2=...
NVIDIA_MODEL_FALLBACK2=nvidia/nemotron-3-ultra-550b-a55b
```

> `GOOGLE_VISION` / `NVIDIA` keys are needed for scanned-document OCR and field
> extraction. The same names go in the Vercel production env vars for the live
> site (see [Deploy on Vercel](#deploy-on-vercel)).

### 3. Run

**Terminal 1 — OCR service (port 4001):**

```bash
cd server
npm start          # or `npm run dev` for file-watch reload
```

Verify: `curl localhost:4001/api/health` → `{"ok":true,...}`

The Telegram bot starts automatically with this server when `TELEGRAM_BOT_TOKEN`
is set. If your network blocks Telegram (e.g. VPN/Firewall), you'll see
`polling error: connect ETIMEDOUT 149.154.166.110:443` — turn the VPN/firewall
off or allowlist `api.telegram.org:443`. The bot auto-restarts polling on
transient failures (`EFATAL`), so it recovers without a manual restart.

**Terminal 2 — app (port 5173):**

```bash
npm run dev
```

Open http://localhost:5173 — Vite proxies `/api` → `http://localhost:4001`.
This works without Docker.

### 4. Optional — event-driven pipeline (Docker): Kafka + Java + Postgres + MinIO

> The compose file pulls MinIO from `quay.io/minio/*` — the same images on Docker
> Hub are no longer pullable anonymously. Requires a Docker engine (e.g. colima):
> `brew install colima docker docker-compose && colima start`.

```bash
# Terminal 3 — the compose stack (Kafka KRaft, Postgres 16, MinIO, Java worker)
docker compose up --build
```

Start the OCR server again, this time telling Node to emit MinIO-hosted
presigned URLs (the Java container can't reach `localhost:9000`):

```bash
cd server
S3_PUBLIC_ENDPOINT=http://minio:9000 npm start
```

Feed a document through the pipeline (or send it via the Telegram bot):

```bash
curl -F "file=@pdfs/Gate_Inward-GT-102.pdf" http://localhost:4001/api/ingest
```

Watch the Java logs for the trace `DocumentReceived → ProcessingStarted →
OCRStarted/OCRCompleted → Classified → ExtractionStarted/ExtractionCompleted →
PersistenceCompleted → Publish document.processed → Writing back to RWMS queue`.

Verify persistence and the back-filled queue item:

```bash
docker compose exec postgres psql -U rwms -c \
  "SELECT document_id, status, retry_count, result_json FROM document_processing ORDER BY id;"

curl -s "http://localhost:4001/api/imports?status=unapproved"
```

### 5. Optional — mirror processed docs to the live Vercel site

The deployed ImportPage reads the Vercel function's own `/tmp` queue, so locally
processed documents aren't visible there by default. `mirror.mjs` pushes
local `COMPLETED` items up to `POST /api/mirror` (stores them verbatim, no
re-OCR; mirrors Kafka `COMPLETED` items *and* sync-OCR items with `fullText`;

```bash
cd server
npm run mirror    # watches the local queue, targets wms-app-orpin.vercel.app
```

### 6. Optional — concurrency burst (Kafka demo)

```bash
cd server
npm run burst     # publishes 4 DocumentReceived events
```

`document.received` has 3 partitions and the listener runs 3 concurrent
consumers, so documents process in parallel and each lands as exactly one
`COMPLETED` row. Run twice: replays are dropped by the idempotency guard.

### Troubleshooting

| Symptom | Fix |
| --- | --- |
| Telegram `connect ETIMEDOUT 149.154.166.110:443` | VPN/firewall blocks Telegram — switch it off or allowlist `api.telegram.org:443` |
| Java worker can't fetch the document | Node must run with `S3_PUBLIC_ENDPOINT=http://minio:9000 npm start` during compose runs |
| `ERR_MODULE_NOT_FOUND` on restart | re-run `npm install` in `server/` |
| Docs appear locally but not on the live site | run `npm run mirror` (or the Vercel function cold-started and its `/tmp` queue reset) |

---

## Event-driven architecture (why Kafka, Java, Reactor)

- **Kafka** decouples ingestion from processing: components scale independently,
  events replay after crashes, and the topic gives natural at-least-once
  semantics that the idempotency guard handles explicitly.
- **Reactor / WebFlux** keeps the pipeline non-blocking end to end (HTTP to Node
  OCR/NVIDIA, Postgres, Kafka) — one thread can serve thousands of documents.
- **Java + PostgreSQL (R2DBC)** gives durable, orderable per-document state —
  a realistic foundation for the eventual production rewrite.
- **Idempotency**: `documentId` (`imp-<uuid8>`) is the key; a
  `UNIQUE(document_id)` row in Postgres makes the first delivery win.
- **Retries**: transient failures (network, 5xx, timeouts) retry with backoff
  (max 3); permanent failures (blank/bad PDF, validation) fail fast and emit
  `document.failed`. Every step is logged against `documentId` via `ProcessingLog`.

### Pipeline

```text
  WhatsApp / Telegram bot ──┐
                            ▼
                     Node (port 4001)                    Java: document-processing-service
  ┌───────────────────────────────┐    document.received   ┌─────────────────────────────────────┐
  │ POST /api/ingest              │ ─────────────────────► │ @KafkaListener (concurrency=3)      │
  │ 1. store raw PDF to MinIO     │                        │   └─ IdempotencyGuard (UNIQUE id)  │
  │ 2. create queue item          │                        │ DocumentRetriever ──► GET signed URL│
  │ 3. publish event (or outbox)  │                        │ OcrClient     ─────► POST /api/import/ocr
  └───────┬───────────▲───────────┘                        │ Classifier    —──── in-JVM, 17 types
          │           │            PATCH /api/imports/:id  │ ExtractionClient ► POST /api/extract (NVIDIA)
          │           └────────────────────────────────────│ Validator     —──── sanity checks
          ▼                                                │ R2DBC         —──── Postgres (document_processing)
  existing ImportPage  ◄──── results back-filled           │ EventPublisher ────► document.processed / document.failed
                                                           └─────────────────────────────────────┘
```

### Outbox

If Kafka is unreachable when a document ingests, the event is persisted to a
durable outbox and retried every 5s until the broker is back — the queue item
is always created first, so nothing is lost.

---

## API endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Service health |
| POST | `/api/import/ocr` | Upload PDF/PNG/JPEG → OCR text |
| POST | `/api/extract` | `{ text?, image?, docLabel, fields }` → extracted values + confidence (NVIDIA NIM) |
| POST | `/api/ingest` | Multipart upload → object storage + Kafka `document.received` (async processing) |
| GET | `/api/imports?status=unapproved` | Import queue |
| POST | `/api/imports` | Multipart upload into queue (legacy, used by bots) |
| PATCH | `/api/imports/:id` | Approve/update a queued import (also used by Java write-back) |
| DELETE | `/api/imports/:id` | Remove a queued import |
| GET | `/api/imports/:id/image` | Stored document image |
| POST | `/api/mirror` | Push an already-processed item into the queue verbatim (no re-OCR) — used by `mirror.mjs` |

Upload cap: 12 MB local / ~4 MB on Vercel (Hobby body limit).

---

## Deploy on Vercel

The repo is set up for serverless deployment (framework: Vite, root dir `wms-app/wms-app`).

1. Import `github.com/Kulkarni-Yash/WMS` in the Vercel dashboard.
2. Set **Root Directory** to `wms-app/wms-app`.
3. Add the production env vars (same names as the local `.env`):
   `GOOGLE_VISION_API_KEY`, `NVIDIA_API_KEY`, `NVIDIA_MODEL`,
   `NVIDIA_API_KEY_FALLBACK`, `NVIDIA_MODEL_FALLBACK`,
   `NVIDIA_API_KEY_FALLBACK2`, `NVIDIA_MODEL_FALLBACK2`, `TELEGRAM_BOT_TOKEN`.
4. Deploy.

Or from the CLI:

```bash
vercel login
vercel link          # links to kulkarni619y-7518/wms-app
vercel env add <NAME> production   # for each key
vercel --prod
```

`api/index.js` serves all `/api/*` routes as a serverless function (see
`vercel.json`). No external DB: the import queue lives in `/tmp` on Vercel
(cleared on cold start) and in `server/data/pending.json` locally.

---

## Features

- **PDF Import**: drag-drop PDF/PNG/JPEG → OCR (embedded text preferred, scanned pages via Google Vision) → auto-detect one of **17 doc types** (12 workflow stages + Bill, Invoice, Payment, Labour Attendance, MHE Attendance) with alternatives + manual override → review extracted fields → save directly to a workflow or open a pre-filled form; mid-flow docs link into existing consignments via `parentId`.
- **Workflows**: Inward & Outward 6-stage trees with progress bars, auto-expanded roots, chain-aware completion.
- **PDF generation**: generic jsPDF forms (A4, tone header, doc ID, meta, field rows, signature, QR + barcode) for any record; PDFs cached locally and listed in the Recycle Bin under "Generated PDFs".
- **Masters, Billing, Invoice, Payment, Labour/MHE attendance, Reports, Dashboard, Recycle Bin** with localStorage persistence.
- **Import sources**: API upload + WhatsApp/Telegram bots pushing into the unapproved queue.

---

## Structure

```
wms-app/wms-app/
├── api/index.js          # Vercel serverless Express app (OCR + queue + extract + mirror)
├── server/               # Local OCR microservice
│   ├── index.js          #   HTTP routes, bot bootstrap, ingest router, outbox flusher
│   ├── ingest.js         #   POST /api/ingest (object storage + Kafka + outbox)
│   ├── storage.js        #   S3-compatible/MinIO store + presigned URLs
│   ├── kafka/            #   producer.js, outbox.js, burst.mjs, mirror.mjs
│   ├── ocr.js            #   MuPDF text sync + Google Vision OCR
│   ├── extract.js        #   NVIDIA NIM field extraction (vision + text, fallbacks)
│   ├── preprocess.js     #   sharp crop/normalise before OCR
│   ├── store.js          #   pending.json queue (data/pending.json, /tmp on Vercel)
│   ├── telegram/         #   Telegram bot (watches for documents)
│   ├── whatsapp/         #   WhatsApp bot
│   └── data/pending.json #   seeded import queue (git-ignored)
├── services/document-processing-service/   # Java 21 + Spring WebFlux + Kafka + R2DBC
│   ├── Dockerfile
│   └── src/main/java/com/rwms/docproc/
│       ├── messaging/    #   Kafka listener + producer config
│       ├── event/        #   Domain events (received/processed/failed)
│       ├── pipeline/     #   Reactor pipeline, context, retries, exceptions
│       ├── classify/     #   In-JVM document classifier (17 types)
│       ├── clients/      #   WebClient: OCR, NVIDIA extract, retrieval, queue write-back
│       ├── repository/   #   R2DBC persistence + idempotency guard
│       ├── persistence/  #   Startup schema init
│       └── validation/   #   Extraction sanity checks
├── docker-compose.yml    # Kafka (KRaft), Postgres, MinIO, MinIO-init, Java service
├── pdfs/                 # generated sample PDFs
├── src/
│   ├── lib/              # import.js (doc types/detect), pdf.js (generator), pdfCache.js
│   ├── ImportPage.jsx    # upload → OCR → detect → review → save
│   └── App.jsx           # routing, workflows, billing, reports, recycle bin
├── vercel.json           # /api rewrite + function settings
└── vite.config.js        # /api → localhost:4001 dev proxy
```

---

## Commands

```bash
# Frontend (repo root: wms-app/wms-app)
npm run dev       # Vite dev server (port 5173)
npm run build     # production build
npm run lint      # oxlint
npm run preview   # preview the built app

# OCR pipeline (server/)
npm start                 # Express API + Telegram bot (port 4001)
npm run dev               # same, with file-watch reload
npm run telegram          # Telegram bot explicitly
npm run telegram:simulate # push a fake Telegram doc into the queue
npm run bot               # WhatsApp bot (Phase 2 stub)
npm run bot:simulate      # one-shot simulated WhatsApp push
npm run burst             # publish 4 DocumentReceived events (Kafka concurrency demo)
npm run mirror            # push local processed items to the live Vercel queue

# Full stack
docker compose up --build # Kafka + Postgres + MinIO + Java worker
```