package com.rwms.docproc.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.rwms.docproc.pipeline.ProcessContext;
import com.rwms.docproc.util.ProcessingLog;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.concurrent.CompletableFuture;

/**
 * Publishes document.processed / document.failed. Sends are wrapped in
 * Mono.fromFuture so publishing slots into the reactive pipeline and can be
 * retried like every other stage.
 */
@Component
public class EventPublisher {

    private final KafkaTemplate<String, String> kafka;
    private final ObjectMapper mapper;
    private final String processedTopic;
    private final String failedTopic;

    public EventPublisher(KafkaTemplate<String, String> kafka, ObjectMapper mapper,
                          @Value("${app.kafka.processed-topic}") String processedTopic,
                          @Value("${app.kafka.failed-topic}") String failedTopic) {
        this.kafka = kafka;
        this.mapper = mapper;
        this.processedTopic = processedTopic;
        this.failedTopic = failedTopic;
    }

    public Mono<ProcessContext> publishProcessed(ProcessContext ctx) {
        ObjectNode payload = mapper.createObjectNode();
        payload.put("eventId", ctx.eventId());
        payload.put("documentId", ctx.documentId());
        payload.put("source", ctx.source());
        payload.put("status", "COMPLETED");
        payload.put("docLabel", ctx.docLabel());
        payload.put("fullText", ctx.fullText());
        payload.put("pages", ctx.pagesJson());
        payload.set("values", mapper.valueToTree(ctx.extractedValues()));
        payload.set("confidence", mapper.valueToTree(ctx.confidence()));
        payload.put("retryCount", ctx.retryCount());
        payload.put("processedAt", Instant.now().toString());

        ProcessingLog.log(ctx, "Publishing " + processedTopic);
        return send(processedTopic, ctx.documentId(), payload)
                .thenReturn(ctx)
                .doOnSuccess(c -> ProcessingLog.log(ctx, "PersistenceCompleted — DocumentProcessed published"));
    }

    public Mono<Void> publishFailed(ProcessContext ctx, Throwable failure) {
        ObjectNode payload = mapper.createObjectNode();
        payload.put("eventId", ctx.eventId());
        payload.put("documentId", ctx.documentId());
        payload.put("source", ctx.source());
        payload.put("status", "FAILED");
        payload.put("error", String.valueOf(failure.getMessage()));
        payload.put("retryCount", ctx.retryCount());
        payload.put("failedAt", Instant.now().toString());

        ProcessingLog.log(ctx, "Publishing " + failedTopic);
        return send(failedTopic, ctx.documentId(), payload).then();
    }

    private Mono<SendResult<String, String>> send(String topic, String key, ObjectNode payload) {
        CompletableFuture<SendResult<String, String>> future = kafka.send(topic, key, payload.toString());
        return Mono.fromFuture(future)
                .onErrorResume(e -> {
                    ProcessingLog.error(key, key, "kafka publish failed to " + topic, e);
                    return Mono.error(e);
                });
    }
}