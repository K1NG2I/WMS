package com.rwms.docproc.repository;

/** Durable per-document processing state (tracked in PostgreSQL). */
public enum DocStatus {
    RECEIVED,
    PROCESSING,
    OCR_COMPLETED,
    EXTRACTION_COMPLETED,
    COMPLETED,
    FAILED;

    public boolean terminal() {
        return this == COMPLETED || this == FAILED;
    }
}