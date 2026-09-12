package com.rwms.docproc.clients;

import io.netty.channel.ChannelOption;
import io.netty.handler.timeout.ReadTimeoutHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

/** Shared WebClient instances. All HTTP I/O is non-blocking (Reactor Netty). */
@Component
public class HttpClients {

    private final WebClient nodeClient;
    private final WebClient retrievalClient;

    public HttpClients(@Value("${app.node-api-url}") String nodeApiUrl,
                       @Value("${app.ocr-timeout-ms}") long ocrTimeoutMs) {
        this.nodeClient = build(nodeApiUrl, Duration.ofMillis(ocrTimeoutMs));
        this.retrievalClient = WebClient.builder()
                .clientConnector(connector(Duration.ofSeconds(30)))
                .build();
    }

    /** Client for the existing Node OCR/queue service. */
    public WebClient node() {
        return nodeClient;
    }

    /** Raw client used to fetch the stored document from the signed URL. */
    public WebClient retrieval() {
        return retrievalClient;
    }

    static WebClient build(String baseUrl, Duration timeout) {
        return WebClient.builder()
                .baseUrl(baseUrl)
                .clientConnector(connector(timeout))
                .build();
    }

    private static ReactorClientHttpConnector connector(Duration timeout) {
        HttpClient http = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, (int) timeout.toMillis())
                .doOnConnected(conn -> conn.addHandlerLast(
                        new ReadTimeoutHandler(timeout.toMillis(), TimeUnit.MILLISECONDS)));
        return new ReactorClientHttpConnector(http);
    }
}