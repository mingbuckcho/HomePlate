package com.homeplate.dto.chat;

import lombok.Data;

@Data
public class ChatRequest {
    private Integer menuId;
    private Long gameId;
    private String zoneNumber;
}
