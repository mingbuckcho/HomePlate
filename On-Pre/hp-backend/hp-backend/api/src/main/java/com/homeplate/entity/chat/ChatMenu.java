package com.homeplate.entity.chat;

import lombok.Getter;

@Getter
public enum ChatMenu {
    BOOKING(1, "홈플레이트 예매는 로그인 후 '경기 일정' -> '예매하기' 버튼을 통해 가능합니다. 1인당 최대 4매까지 예매 가능합니다."),
    REFUND(2, "경기 시작 전까지 100% 환불 가능하며, 경기 시작 후에는 환불 불가합니다."),
    ZONESTATUS(3, ""),
    WEATHER(4, ""),
    CS(5, "고객센터 전화번호는 1588-0000 이며, 운영 시간은 평일 09:00 ~ 18:00 입니다.");

    private final int menuId;
    private final String message;

    ChatMenu(int menuId, String message) {
        this.menuId = menuId;
        this.message = message;
    }

    public static String getMessage(int menuId) {
        for (ChatMenu menu : values()) {
            if (menu.getMenuId() == menuId) {
                return menu.getMessage();
            }
        }
        return CS.getMessage();
    }

}
