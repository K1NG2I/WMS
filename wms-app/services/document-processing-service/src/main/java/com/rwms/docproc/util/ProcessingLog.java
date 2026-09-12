package com.rwms.docproc.util;

import com.rwms.docproc.event.DocumentReceivedEvent;
import com.rwms.docproc.pipeline.ProcessContext;

import java.time.Instant;

/**
 * Structured trace logging. Every document is tracked with its documentId and
 * eventId so the whole lifecycle can be followed in one place:
 * DocumentReceived → ProcessingStarted → OCRStarted/Completed →
 * ExtractionStarted/Completed → PersistenceCompleted → DocumentProcessed.
 */
public final class ProcessingLog {

    private ProcessingLog() {
    }

    public static void log(ProcessContext ctx, String message) {
        emit(ctx.documentId(), ctx.eventId(), ctx.status().name(), message);
    }

    public static void logEvent(DocumentReceivedEvent event, String message) {
        emit(event.documentId(), event.eventId(), "RECEIVED", message);
    }

    public static void warn(ProcessContext ctx, String message, Throwable t) {
        System.out.printf("%s [warn] [doc=%s event=%s %s] %s — %s%n",
                Instant.now(), ctx.documentId(), ctx.eventId(), ctx.status().name(),
                message, t == null ? "" : t.getMessage());
    }

    public static void error(String documentId, String eventId, String message, Throwable t) {
        System.err.printf("%s [error] [doc=%s event=%s] %s — %s%n",
                Instant.now(), documentId, eventId, message, t == null ? "" : t.getMessage());
    }

    private static void emit(String documentId, String eventId, String status, String message) {
        System.out.printf("%s [doc=%s event=%s status=%s] %s%n",
                Instant.now(), documentId, eventId, status, message);
    }
}