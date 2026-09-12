package com.rwms.docproc;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.kafka.annotation.EnableKafka;

/** RWMS event-driven, reactive document-processing service (Java 21). */
@SpringBootApplication
@EnableKafka
public class DocProcessingApplication {

    public static void main(String[] args) {
        SpringApplication.run(DocProcessingApplication.class, args);
    }
}