package com.rwms.docproc;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import okhttp3.mockwebserver.Dispatcher;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.kafka.KafkaContainer;
import org.testcontainers.utility.DockerImageName;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * End-to-end test with REAL Kafka, REAL PostgreSQL (Testcontainers) and a
 * stubbed "Node service" (MockWebServer). Verifies the reactive pipeline
 * completes documents concurrently and that redelivered events are idempotently
 * skipped at the terminal guard.
 */
@SpringBootTest
@Testcontainers
class DocumentProcessingIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("rwms")
            .withUsername("rwms")
            .withPassword("rwms");

    @Container
    static final KafkaContainer KAFKA = new KafkaContainer(DockerImageName.parse("apache/kafka:3.9.0"));

    static final MockWebServer nodeStub;

    static {
        try {
            nodeStub = new MockWebServer();
            nodeStub.setDispatcher(new StubDispatcher());
            nodeStub.start();
        } catch (Exception e) {
            throw new ExceptionInInitializerError(e);
        }
    }

    @Autowired
    DatabaseClient db;

    @Autowired
    KafkaTemplate<String, String> kafka;

    @Autowired
    ObjectMapper mapper;

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) {
        registry.add("spring.r2dbc.url", () -> "r2dbc:postgresql://" + POSTGRES.getHost() + ":" + POSTGRES.getMappedPort(5432) + "/rwms");
        registry.add("spring.r2dbc.username", POSTGRES::getUsername);
        registry.add("spring.r2dbc.password", POSTGRES::getPassword);
        registry.add("spring.kafka.bootstrap-servers", () -> KAFKA.getBootstrapServers());
        registry.add("app.node-api-url", () -> nodeStub.url("/").toString());
        registry.add("app.kafka.listener-concurrency", () -> 3);
        registry.add("app.kafka.received-topic", () -> "document.received");
        registry.add("app.kafka.processed-topic", () -> "document.processed");
        registry.add("app.kafka.failed-topic", () -> "document.failed");
    }

    static final class StubDispatcher extends Dispatcher {
        @Override
        public MockResponse dispatch(RecordedRequest request) {
            String path = request.getPath() == null ? "" : request.getPath();
            if ("GET".equals(request.getMethod()) && path.startsWith("/docbytes")) {
                return new MockResponse().setResponseCode(200)
                        .setHeader("Content-Type", "application/pdf")
                        .setBody(new String(new byte[]{37, 80, 68, 70}, StandardCharsets.ISO_8859_1)); // %PDF (any bytes fine)
            }
            if ("POST".equals(request.getMethod()) && path.contains("/api/import/ocr")) {
                return new MockResponse().setResponseCode(200).setBody("""
                        {"fullText":"Gate Inward vehicle no MH12AB1234 driver Rajesh eway bill 271234567890 dock door receiving",
                         "pages":[{"page":1,"text":"gate inward"}]}
                        """);
            }
            if ("POST".equals(request.getMethod()) && path.contains("/api/extract")) {
                return new MockResponse().setResponseCode(200).setBody("""
                        {"values":{"documentNo":"GIN-2001","customerName":"Acme Pvt Ltd","vehicleNo":"MH12AB1234","driverName":"Rajesh","ewayBillNo":"271234567890"},
                         "confidence":{"documentNo":97,"customerName":95,"vehicleNo":96,"driverName":98,"ewayBillNo":99}}
                        """);
            }
            if ("PATCH".equals(request.getMethod()) && path.contains("/api/imports/")) {
                return new MockResponse().setResponseCode(200).setBody("{\"ok\":true}");
            }
            return new MockResponse().setResponseCode(404);
        }
    }

    @Test
    void completeDocumentsConcurrentlyAndIgnoreRedeliveries() throws Exception {
        String topic = "document.received";
        String base = nodeStub.url("/docbytes").toString();
        List<String> documentIds = new java.util.ArrayList<>();

        // Publish 3 distinct documents (different keys → different partitions in prod; guarded regardless).
        for (int i = 0; i < 3; i++) {
            String eventId = UUID.randomUUID().toString();
            String documentId = "imp-" + UUID.randomUUID().toString().substring(0, 8);
            documentIds.add(documentId);
            publish(topic, documentId, eventId, base);
        }

        awaitAllCompleted(30_000);

        List<String> statuses = allStatuses();
        assertThat(statuses).hasSize(3);
        assertThat(statuses).containsOnly("COMPLETED");

        // Idempotency: redelivering an already-terminal document (Kafka at-least-once)
        // must be skipped by the guard — no new row, no reprocessing.
        long before = rowCount();
        publish(topic, documentIds.get(0), "event-dup-1", base);
        Thread.sleep(2_000);
        assertThat(rowCount()).isEqualTo(before);
        publish(topic, documentIds.get(0), "event-dup-2", base);
        Thread.sleep(2_000);
        assertThat(rowCount()).isEqualTo(before);
    }

    private void publish(String topic, String documentId, String eventId, String base) {
        ObjectNode o = mapper.createObjectNode();
        o.put("eventId", eventId);
        o.put("documentId", documentId);
        o.put("source", "integration-test");
        o.put("fileName", "Gate_Inward.pdf");
        o.put("mimeType", "application/pdf");
        o.put("fileLocation", base);
        o.put("receivedAt", java.time.Instant.now().toString());
        o.putObject("metadata").put("docType", "gateInward");
        kafka.send(topic, documentId, o.toString()).join();
    }

    private void awaitAllCompleted(long timeoutMs) throws InterruptedException {
        long deadline = System.currentTimeMillis() + timeoutMs;
        while (System.currentTimeMillis() < deadline) {
            List<String> statuses = allStatuses();
            if (statuses.size() == 3 && statuses.stream().allMatch("COMPLETED"::equals)) {
                return;
            }
            Thread.sleep(500);
        }
        throw new AssertionError("documents did not reach COMPLETED in time: " + allStatuses());
    }

    private List<String> allStatuses() {
        return db.sql("SELECT status FROM document_processing ORDER BY document_id")
                .map((row, meta) -> row.get(0, String.class))
                .all()
                .collectList()
                .block(Duration.ofSeconds(5));
    }

    private long rowCount() {
        Long n = db.sql("SELECT count(*) FROM document_processing")
                .map((row, meta) -> row.get(0, Long.class))
                .one()
                .block(Duration.ofSeconds(5));
        return n == null ? 0 : n;
    }
}