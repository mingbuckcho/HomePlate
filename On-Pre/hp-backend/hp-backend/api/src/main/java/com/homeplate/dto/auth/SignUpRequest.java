package com.homeplate.dto.auth;

import com.homeplate.entity.auth.Role;
import com.homeplate.entity.auth.Users;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class SignUpRequest {
    @NotBlank(message = "이메일을 입력해주세요.")
    @Email(message = "이메일 형식이 올바르지 않습니다.")
    private String email;

    @NotBlank(message = "비밀번호를 입력해주세요.")
    private String password;

    @NotBlank(message = "이름을 입력해주세요.")
    private String userName;

    @NotBlank(message = "휴대폰 번호를 입력해주세요.")
    private String phone;

    public Users toEntity(PasswordEncoder passwordEncoder) {
        return Users.builder()
                .email(this.email)
                .password(passwordEncoder.encode(this.password))
                .userName(this.userName)
                .phone(this.phone)
                .role(Role.ROLE_USER)
                .build();
    }
}
