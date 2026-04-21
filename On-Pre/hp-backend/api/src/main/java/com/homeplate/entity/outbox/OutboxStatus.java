package com.homeplate.entity.outbox;

public enum OutboxStatus {
    PENDING,
    SENDING,
    SENT,
    FAILED
}
