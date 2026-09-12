package com.rwms.docproc.clients;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.rwms.docproc.pipeline.ProcessContext;
import com.rwms.docproc.util.ProcessingLog;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

/**
 * Best-effort write-back of results into the EXISTING Node import queue
 * (PATCH /api/imports/:id). This is what makes the processed document appear in
 * today's React ImportPage with zero frontend changes: the item was created by
 * /api/ingest with no text, and this call back-fills fullText/pages/extraction.
 */
@Component
public class RwmsQueueClient {

    private final HttpClients clients;
    private final ObjectMapper mapper;

    public RwmsQueueClient(HttpClients clients, ObjectMapper mapper) {
        this.clients = clients;
        this.mapper = mapper;
    }

    public Mono<ProcessContext> writeBack(ProcessContext ctx) {
        ObjectNode processing = mapper.createObjectNode();
        processing.put("service", "document-processing-service");
        processing.put("status", ctx.status().name());
        processing.put("eventId", ctx.eventId());
        processing.put("documentId", ctx.documentId());
        processing.put("retryCount", ctx.retryCount());
        processing.put("completedAt", ctx.completedAt() == null ? null : ctx.completedAt().toString());

        ObjectNode extracted = mapper.createObjectNode();
        extracted.put("docType", ctx.docLabel());
        extracted.set("values", mapper.valueToTree(ctx.extractedValues()));
        extracted.set("confidence", mapper.valueToTree(ctx.confidence()));

        ObjectNode body = mapper.createObjectNode();
        body.put("status", "unapproved"); // stay pending human review (existing UI contract)
        body.put("fullText", ctx.fullText());
        try {
            String pagesJson = ctx.pagesJson() == null ? "[]" : ctx.pagesJson();
            body.set("pages", mapper.readTree(pagesJson));
        } catch (java.io.IOException e) {
            body.put("pages", "[]");
        }
        body.set("extracted", extracted);
        body.set("processing", processing);

        ProcessingLog.log(ctx, "Writing back to RWMS queue");
        return clients.node()
                .patch()
                .uri("/api/imports/{id}", ctx.documentId())
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(String.class)
                .thenReturn(ctx)
                .onErrorResume(e -> {
                    ProcessingLog.warn(ctx, "Queue write-back failed (best-effort)", unwrap(e));
                    return Mono.just(ctx);
                });
    }

    private Throwable unwrap(Throwable e) {
        if (e instanceof WebClientResponseException wce) return wce;
        if (e instanceof WebClientRequestException wce) return wce;
        return e;
    }
}