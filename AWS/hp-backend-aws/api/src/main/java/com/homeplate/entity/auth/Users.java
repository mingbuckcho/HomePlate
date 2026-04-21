package com.homeplate.entity.auth;

import com.homeplate.entity.AtEntity;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
@Table(name = "users")
public class Users extends AtEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(unique = true, nullable = false, length = 100)
    private String email;

    @Column(nullable = false, length = 255)
    private String password;

    @Column(name = "user_name", nullable = false, length = 50)
    private String userName;

    @Column(nullable = true, length = 20)
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    public static Users socialUser(String email, String userName) {
        return Users.builder()
                .email(email)
                .password(UUID.randomUUID().toString())
                .userName(userName)
                .phone(null)
                .role(Role.ROLE_USER)
                .build();
    }

    public static Users localUser(String email, String password, String userName, String phone) {
        return Users.builder()
                .email(email)
                .password(password)
                .userName(userName)
                .phone(phone)
                .role(Role.ROLE_USER)
                .build();
    }
}
