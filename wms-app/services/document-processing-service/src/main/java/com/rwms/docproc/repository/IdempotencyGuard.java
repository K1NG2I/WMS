package com.rwms.docproc.repository;

import com.rwms.docproc.event.DocumentReceivedEvent;
import io.r2dbc.spi.Connection;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

/**
 * Duplicate-processing protection. Kafka at-least-once delivery means the same
 * documentId can be redelivered after a crash or rebalance, and duplicate
 * events may race two consumers. We guard with a UNIQUE(document_id) row:
 * the first insert wins; a later delivery of an in-flight or terminal document
 * is skipped. Business-level idempotency — never assumed from Kafka.
 */
@Component
public class IdempotencyGuard {

    /** Fresh insert — processing must proceed. */
    public static final int NEW_DOCUMENT = 0;
    /** Row exists and is in flight / not terminal — another consumer is on it. */
    public static final int ALREADY_STARTED = 1;
    /** Row exists in a terminal state (COMPLETED/FAILED) — never reprocess. */
    public static final int DUPLICATE_TERMINAL = 2;

    private final DatabaseClient db;

    public IdempotencyGuard(DatabaseClient db) {
        this.db = db;
    }

    public Mono<Integer> begin(DocumentReceivedEvent event) {
        return doInsert(event)
                .onErrorResume(this::isUniqueViolation, e -> existingStatus(event.documentId()))
                .defaultIfEmpty(ALREADY_STARTED);
    }

    private Mono<Integer> doInsert(DocumentReceivedEvent event) {
        return db.inConnection(con -> {
            java.time.Instant receivedAt = event.receivedAt() == null ? java.time.Instant.now() : event.receivedAt();
            return Mono.from(con.createStatement("""
                            INSERT INTO document_processing
                              (document_id, event_id, source, file_name, mime_type, status, received_at)
                            VALUES ($1, $2, $3, $4, $5, 'RECEIVED', $6)
                        """)
                            .bind("$1", event.documentId())
                            .bind("$2", event.eventId())
                            .bind("$3", event.source())
                            .bind("$4", event.fileName())
                            .bind("$5", event.mimeType())
                            .bind("$6", receivedAt)
                            .execute())
                    .then(Mono.just(NEW_DOCUMENT));
        });
    }

    private Mono<Integer> existingStatus(String documentId) {
        return db.sql("SELECT status FROM document_processing WHERE document_id = :id")
                .bind("id", documentId)
                .map((row, meta) -> row.get("status", String.class))
                .map(s -> DocStatus.valueOf(s).terminal() ? DUPLICATE_TERMINAL : ALREADY_STARTED)
                .defaultIfEmpty(ALREADY_STARTED);
    }

    private boolean isUniqueViolation(Throwable e) {
        String m = String.valueOf(e).toLowerCase();
        return m.contains("unique") || m.contains("duplicate key");
    }
}