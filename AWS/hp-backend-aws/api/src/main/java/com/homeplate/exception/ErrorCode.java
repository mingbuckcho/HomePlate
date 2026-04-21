package com.homeplate.exception;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
@AllArgsConstructor
public enum ErrorCode {
    // 404 NOT_FOUND: 리소스를 찾을 수 없음
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "가입되지 않은 이메일이거나 존재하지 않는 사용자입니다."),
    GAME_NOT_FOUND(HttpStatus.NOT_FOUND, "존재하지 않는 경기입니다."),
    ORDER_NOT_FOUND(HttpStatus.NOT_FOUND, "존재하지 않는 주문입니다."),
    SEAT_NOT_FOUND(HttpStatus.NOT_FOUND, "존재하지 않는 좌석입니다."),
    AUTHCODE_NOT_FOUND(HttpStatus.NOT_FOUND, "인증 코드가 존재하지 않거나 만료되었습니다."),
    RESOURCE_NOT_FOUND(HttpStatus.NOT_FOUND, "요청한 리소스를 찾을 수 없습니다."),

    // 409 CONFLICT: 리소스 충돌 (중복, 상태 불일치)
    EMAIL_ALREADY_EXIST(HttpStatus.CONFLICT, "이미 가입된 이메일입니다."),
    SEAT_ALREADY_BOOKED(HttpStatus.CONFLICT, "이미 예매가 완료된 좌석입니다."),
    SEAT_ALREADY_LOCKED(HttpStatus.CONFLICT, "이미 다른 사용자가 선택한 좌석입니다."),
    LOCKEXPIRED_OR_NOTMINE(HttpStatus.CONFLICT, "좌석 선점 시간이 만료되었거나, 본인이 선점한 좌석이 아닙니다."),

    // 400 BAD_REQUEST: 잘못된 요청
    REFRESHTOKEN_NOT_EXIST(HttpStatus.BAD_REQUEST, "Refresh Token이 쿠키에 존재하지 않습니다."),
    SEAT_NOT_VALID(HttpStatus.BAD_REQUEST, "요청한 좌석 정보가 유효하지 않습니다."),
    USER_NOT_MATCH(HttpStatus.BAD_REQUEST, "본인의 주문만 결제할 수 있습니다."),
    ORDER_NOT_VALID(HttpStatus.BAD_REQUEST, "유효하지 않은 주문 상태입니다."),
    MAXTICKET_LIMIT_EXCEEDED(HttpStatus.BAD_REQUEST, "1인당 경기별 최대 4매까지만 예매 가능합니다."),
    AUTHCODE_NOT_MATCH(HttpStatus.BAD_REQUEST, "인증 코드가 일치하지 않습니다."),
    EMAIL_NOT_VERIFIED(HttpStatus.BAD_REQUEST, "이메일 인증이 완료되지 않았습니다."),

    // 401 UNAUTHORIZED  authenticated
    PASSWORD_NOT_MATCH(HttpStatus.UNAUTHORIZED, "비밀번호가 일치하지 않습니다."),
    TOKEN_NOT_VALID(HttpStatus.UNAUTHORIZED, "유효하지 않은 토큰입니다."),
    REFRESHTOKEN_NOT_FOUND(HttpStatus.UNAUTHORIZED, "로그아웃된 사용자이거나 토큰이 만료되었습니다."),
    LOGIN_REQUEST_AUTHENTICATED(HttpStatus.UNAUTHORIZED, "로그인이 필요한 서비스입니다."),
    QUEUETOKEN_NOT_FOUND(HttpStatus.UNAUTHORIZED, "대기열 정보가 존재하지 않습니다. 줄을 서주세요."),

    // 403 FORBIDDEN
    ACCESS_NOT_ACTIVE(HttpStatus.FORBIDDEN, "아직 입장 순서가 아닙니다. 대기해주세요."),

    // 500 INTERNAL_SERVER_ERROR
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버 내부 오류가 발생했습니다. 관리자에게 문의하세요."),
    EMAIL_SEND_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "이메일 전송에 실패했습니다.");

    private final HttpStatus httpStatus;
    private final String message;
}