package com.rwms.docproc.repository;

import io.r2dbc.spi.Row;
import io.r2dbc.spi.RowMetadata;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.function.BiFunction;

/**
 * R2DBC persistence for processing state. All calls are non-blocking.
 */
@Repository
public class DocumentProcessingRepository {

    private static final BiFunction<Row, RowMetadata, DocumentProcessingEntity> MAPPER = (row, md) -> {
        DocumentProcessingEntity e = new DocumentProcessingEntity();
        e.setId(row.get("id", Long.class));
        e.setDocumentId(row.get("document_id", String.class));
        e.setEventId(row.get("event_id", String.class));
        e.setSource(row.get("source", String.class));
        e.setFileName(row.get("file_name", String.class));
        e.setMimeType(row.get("mime_type", String.class));
        e.setStatus(row.get("status", String.class));
        e.setReceivedAt(row.get("received_at", Instant.class));
        e.setProcessingStartedAt(row.get("processing_started_at", Instant.class));
        e.setProcessingCompletedAt(row.get("processing_completed_at", Instant.class));
        e.setRetryCount(row.get("retry_count", Integer.class) == null ? 0 : row.get("retry_count", Integer.class));
        e.setErrorMessage(row.get("error_message", String.class));
        e.setResultJson(row.get("result_json", String.class));
        return e;
    };

    private final DatabaseClient db;

    public DocumentProcessingRepository(DatabaseClient db) {
        this.db = db;
    }

    public Mono<DocumentProcessingEntity> findByDocumentId(String documentId) {
        return db.sql("SELECT * FROM document_processing WHERE document_id = :id")
                .bind("id", documentId)
                .map(MAPPER)
                .one();
    }

    public Mono<DocumentProcessingEntity> insertReceived(DocumentProcessingEntity entity) {
        return db.sql("""
                    INSERT INTO document_processing
                      (document_id, event_id, source, file_name, mime_type, status, received_at)
                    VALUES (:documentId, :eventId, :source, :fileName, :mimeType, :status, :receivedAt)
                    RETURNING *
                """)
                .bind("documentId", entity.getDocumentId())
                .bind("eventId", entity.getEventId())
                .bind("source", entity.getSource())
                .bind("fileName", entity.getFileName())
                .bind("mimeType", entity.getMimeType())
                .bind("status", entity.getStatus())
                .bind("receivedAt", entity.getReceivedAt())
                .map(MAPPER)
                .one();
    }

    public Mono<Integer> markProcessing(String documentId, Instant startedAt) {
        return db.sql("""
                    UPDATE document_processing
                    SET status = :status, processing_started_at = :startedAt, updated_at = now()
                    WHERE document_id = :documentId
                """)
                .bind("status", DocStatus.PROCESSING.name())
                .bind("startedAt", startedAt)
                .bind("documentId", documentId)
                .fetch()
                .rowsUpdated();
    }

    public Mono<Integer> markCompleted(String documentId, Instant completedAt, int retryCount, String resultJson) {
        return db.sql("""
                    UPDATE document_processing
                    SET status = :status, processing_completed_at = :completedAt,
                        retry_count = :retryCount, result_json = :resultJson, error_message = NULL, updated_at = now()
                    WHERE document_id = :documentId
                """)
                .bind("status", DocStatus.COMPLETED.name())
                .bind("completedAt", completedAt)
                .bind("retryCount", retryCount)
                .bind("resultJson", resultJson)
                .bind("documentId", documentId)
                .fetch()
                .rowsUpdated();
    }

    public Mono<Integer> markFailed(String documentId, Instant failedAt, int retryCount, String errorMessage,
                                    String resultJson) {
        return db.sql("""
                    UPDATE document_processing
                    SET status = :status, processing_completed_at = :failedAt,
                        retry_count = :retryCount, error_message = :errorMessage,
                        result_json = :resultJson, updated_at = now()
                    WHERE document_id = :documentId
                """)
                .bind("status", DocStatus.FAILED.name())
                .bind("failedAt", failedAt)
                .bind("retryCount", retryCount)
                .bind("errorMessage", errorMessage)
                .bind("resultJson", resultJson)
                .bind("documentId", documentId)
                .fetch()
                .rowsUpdated();
    }
}