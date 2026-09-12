package com.rwms.docproc.validation;

import com.rwms.docproc.pipeline.ProcessingException;
import com.rwms.docproc.pipeline.ProcessContext;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

/**
 * Validates pipeline output. Failures here are PERMANENT — never retried.
 */
@Component
public class DocumentValidator {

    public Mono<ProcessContext> validate(ProcessContext ctx) {
        ProcessingLog.log(ctx, "Validating extraction");
        if (ctx.fullText() == null || ctx.fullText().isBlank()) {
            return Mono.error(ProcessingException.permanentFailure(
                    "OCR produced no text — blank/unsupported document"));
        }
        if (ctx.fields() == null || ctx.fields().isEmpty()) {
            return Mono.error(ProcessingException.permanentFailure(
                    "no fields classified for document"));
        }
        if (ctx.extractedValues() == null || ctx.extractedValues().isEmpty()) {
            return Mono.error(ProcessingException.permanentFailure(
                    "AI extraction returned no values for recognized document type"));
        }
        // For workflow documents whose schema includes a reference field
        // (documentNo / GRN / LR no), a blank value means a bad read. Document
        // types without one (e.g. labour attendance) are not affected.
        boolean wantsRef = !"unknown".equals(ctx.docLabel())
                && ctx.fields().stream().anyMatch(f -> isReferenceKey(f.key()));
        if (wantsRef) {
            boolean hasRef = ctx.extractedValues().entrySet().stream()
                    .anyMatch(e -> isReferenceKey(e.getKey()) && !e.getValue().isBlank());
            if (!hasRef) {
                return Mono.error(ProcessingException.permanentFailure(
                        "no document reference extracted for " + ctx.docLabel()));
            }
        }
        ProcessingLog.log(ctx, "Validation passed");
        return Mono.just(ctx);
    }

    private static boolean isReferenceKey(String key) {
        String k = key.toLowerCase();
        return k.contains("documentno") || k.contains("grn") || k.contains("lrno")
                || k.contains("lr no") || k.contains("invoice no");
    }
}