# WMS Prototype

Warehouse Management System prototype with a PDF import pipeline (OCR + vision-based field extraction + document-type detection), PDF generation, per-transaction workflows, and an import queue fed by API + WhatsApp/Telegram bots.

- **Frontend**: React 19 + Vite + Tailwind CSS 4
- **Backend**: Node.js + Express microservice (`server/`) + serverless API on Vercel (`api/`)
- **OCR / Vision**: Google Vision (text), MuPDF (PDF → text/image), NVIDIA NIM (field extraction)
- **Live demo**: https://wms-app-orpin.vercel.app

> Note: UI data is persisted in browser `localStorage` (`wms:appdata`, `wms:pdfcache`, `wms:drafts`). This is a prototype — the backend will become a .NET service in the main app.

## Requirements

- Node.js `^20.19.0` or `>=22.12.0` (Vite 8)
- API keys for OCR/extraction (see `.env.example`)

## Local setup

Install both the app and the OCR service dependencies:

```bash
cd wms-app/wms-app
npm install
cd server
npm install
```

Create `server/.env` with your keys (copy `.env.example`):

```
GOOGLE_VISION_API_KEY=...
NVIDIA_API_KEY=...
NVIDIA_MODEL=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning
NVIDIA_API_KEY_FALLBACK=...
NVIDIA_MODEL_FALLBACK=nvidia/nemotron-3-super-120b-a12b
NVIDIA_API_KEY_FALLBACK2=...
NVIDIA_MODEL_FALLBACK2=nvidia/nemotron-3-ultra-550b-a55b
```

## Run locally

**Terminal 1 — OCR service (port 4001):**

```bash
cd wms-app/wms-app/server
npm start          # or `npm run dev` for file-watch reload
```

Verify: `curl localhost:4001/api/health`

**Terminal 2 — app (port 5173):**

```bash
cd wms-app/wms-app
npm run dev
```

Open http://localhost:5173 — the Vite dev server proxies `/api` → `http://localhost:4001`.

**Bots** (optional): `npm run bot` (WhatsApp) and `npm run telegram` in `server/`. The Telegram bot starts automatically with the OCR server and posts received documents into the import queue.

## Deploy on Vercel

The repo is set up for serverless deployment (framework: Vite, root dir `wms-app/wms-app`).

1. Import `github.com/Kulkarni-Yash/WMS` in the Vercel dashboard.
2. Set **Root Directory** to `wms-app/wms-app`.
3. Add the production env vars (same names as `.env.example`).
4. Deploy.

Or from the CLI:

```bash
vercel login
vercel link          # links to kulkarni619y-7518/wms-app
vercel env add <NAME> production   # for each key
vercel --prod
```

The `api/index.js` Express app serves all `/api/*` routes as a serverless function (see `vercel.json`). No external DB: the import queue writes to `/tmp` on Vercel (resets on cold start) and to `server/data/pending.json` locally.

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

Upload cap: 12MB local / ~4MB on Vercel (Hobby body limit).

## Event-Driven Document Processing (Kafka + Java)

Beyond the synchronous `/api/imports` path, the prototype has an asynchronous,
event-driven pipeline built on **Java 21 + Spring Boot (WebFlux) + Reactor +
Apache Kafka + PostgreSQL**, which keeps the OLD endpoints and UI fully intact.

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

- **Why Kafka (not a queue/SQL poll)?** Decouples ingestion from processing:
  each component scales independently, events are replayed after crashes, and a
  single topic gives natural at-least-once semantics we handle explicitly.
- **Why Reactor (WebFlux)?** The pipeline is mostly I/O (HTTP to Node
  OCR/NVIDIA, Postgres, Kafka). A single thread serving thousands of concurrent
  documents is the real point of reactive code here — no thread-per-document.
- **Why Java + Postgres?** Per-document durable state, orderable querying, and a
  realistic foundation for the production .NET/other rewrite.
- **Idempotency:** `documentId` (`imp-<uuid8>`) is the idempotency key. Kafka
  redelivers; a `UNIQUE(document_id)` row in Postgres makes the first delivery
  win and drops later duplicates (including terminal `COMPLETED`/`FAILED`).
- **Retries:** transient failures (network, 5xx, OCR/extraction timeouts) retry
  with backoff (max 3 attempts); permanent failures (bad/blank PDF, validation)
  fail fast and emit `document.failed`. Everything is logged against
  `documentId` via `ProcessingLog` (single trace per document).

### Run the event-driven stack

Requirements: Docker + Docker Compose, and the Node server running on port 4001.

```bash
# 1. Start Kafka (KRaft), PostgreSQL, MinIO, and build+run the Java service
cd wms-app/wms-app
docker compose up --build

# 2. In another terminal, start the Node OCR service (bots + /api/ingest)
cd wms-app/wms-app/server
npm install          # first time (kafkajs, @aws-sdk/*)
npm start            # port 4001

# 3. Simulate a WhatsApp/Telegram document landing in the inbox:
curl -F "file=@pdfs/Gate_Inward-GT-102.pdf" http://localhost:4001/api/ingest
```

Watch the Java service logs for the full trace:

```
DocumentReceived → ProcessingStarted → OCRStarted/OCRCompleted
→ Classified as gateInward → ExtractionStarted/ExtractionCompleted
→ PersistenceCompleted → Publish document.processed → Writing back to RWMS queue
```

