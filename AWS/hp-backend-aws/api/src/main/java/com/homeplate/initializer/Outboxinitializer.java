package com.homeplate.initializer;

import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.UUID;

@Slf4j
@Component
@Getter
@RequiredArgsConstructor
public class Outboxinitializer {
    private String workerId;

    @PostConstruct
    public void init() {
        String hostname = System.getenv("HOSTNAME");
        // 1. k8s 환경변수
        if (hostname == null || hostname.isEmpty()) {
            hostname = System.getenv("COMPUTERNAME");
        }

        // 2. local 환경변수
        if (hostname == null || hostname.isEmpty()) {
            try {
                hostname = InetAddress.getLocalHost().getHostName();
            } catch (UnknownHostException e) {
                // 3. 랜덤 ID
                hostname = "worker-" + UUID.randomUUID().toString().substring(0, 8);
            }
        }
        this.workerId=hostname;
        log.info("OutboxScheduler initialized with Current Worker ID: {}", this.workerId);
    }
}
