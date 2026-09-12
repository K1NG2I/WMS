package com.rwms.docproc.event;

import java.time.Instant;
import java.util.Map;

/**
 * Payload of a Kafka {@code document.received} event, published by the Node
 * ingestion layer after a document has been durably stored.
 *
 * documentId is the stable queue id (imp-&lt;uuid8&gt;) and is the idempotency key.
 */
public record DocumentReceivedEvent(
        String eventId,
        String documentId,
        String source,
        String fileName,
        String mimeType,
        String fileLocation,
        Instant receivedAt,
        Map<String, String> metadata) {

    public static DocumentReceivedEvent parse(Map<String, Object> map) {
        Map<String, String> meta = map.get("metadata") instanceof Map<?, ?> m
                ? Map.copyOf(m.entrySet().stream().collect(
                        java.util.stream.Collectors.toMap(e -> String.valueOf(e.getKey()), e -> String.valueOf(e.getValue()))))
                : Map.of();
        return new DocumentReceivedEvent(
                str(map, "eventId"),
                str(map, "documentId"),
                str(map, "source"),
                str(map, "fileName"),
                str(map, "mimeType"),
                str(map, "fileLocation"),
                map.get("receivedAt") instanceof String s ? Instant.parse(s) : null,
                meta);
    }

    private static String str(Map<String, Object> map, String key) {
        Object v = map.get(key);
        return v == null ? "" : String.valueOf(v);
    }
}