Verify the document landed in Postgres and the queue item was back-filled:

```bash
docker compose exec postgres psql -U rwms -c "SELECT document_id, status, retry_count, result_json FROM document_processing ORDER BY id;"
curl -s "http://localhost:4001/api/imports?status=unapproved" | jq '.[] | select(.id=="imp-XXX")'
```

### Concurrency burst (4 docs, overlapping delivery)

```bash
cd server
npm run burst    # node kafka/burst.mjs  (publishes 4 DocumentReceived events)
```

The `document.received` topic has 3 partitions and the listener runs 3
concurrent consumers, so the four documents are processed in parallel and each
lands as exactly one `COMPLETED` row. Run it twice: the re-published documents
are skipped by the idempotency guard (no duplicate rows).

### Show processed docs on the live Vercel site (mirror)

The deployed ImportPage reads the Vercel function's own /tmp queue, so locally
processed documents are not visible there by default. A tiny mirror script
pushes locally `COMPLETED` items up to `POST /api/mirror` on the deployed API
(which stores them verbatim, no re-OCR). Idempotent: the route replaces an
item by its id, so restarts/replays are harmless.

```bash
# 1. Start the pipeline (as above). The Java container fetches documents from
#    MinIO via the presigned URL in the event, so Node must emit minio-hosted URLs:
cd server
S3_PUBLIC_ENDPOINT=http://minio:9000 npm start

# 2. In another terminal, watch the local queue and mirror completed items up:
cd server
npm run mirror    # node kafka/mirror.mjs  (TARGET defaults to wms-app-orpin.vercel.app)
```

### Limitations

- The Java service reuses the Node OCR/LLM endpoints over HTTP (`app.node-api-url`),
  so the keys stay in one place (local `server/.env` / Vercel, never in the repo).
- The durable outbox on the Node side retries Kafka failures every 5s until the
  broker is reachable — the queue item is always created first.
- Vercel's serverless function keeps the synchronous flow only (no Kafka/MinIO
  bundled); the event-driven path is for the local/compose stack.
- The Vercel queue lives in serverless /tmp — mirrored items vanish when the
  function cold-starts. Fine for a prototype; a durable queue would need
  external Postgres (e.g. Supabase).
- Without `S3_PUBLIC_ENDPOINT=http://minio:9000`, events carry localhost URLs
  that the Java container can't reach; keep that env on the Node process during
  compose runs only (non-docker local runs leave it unset).
- `data/pending.json` and `server/.env` are intentionally untracked.

## Features

- **PDF Import**: drag-drop PDF/PNG/JPEG → OCR (embedded text preferred, scanned pages via Google Vision) → auto-detect one of **17 doc types** (12 workflow stages + Bill, Invoice, Payment, Labour Attendance, MHE Attendance) with alternatives + manual override → review extracted fields → save directly to a workflow or open a pre-filled form; mid-flow docs link into existing consignments via `parentId`.
- **Workflows**: Inward & Outward 6-stage trees with progress bars, auto-expanded roots, chain-aware completion.
- **PDF generation**: generic jsPDF forms (A4, tone header, doc ID, meta, field rows, signature, QR + barcode) for any record; PDFs cached locally and listed in the Recycle Bin under "Generated PDFs".
- **Masters, Billing, Invoice, Payment, Labour/MHE attendance, Reports, Dashboard, Recycle Bin** with localStorage persistence.
- **Import sources**: API upload + WhatsApp/Telegram bots pushing into the unapproved queue.

## Structure

```
wms-app/wms-app/
├── api/index.js          # Vercel serverless Express app (OCR + queue + extract)
├── server/               # Local OCR microservice
│   ├── index.js          #   HTTP routes, bot bootstrap, ingest router
│   ├── ingest.js         #   POST /api/ingest (object storage + Kafka + outbox)
│   ├── storage.js        #   S3-compatible/MinIO store + presigned URLs
│   ├── kafka/            #   producer.js (document.received), outbox.js, burst.mjs
│   ├── ocr.js            #   MuPDF text sync + Google Vision OCR
│   ├── extract.js        #   NVIDIA NIM field extraction (vision + text, fallbacks)
│   ├── preprocess.js     #   sharp crop/normalise before OCR
│   ├── store.js          #   pending.json queue (data/pending.json, /tmp on Vercel)
│   ├── telegram/         #   Telegram bot (watches for documents)
│   ├── whatsapp/         #   WhatsApp bot
│   └── data/pending.json #   seeded import queue
├── services/document-processing-service/   # Java 21 + Spring WebFlux + Kafka + R2DBC
│   ├── Dockerfile
│   └── src/main/java/com/rwms/docproc/
│       ├── messaging/    #   Kafka listener + producer config
│       ├── event/        #   Domain events (received/processed/failed)
│       ├── pipeline/     #   Reactor pipeline, context, retries, exceptions
│       ├── classify/     #   In-JVM document classifier (17 types)
│       ├── clients/      #   WebClient: OCR, NVIDIA extract, queue write-back
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

## Commands

```bash
npm run dev       # Vite dev server
npm run build     # production build
npm run lint      # oxlint
npm run preview   # preview the built app

# server/
npm run burst     # publish 4 DocumentReceived events for a Kafka concurrency demo
npm run telegram  # Telegram bot
npm run bot       # WhatsApp bot
```