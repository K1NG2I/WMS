package com.rwms.docproc.clients;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.rwms.docproc.pipeline.ProcessingException;
import com.rwms.docproc.pipeline.FieldSpec;
import com.rwms.docproc.pipeline.ProcessContext;
import com.rwms.docproc.util.ProcessingLog;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * AI field extraction via the EXISTING Node NVIDIA endpoint (/api/extract).
 * The NVIDIA model/fallback configuration lives in the Node process env and is
 * preserved as-is — this service only needs a text + field schema to send.
 * Communication is reactive (WebClient).
 */
@Component
public class ExtractionClient {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final HttpClients clients;

    public ExtractionClient(HttpClients clients) {
        this.clients = clients;
    }

    public Mono<ProcessContext> extract(ProcessContext ctx) {
        if (ctx.fields() == null || ctx.fields().isEmpty()) {
            return Mono.error(ProcessingException.permanentFailure(
                    "no field schema for extraction (classifier matched nothing)"));
        }
        ProcessingLog.log(ctx, "ExtractionStarted (model: nvidia, docLabel=" + ctx.docLabel() + ")");

        ObjectNode body = MAPPER.createObjectNode();
        body.put("text", ctx.fullText() == null ? "" : ctx.fullText());
        body.put("docLabel", ctx.docLabel() == null ? "Unknown" : ctx.docLabel());
        ArrayNode fields = body.putArray("fields");
        for (FieldSpec f : ctx.fields()) {
            ObjectNode n = fields.addObject();
            n.put("key", f.key());
            n.put("label", f.label());
            n.put("type", f.type());
        }

        return clients.node()
                .post()
                .uri("/api/extract")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .flatMap(json -> {
                    JsonNode values = json.path("values");
                    JsonNode conf = json.path("confidence");
                    Map<String, String> extracted = new LinkedHashMap<>();
                    Map<String, Integer> confidence = new LinkedHashMap<>();
                    values.fields().forEachRemaining(e ->
                            extracted.put(e.getKey(), e.getValue() == null ? "" : e.getValue().asText()));
                    conf.fields().forEachRemaining(e -> confidence.put(e.getKey(), e.getValue().asInt()));
                    ProcessingLog.log(ctx, "ExtractionCompleted (" + extracted.size() + " fields)");
                    return Mono.just(ctx.withExtraction(extracted, confidence));
                })
                .onErrorMap(this::mapError);
    }

    private Throwable mapError(Throwable e) {
        if (e instanceof WebClientResponseException wce) {
            if (wce.getStatusCode().is5xxServerError() || wce.getStatusCode() == org.springframework.http.HttpStatus.TOO_MANY_REQUESTS) {
                return ProcessingException.transientFailure("extraction 5xx/429: " + wce.getMessage(), e);
            }
            return ProcessingException.permanentFailure("extraction rejected: " + wce.getStatusCode(), e);
        }
        if (e instanceof WebClientRequestException) {
            return ProcessingException.transientFailure("extraction connection failure: " + e.getMessage(), e);
        }
        return ProcessingException.transientFailure("extraction failure: " + e.getMessage(), e);
    }
}