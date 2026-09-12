package com.rwms.docproc.persistence;

import io.r2dbc.spi.ConnectionFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

/**
 * Creates the processing-state table at startup (idempotent DDL). Kept in
 * SQL here rather than Flyway so the service depends only on R2DBC.
 */
@Component
public class SchemaInitializer implements ApplicationRunner {

    private static final String DDL = """
            CREATE TABLE IF NOT EXISTS document_processing (
              id                      BIGSERIAL PRIMARY KEY,
              document_id             VARCHAR(64)  NOT NULL UNIQUE,
              event_id                VARCHAR(64)  NOT NULL,
              source                  VARCHAR(32)  NOT NULL,
              file_name               VARCHAR(255),
              mime_type               VARCHAR(64),
              status                  VARCHAR(32)  NOT NULL,
              received_at             TIMESTAMPTZ  NOT NULL,
              processing_started_at   TIMESTAMPTZ,
              processing_completed_at TIMESTAMPTZ,
              retry_count             INT          NOT NULL DEFAULT 0,
              error_message           TEXT,
              result_json             TEXT,
              created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
              updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_document_processing_document
              ON document_processing (document_id);
            CREATE INDEX IF NOT EXISTS idx_document_processing_status
              ON document_processing (status);
            CREATE INDEX IF NOT EXISTS idx_document_processing_event
              ON document_processing (event_id);
            """;

    private final DatabaseClient db;

    public SchemaInitializer(ConnectionFactory cf) {
        this.db = DatabaseClient.create(cf);
    }

    @Override
    public void run(ApplicationArguments args) {
        for (String stmt : DDL.split(";")) {
            String sql = stmt.trim();
            if (sql.isEmpty()) continue;
            db.sql(sql).then().block();
        }
        System.out.println("[schema] document_processing table ready");
    }
}