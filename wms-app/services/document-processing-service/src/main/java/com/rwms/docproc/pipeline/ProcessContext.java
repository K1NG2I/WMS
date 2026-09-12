package com.rwms.docproc.pipeline;

import com.rwms.docproc.event.DocumentReceivedEvent;
import com.rwms.docproc.repository.DocStatus;

import java.time.Instant;
import java.util.List;

/**
 * Value carried through the reactive pipeline between stages. Holding the
 * transient pipeline state here (rather than mutable singletons / thread-local)
 * keeps every step explicit, traceable and naturally thread-safe.
 */
public class ProcessContext {

    private final DocumentReceivedEvent event;
    private DocStatus status;
    private byte[] documentBytes;
    private String fullText;
    private String pagesJson;
    private List<FieldSpec> fields;
    private String docLabel;
    private java.util.Map<String, String> extractedValues;
    private java.util.Map<String, Integer> confidence;
    private Instant startedAt;
    private Instant completedAt;
    private int retryCount;

    private ProcessContext(DocumentReceivedEvent event, DocStatus status) {
        this.event = event;
        this.status = status;
    }

    public static ProcessContext received(DocumentReceivedEvent event) {
        return new ProcessContext(event, DocStatus.RECEIVED);
    }

    public ProcessContext withStatus(DocStatus status) {
        this.status = status;
        return this;
    }

    public DocumentReceivedEvent event() {
        return event;
    }

    public String documentId() {
        return event.documentId();
    }

    public String eventId() {
        return event.eventId();
    }

    public String source() {
        return event.source();
    }

    public String fileName() {
        return event.fileName();
    }

    public DocStatus status() {
        return status;
    }

    public byte[] documentBytes() {
        return documentBytes;
    }

    public ProcessContext withDocumentBytes(byte[] bytes) {
        this.documentBytes = bytes;
        return this;
    }

    public String fullText() {
        return fullText;
    }

    public ProcessContext withOcr(String fullText, String pagesJson) {
        this.fullText = fullText;
        this.pagesJson = pagesJson;
        return this;
    }

    public String pagesJson() {
        return pagesJson;
    }

    public List<FieldSpec> fields() {
        return fields;
    }

    public String docLabel() {
        return docLabel;
    }

    public ProcessContext withClassification(String docLabel, List<FieldSpec> fields) {
        this.docLabel = docLabel;
        this.fields = fields;
        return this;
    }

    public java.util.Map<String, String> extractedValues() {
        return extractedValues;
    }

    public java.util.Map<String, Integer> confidence() {
        return confidence;
    }

    public ProcessContext withExtraction(java.util.Map<String, String> values,
                                         java.util.Map<String, Integer> confidence) {
        this.extractedValues = values;
        this.confidence = confidence;
        return this;
    }

    public Instant startedAt() {
        return startedAt;
    }

    public void markStarted() {
        this.startedAt = Instant.now();
        this.status = DocStatus.PROCESSING;
    }

    public Instant completedAt() {
        return completedAt;
    }

    public void markCompleted() {
        this.completedAt = Instant.now();
        this.status = DocStatus.COMPLETED;
    }

    public void markFailed() {
        this.completedAt = Instant.now();
        this.status = DocStatus.FAILED;
    }

    public int retryCount() {
        return retryCount;
    }

    public void bumpRetry() {
        this.retryCount++;
    }
}