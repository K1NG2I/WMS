package com.rwms.docproc.messaging;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rwms.docproc.event.DocumentReceivedEvent;
import com.rwms.docproc.pipeline.DocumentProcessingPipeline;
import com.rwms.docproc.util.ProcessingLog;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Consumes document.received. Manual immediate acking means a crash before
 * ack causes redelivery — which is exactly what the idempotency guard is for.
 */
@Component
public class DocumentReceivedListener {

    private final DocumentProcessingPipeline pipeline;
    private final ObjectMapper mapper;

    public DocumentReceivedListener(DocumentProcessingPipeline pipeline, ObjectMapper mapper) {
        this.pipeline = pipeline;
        this.mapper = mapper;
    }

    @KafkaListener(topics = "${app.kafka.received-topic}",
            concurrency = "${app.kafka.listener-concurrency}",
            ackMode = "MANUAL_IMMEDIATE")
    public void onDocumentReceived(ConsumerRecord<String, String> record, Acknowledgment ack) {
        DocumentReceivedEvent event;
        try {
            Map<String, Object> map = mapper.readValue(
                    record.value(), new TypeReference<Map<String, Object>>() {});
            event = DocumentReceivedEvent.parse(map);
        } catch (Exception e) {
            ProcessingLog.error(record.key(), record.key(),
                    "Unparseable document.received, acking to skip: " + e.getMessage(), e);
            ack.acknowledge();
            return;
        }
        ProcessingLog.logEvent(event, "DocumentReceived");
        pipeline.process(event)
                .doFinally(signal -> ack.acknowledge())
                .subscribe();
    }
}