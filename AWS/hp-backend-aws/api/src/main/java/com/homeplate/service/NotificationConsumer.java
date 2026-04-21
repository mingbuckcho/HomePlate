package com.homeplate.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.hibernate.annotations.FetchProfiles;
import org.springframework.context.annotation.Profile;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
@Profile("worker")
public class NotificationConsumer {
    private final EmailService service;
    private final ObjectMapper mapper;

    @KafkaListener(
            topics = "${TOPIC_NOTIFICATION}",
            groupId = "${SPRING_KAFKA_CONSUMER_GROUP_ID}"
    )
    public void consume(String message) {
        try {
            log.info("Kafka Message Received: {}", message);

            Map<String, String> data = mapper.readValue(message, new TypeReference<>() {
            });

            service.send(data.get("email"), data.get("title"), data.get("body"));

            log.info("Email sent via Kafka Consumer to: {}", data.get("email"));
        } catch (Exception e) {
            log.error("Failed to process Kafka message: {}", message, e);
        }
    }
}
