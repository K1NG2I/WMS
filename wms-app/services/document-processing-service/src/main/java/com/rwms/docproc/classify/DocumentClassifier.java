package com.rwms.docproc.classify;

import com.rwms.docproc.pipeline.FieldSpec;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Lightweight keyword-based document classifier mirroring {@code src/lib/import.js}
 * (detectDocType). Runs purely in-Java so the service stays decoupled from the
 * React frontend. For a production system a trained classifier would replace this.
 */
@Component
public class DocumentClassifier {

    private static final Map<String, KeywordSpec> SPECS = Map.of(
            "preGateInward",      new KeywordSpec("Pre Gate Inward", List.of(
                    "pre gate", "pre-gate", "expected arrival", "arrival notice", "gate in"),
                    List.of("documentNo", "customerName", "vendorConsignor", "expectedArrivalDate", "preparedBy")),
            "gateInward",         new KeywordSpec("Gate Inward", List.of(
                    "gate inward", "vehicle no", "vehicle number", "eway", "e-way", "eway bill", "truck no", "driver"),
                    List.of("documentNo", "customerName", "vehicleNo", "driverName", "ewayBillNo")),
            "inward",             new KeywordSpec("Inward", List.of(
                    "purchase order", "po reference", "po no", "consignor", "inward", "package count"),
                    List.of("documentNo", "purchaseOrderNo", "vendorConsignor", "packageCount")),
            "checklistUnloading", new KeywordSpec("Checklist Unloading", List.of(
                    "checklist unloading", "seal status", "dock bay", "unloading"),
                    List.of("documentNo", "dockBay", "sealStatus", "vehicleNo")),
            "qualityCheck",       new KeywordSpec("Quality Check", List.of(
                    "quality check", "sample units", "sample inspected", "passed quantity", "defect"),
                    List.of("documentNo", "sampleInspected", "passedQuantity", "defects")),
            "goodReceiptNote",    new KeywordSpec("Good Receipt Note", List.of(
                    "good receipt note", "grn", "received by", "putaway", "bin / rack", "warehouse officer"),
                    List.of("documentNo", "receivedBy", "putawayBin", "totalQuantity")),
            "pickList",           new KeywordSpec("Pick List", List.of(
                    "pick list", "picking list", "pick request", "dispatch priority"),
                    List.of("documentNo", "pickRequestId", "dispatchPriority")),
            "pick",               new KeywordSpec("Pick", List.of(
                    "picker", "qty picked", "quantity picked", "source bin", "bin tag"),
                    List.of("documentNo", "pickerName", "quantityPicked", "sourceBin")),
            "qualityCheckOutward",new KeywordSpec("Quality Check Outward", List.of(
                    "quality check outward", "packaging integrity", "gross weight", "qc outward"),
                    List.of("documentNo", "packagingIntegrity", "grossWeight")),
            "checklistLoading",   new KeywordSpec("Checklist Loading", List.of(
                    "checklist loading", "loading bay", "lashing", "strapping"),
                    List.of("documentNo", "loadingBay", "transportVehicle", "sealNo")),
            "dispatch",           new KeywordSpec("Dispatch", List.of(
                    "dispatch", "lr number", "lr no", "transporter", "consignment note"),
                    List.of("documentNo", "lrNo", "transporter", "consignee")),
            "outward",            new KeywordSpec("Outward", List.of(
                    "outward", "sales order", "dispatch note", "outward gate"),
                    List.of("documentNo", "salesOrderNo", "consignee", "vehicleNo")),
            "bill",               new KeywordSpec("Bill", List.of(
                    "bill", "invoice amount", "gst", "total payable", "bill no"),
                    List.of("documentNo", "vendorName", "amount", "gst", "totalPayable")),
            "invoice",            new KeywordSpec("Invoice", List.of(
                    "invoice", "tax invoice", "invoice no", "invoice date"),
                    List.of("documentNo", "customerName", "amount", "invoiceDate")),
            "payment",            new KeywordSpec("Payment", List.of(
                    "payment", "payment received", "payment mode", "payment date"),
                    List.of("documentNo", "amount", "paymentMode", "paymentDate")),
            "labourAttendance",   new KeywordSpec("Labour Attendance", List.of(
                    "labour attendance", "labourer", "hours worked", "man hours"),
                    List.of("employeeName", "date", "hoursWorked")),
            "mheAttendance",      new KeywordSpec("MHE Attendance", List.of(
                    "mhe attendance", "mhe", "forklift", "reach truck", "mhe hours"),
                    List.of("operatorName", "mheType", "hoursOperated"))
    );

    /**
     * Detect document type from OCR full text. Returns a non-null {@link ClassifierResult}
     * even for unknown types (label becomes the file name, fields an empty list).
     */
    public ClassifierResult classify(String fullText) {
        String lower = (fullText == null ? "" : fullText).toLowerCase();

        for (var entry : SPECS.entrySet()) {
            long matches = entry.getValue().keywords().stream().filter(lower::contains).count();
            if (matches >= 2 || (matches == 1 && entry.getValue().keywords().size() <= 2)) {
                return new ClassifierResult(
                        entry.getKey(),
                        entry.getValue().label(),
                        entry.getValue().fields().stream()
                                .map(k -> FieldSpec.text(k, prettyLabel(k)))
                                .toList());
            }
        }
        // Fallback: try any single-keyword match
        for (var entry : SPECS.entrySet()) {
            if (entry.getValue().keywords().stream().anyMatch(lower::contains)) {
                return new ClassifierResult(
                        entry.getKey(),
                        entry.getValue().label(),
                        entry.getValue().fields().stream()
                                .map(k -> FieldSpec.text(k, prettyLabel(k)))
                                .toList());
            }
        }
        return new ClassifierResult("unknown", "Warehouse Document", List.of(
                FieldSpec.text("documentNo", "Document No"),
                FieldSpec.text("customerName", "Customer Name"),
                FieldSpec.text("vendorConsignor", "Vendor / Consignor"),
                FieldSpec.text("vehicleNo", "Vehicle No")));
    }

    private static String prettyLabel(String key) {
        return key.replaceAll("([A-Z])", " $1").replaceAll("^.", String::toUpperCase).trim();
    }

    record KeywordSpec(String label, List<String> keywords, List<String> fields) {}

    public record ClassifierResult(String typeKey, String label, List<FieldSpec> fields) {}
}