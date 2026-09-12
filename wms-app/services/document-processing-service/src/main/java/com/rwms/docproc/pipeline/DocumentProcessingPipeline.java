package com.rwms.docproc.pipeline;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.rwms.docproc.classify.DocumentClassifier;
import com.rwms.docproc.clients.DocumentRetriever;
import com.rwms.docproc.clients.ExtractionClient;
import com.rwms.docproc.clients.OcrClient;
import com.rwms.docproc.clients.RwmsQueueClient;
import com.rwms.docproc.event.DocumentReceivedEvent;
import com.rwms.docproc.event.EventPublisher;
import com.rwms.docproc.repository.DocumentProcessingRepository;
import com.rwms.docproc.repository.DocStatus;
import com.rwms.docproc.repository.IdempotencyGuard;
import com.rwms.docproc.util.ProcessingLog;
import com.rwms.docproc.validation.DocumentValidator;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;

import java.time.Duration;

/**
 * Reactive end-to-end document pipeline. Every stage is non-blocking and
 * observable through {@link ProcessingLog}. Transient failures (network, 5xx,
 * OCR/LLM timeouts) are retried with backoff; permanent failures (bad PDF,
 * validation, model errors) fail fast and produce a document.failed event.
 */
@Component
public class DocumentProcessingPipeline {

    private static final int MAX_ATTEMPTS = 3;

    private final IdempotencyGuard guard;
    private final DocumentProcessingRepository repo;
    private final DocumentRetriever retriever;
    private final OcrClient ocr;
    private final DocumentClassifier classifier;
    private final ExtractionClient extraction;
    private final DocumentValidator validator;
    private final EventPublisher publisher;
    private final RwmsQueueClient queue;
    private final ObjectMapper mapper;

    public DocumentProcessingPipeline(IdempotencyGuard guard,
                                      DocumentProcessingRepository repo,
                                      DocumentRetriever retriever,
                                      OcrClient ocr,
                                      DocumentClassifier classifier,
                                      ExtractionClient extraction,
                                      DocumentValidator validator,
                                      EventPublisher publisher,
                                      RwmsQueueClient queue,
                                      ObjectMapper mapper) {
        this.guard = guard;
        this.repo = repo;
        this.retriever = retriever;
        this.ocr = ocr;
        this.classifier = classifier;
        this.extraction = extraction;
        this.validator = validator;
        this.publisher = publisher;
        this.queue = queue;
        this.mapper = mapper;
    }

    /**
     * Entry point. Deduplicates via the idempotency guard, then runs the full
     * pipeline only for a genuinely new document.
     */
    public Mono<Void> process(DocumentReceivedEvent event) {
        return guard.begin(event)
                .flatMap(marker -> switch (marker) {
                    case IdempotencyGuard.NEW_DOCUMENT -> runPipeline(event);
                    case IdempotencyGuard.DUPLICATE_TERMINAL -> {
                        ProcessingLog.logEvent(event, "Skipped — terminal duplicate (already COMPLETED/FAILED)");
                        yield Mono.<Void>empty();
                    }
                    default -> {
                        ProcessingLog.logEvent(event, "Skipped — already in progress elsewhere");
                        yield Mono.<Void>empty();
                    }
                });
    }

    private Mono<Void> runPipeline(DocumentReceivedEvent event) {
        ProcessContext ctx = ProcessContext.received(event);

        return Mono.just(ctx)
                // Activity 1 — retrieval from object storage
                .flatMap(this::startProcessing)
                .flatMap(retriever::retrieve).retryWhen(retrySpec(ctx))
                // Activity 2 — OCR via existing Node endpoint
                .flatMap(ocr::ocr).retryWhen(retrySpec(ctx))
                // Activity 3 — deterministic classification (in-JVM)
                .map(this::classify)
                // Activity 4 — AI extraction via existing Node/NVIDIA endpoint
                .flatMap(extraction::extract).retryWhen(retrySpec(ctx))
                // Activity 5 — sanity validation
                .flatMap(validator::validate)
                // Activity 6 — durable completion
                .flatMap(this::persistCompleted)
                // Activity 7 — publish document.processed (lifecycle event)
                .flatMap(publisher::publishProcessed)
                // Activity 8 — write results back into the RWMS queue (PATCH)
                .flatMap(queue::writeBack)
                .then()
                .onErrorResume(e -> handleFailure(event, e));
    }

