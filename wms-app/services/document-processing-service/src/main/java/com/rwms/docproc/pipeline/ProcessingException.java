package com.rwms.docproc.pipeline;

/**
 * Failure model for the processing pipeline.
 *
 * TRANSIENT — safe to retry (network blips, 5xx from OCR/NVIDIA/Node, broker
 * hiccups). Retried with backoff by the Reactor pipeline, then treated as a
 * terminal FAILED state after exhaustion.
 *
 * PERMANENT — retrying is pointless (invalid PDF, unparseable AI response,
 * validation failure). Recorded as FAILED immediately, never retried.
 */
public class ProcessingException extends RuntimeException {

    public enum Kind { TRANSIENT, PERMANENT }

    private final Kind kind;

    public ProcessingException(Kind kind, String message) {
        super(message);
        this.kind = kind;
    }

    public ProcessingException(Kind kind, String message, Throwable cause) {
        super(message, cause);
        this.kind = kind;
    }

    public Kind kind() {
        return kind;
    }

    public boolean transientFailure() {
        return kind == Kind.TRANSIENT;
    }

    public static ProcessingException transientFailure(String message) {
        return new ProcessingException(Kind.TRANSIENT, message);
    }

    public static ProcessingException transientFailure(String message, Throwable cause) {
        return new ProcessingException(Kind.TRANSIENT, message, cause);
    }

    public static ProcessingException permanentFailure(String message) {
        return new ProcessingException(Kind.PERMANENT, message);
    }

    public static ProcessingException permanentFailure(String message, Throwable cause) {
        return new ProcessingException(Kind.PERMANENT, message, cause);
    }
}