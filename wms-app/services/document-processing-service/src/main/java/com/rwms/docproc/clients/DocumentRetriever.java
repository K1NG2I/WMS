package com.rwms.docproc.clients;

import com.rwms.docproc.pipeline.ProcessingException;
import com.rwms.docproc.util.ProcessingLog;
import com.rwms.docproc.pipeline.ProcessContext;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import java.net.URI;

/**
 * Retrieves the raw stored document (from object storage) over HTTP using the
 * presigned fileLocation published in the event — a genuine non-blocking call.
 */
@Component
public class DocumentRetriever {

    private final HttpClients clients;

    public DocumentRetriever(HttpClients clients) {
        this.clients = clients;
    }

    public Mono<ProcessContext> retrieve(ProcessContext ctx) {
        String location = ctx.event().fileLocation();
        if (location == null || location.isBlank()) {
            return Mono.error(ProcessingException.permanentFailure("fileLocation missing on event"));
        }
        ProcessingLog.log(ctx, "Retrieving document");
        return clients.retrieval()
                .get()
                // Pass the presigned URL as a URI (not a template) so the SDK's
                // percent-encoded query params are NOT re-encoded and the MinIO
                // signature still matches.
                .uri(URI.create(location))
                .retrieve()
                .bodyToMono(byte[].class)
                .map(bytes -> ctx.withDocumentBytes(bytes))
                .onErrorMap(this::mapError)
                .doOnSuccess(c -> ProcessingLog.log(ctx, "Document retrieved (" + c.documentBytes().length + " bytes)"));
    }

    private Throwable mapError(Throwable e) {
        if (e instanceof WebClientResponseException wce) {
            String body = wce.getResponseBodyAsString();
            body = (body == null || body.isBlank()) ? "" : " body=" + body.replace('\n', ' ').replace('\r', ' ').trim();
            if (wce.getStatusCode().is5xxServerError()) {
                return ProcessingException.transientFailure("retrieval 5xx: " + wce.getStatusCode() + body, e);
            }
            return ProcessingException.permanentFailure("retrieval failed: " + wce.getStatusCode() + " headers=" + wce.getHeaders() + body, e);
        }
        return ProcessingException.transientFailure(
                "retrieval network failure: " + e.getClass().getSimpleName() + ": " + e.getMessage(), e);
    }
}