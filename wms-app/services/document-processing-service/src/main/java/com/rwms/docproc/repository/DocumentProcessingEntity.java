package com.rwms.docproc.repository;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;

/** Row in the durable processing-state table. */
@Table("document_processing")
public class DocumentProcessingEntity {

    @Id
    private Long id;

    @Column("document_id")
    private String documentId;

    @Column("event_id")
    private String eventId;

    @Column("source")
    private String source;

    @Column("file_name")
    private String fileName;

    @Column("mime_type")
    private String mimeType;

    @Column("status")
    private String status;

    @Column("received_at")
    private Instant receivedAt;

    @Column("processing_started_at")
    private Instant processingStartedAt;

    @Column("processing_completed_at")
    private Instant processingCompletedAt;

    @Column("retry_count")
    private int retryCount;

    @Column("error_message")
    private String errorMessage;

    @Column("result_json")
    private String resultJson;

    public DocumentProcessingEntity() {
    }

    public DocumentProcessingEntity(String documentId, String eventId, String source,
                                    String fileName, String mimeType, String status, Instant receivedAt) {
        this.documentId = documentId;
        this.eventId = eventId;
        this.source = source;
        this.fileName = fileName;
        this.mimeType = mimeType;
        this.status = status;
        this.receivedAt = receivedAt;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getDocumentId() { return documentId; }
    public void setDocumentId(String documentId) { this.documentId = documentId; }

    public String getEventId() { return eventId; }
    public void setEventId(String eventId) { this.eventId = eventId; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }

    public String getMimeType() { return mimeType; }
    public void setMimeType(String mimeType) { this.mimeType = mimeType; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Instant getReceivedAt() { return receivedAt; }
    public void setReceivedAt(Instant receivedAt) { this.receivedAt = receivedAt; }

    public Instant getProcessingStartedAt() { return processingStartedAt; }
    public void setProcessingStartedAt(Instant processingStartedAt) { this.processingStartedAt = processingStartedAt; }

    public Instant getProcessingCompletedAt() { return processingCompletedAt; }
    public void setProcessingCompletedAt(Instant processingCompletedAt) { this.processingCompletedAt = processingCompletedAt; }

    public int getRetryCount() { return retryCount; }
    public void setRetryCount(int retryCount) { this.retryCount = retryCount; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    public String getResultJson() { return resultJson; }
    public void setResultJson(String resultJson) { this.resultJson = resultJson; }
}