package com.rwms.docproc.pipeline;

/** A single field the extraction model should pull out of a document. */
public record FieldSpec(String key, String label, String type) {

    public static FieldSpec text(String key, String label) {
        return new FieldSpec(key, label, "text");
    }

    public static FieldSpec of(String key, String label, String type) {
        return new FieldSpec(key, label, type);
    }
}