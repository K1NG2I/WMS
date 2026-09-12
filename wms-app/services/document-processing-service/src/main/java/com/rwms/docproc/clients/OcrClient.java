package com.rwms.docproc.clients;

import com.fasterxml.jackson.databind.JsonNode;
import com.rwms.docproc.pipeline.ProcessingException;
import com.rwms.docproc.pipeline.ProcessContext;
import com.rwms.docproc.util.ProcessingLog;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

/**
 * Reuses the EXISTING Node OCR endpoint (MuPDF + Google Vision) over HTTP
 * instead of re-implementing OCR in Java. Uploads the raw bytes as multipart,
 * exactly like the frontend does — WebClient makes this non-blocking.
 */
@Component
public class OcrClient {

    private final HttpClients clients;

    public OcrClient(HttpClients clients) {
        this.clients = clients;
    }

    public Mono<ProcessContext> ocr(ProcessContext ctx) {
        if (ctx.documentBytes() == null) {
            return Mono.error(ProcessingException.permanentFailure("no bytes to OCR"));
        }
        ProcessingLog.log(ctx, "OCRStarted");

        MultipartBodyBuilder body = new MultipartBodyBuilder();
        body.part("file", new ByteArrayResource(ctx.documentBytes()))
                .filename(fileName(ctx))
                .contentType(mediaType(ctx.event().mimeType()));

        return clients.node()
                .post()
                .uri("/api/import/ocr")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(BodyInserters.fromMultipartData(body.build()))
                .retrieve()
                .bodyToMono(JsonNode.class)
                .flatMap(json -> {
                    String fullText = json.path("fullText").asText("");
                    String pagesJson = json.has("pages") ? json.path("pages").toString() : "[]";
                    ProcessingLog.log(ctx, "OCRCompleted (" + json.path("pages").size() + " pages, "
                            + fullText.length() + " chars)");
                    return Mono.just(ctx.withOcr(fullText, pagesJson));
                })
                .onErrorMap(this::mapError);
    }

    private Throwable mapError(Throwable e) {
        if (e instanceof WebClientResponseException wce) {
            String detail = bodyDetail(wce);
            if (isPdfParseError(detail)) {
                return ProcessingException.permanentFailure("OCR rejected document: " + detail, e);
            }
            if (wce.getStatusCode().is5xxServerError()) {
                return ProcessingException.transientFailure("OCR 5xx: " + wce.getStatusCode() + " " + detail, e);
            }
            return ProcessingException.permanentFailure("OCR failed: " + wce.getStatusCode(), e);
        }
        if (e instanceof WebClientRequestException) {
            return ProcessingException.transientFailure("OCR connection failure: " + e.getMessage(), e);
        }
        return ProcessingException.transientFailure("OCR failure: " + e.getMessage(), e);
    }

    private static boolean isPdfParseError(String detail) {
        String d = detail == null ? "" : detail.toLowerCase();
        return d.contains("cannot find startxref") || d.contains("broken xref")
                || d.contains("invalid pdf") || d.contains("failed to parse");
    }

    private static String bodyDetail(WebClientResponseException wce) {
        try {
            return wce.getResponseBodyAsString();
        } catch (Exception e) {
            return wce.getMessage();
        }
    }

    private static String fileName(ProcessContext ctx) {
        String name = ctx.fileName();
        return name == null || name.isBlank() ? "document.bin" : name;
    }

    private static MediaType mediaType(String mime) {
        if ("image/png".equals(mime)) return MediaType.IMAGE_PNG;
        if ("image/jpeg".equals(mime)) return MediaType.IMAGE_JPEG;
        return MediaType.APPLICATION_PDF;
    }
}