    private Mono<ProcessContext> startProcessing(ProcessContext ctx) {
        ctx.markStarted();
        return repo.markProcessing(ctx.documentId(), ctx.startedAt()).thenReturn(ctx);
    }

    private ProcessContext classify(ProcessContext ctx) {
        DocumentClassifier.ClassifierResult result = classifier.classify(ctx.fullText());
        ProcessingLog.log(ctx, "Classified as " + result.typeKey() + " (" + result.label() + ")");
        return ctx.withClassification(result.typeKey(), result.label(), result.fields())
                .withStatus(DocStatus.OCR_COMPLETED);
    }

    private Mono<ProcessContext> persistCompleted(ProcessContext ctx) {
        ctx.markCompleted();
        ProcessingLog.log(ctx, "Persisting COMPLETED (retries=" + ctx.retryCount() + ")");
        return repo.markCompleted(ctx.documentId(), ctx.completedAt(), ctx.retryCount(), successJson(ctx))
                .thenReturn(ctx);
    }

    private Mono<Void> handleFailure(DocumentReceivedEvent event, Throwable e) {
        ProcessContext ctx = ProcessContext.received(event);
        ctx.markFailed();
        ProcessingLog.error(ctx.documentId(), ctx.eventId(),
                "Pipeline terminated: " + e.getMessage(), e);
        Throwable c = e;
        int depth = 0;
        while (c != null && depth < 12) {
            System.err.println("[cause " + depth + "] " + c.getClass().getName() + ": " + c.getMessage());
            c = c.getCause();
            depth++;
        }
        return repo.markFailed(ctx.documentId(), ctx.completedAt(), ctx.retryCount(),
                        truncate(e.getMessage()), failureJson(ctx, e))
                .then(publisher.publishFailed(ctx, e))
                .then()
                .onErrorResume(e2 -> {
                    ProcessingLog.error(event.documentId(), event.eventId(),
                            "FAILED persistence/publish also failed: " + e2.getMessage(), e2);
                    return Mono.empty();
                });
    }

    /** Backoff retry that only applies to TRANSIENT failures. */
    private Retry retrySpec(ProcessContext ctx) {
        return Retry.backoff(MAX_ATTEMPTS - 1, Duration.ofMillis(400))
                .maxBackoff(Duration.ofSeconds(3))
                .filter(t -> t instanceof ProcessingException pe && pe.transientFailure())
                .doBeforeRetry(sig -> {
                    ctx.bumpRetry();
                    ProcessingLog.log(ctx, "Transient failure, retrying #" + sig.totalRetries()
                            + " — " + (sig.failure() == null ? "" : sig.failure().getMessage()));
                });
    }

    private String successJson(ProcessContext ctx) {
        ObjectNode o = mapper.createObjectNode();
        o.put("documentId", ctx.documentId());
        o.put("eventId", ctx.eventId());
        o.put("source", ctx.source());
        o.put("docLabel", ctx.docLabel());
        o.put("fullText", ctx.fullText());
        o.put("pages", ctx.pagesJson());
        o.set("values", mapper.valueToTree(ctx.extractedValues()));
        o.set("confidence", mapper.valueToTree(ctx.confidence()));
        o.put("retryCount", ctx.retryCount());
        o.put("completedAt", ctx.completedAt() == null ? null : ctx.completedAt().toString());
        return o.toString();
    }

    private String failureJson(ProcessContext ctx, Throwable e) {
        ObjectNode o = mapper.createObjectNode();
        o.put("documentId", ctx.documentId());
        o.put("eventId", ctx.eventId());
        o.put("status", "FAILED");
        o.put("error", truncate(e.getMessage()));
        o.put("retryCount", ctx.retryCount());
        o.put("failedAt", ctx.completedAt() == null ? null : ctx.completedAt().toString());
        return o.toString();
    }

    private static String truncate(String s) {
        if (s == null) return null;
        return s.length() > 2000 ? s.substring(0, 2000) : s;
    }
}