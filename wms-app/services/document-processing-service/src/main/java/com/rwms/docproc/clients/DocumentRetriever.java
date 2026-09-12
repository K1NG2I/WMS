package com.rwms.docproc.clients;

import com.rwms.docproc.pipeline.ProcessingException;
import com.rwms.docproc.util.ProcessingLog;
import com.rwms.docproc.pipeline.ProcessContext;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

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
                .uri(location)
                .retrieve()
                .bodyToMono(byte[].class)
                .map(bytes -> ctx.withDocumentBytes(bytes))
                .onErrorMap(this::mapError)
                .doOnSuccess(c -> ProcessingLog.log(ctx, "Document retrieved (" + c.documentBytes().length + " bytes)"));
    }

    private Throwable mapError(Throwable e) {
        if (e instanceof WebClientResponseException wce) {
            if (wce.getStatusCode().is5xxServerError()) {
                return ProcessingException.transientFailure("retrieval 5xx: " + wce.getStatusCode(), e);
            }
            return ProcessingException.permanentFailure("retrieval failed: " + wce.getStatusCode(), e);
        }
        return ProcessingException.transientFailure("retrieval network failure: " + e.getMessage(), e);
    }
}