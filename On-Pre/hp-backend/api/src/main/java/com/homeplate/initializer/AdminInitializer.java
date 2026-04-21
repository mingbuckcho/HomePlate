package com.homeplate.initializer;

import com.homeplate.entity.auth.Role;
import com.homeplate.entity.auth.Users;
import com.homeplate.repository.jpa.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AdminInitializer implements CommandLineRunner {
    private final UserRepository userRepo;
    private final PasswordEncoder passwordEncoder;

    @Value("${ADMIN_PASSWORD:default}")
    private String password;

    @Override
    public void run(String... args) throws Exception {
        String email = "admin";

        if (!userRepo.existsByEmail(email)) {
            Users admin = Users.builder()
                    .email(email)
                    .password(passwordEncoder.encode(password))
                    .userName("관리자")
                    .phone(null)
                    .role(Role.ROLE_ADMIN)
                    .build();
            userRepo.save(admin);
        }
    }
}
