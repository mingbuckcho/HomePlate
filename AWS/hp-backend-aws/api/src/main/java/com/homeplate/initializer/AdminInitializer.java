package com.homeplate.initializer;

import com.homeplate.entity.auth.Role;
import com.homeplate.entity.auth.Users;
import com.homeplate.repository.jpa.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class AdminInitializer implements CommandLineRunner {
    private final UserRepository userRepo;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.admin.password}")
    private String adminPassword;

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        String email = "admin";

        if (!userRepo.existsByEmail(email)) {
            Users admin = Users.builder()
                    .email(email)
                    .password(passwordEncoder.encode(adminPassword))
                    .userName("관리자")
                    .role(Role.ROLE_ADMIN)
                    .build();
            userRepo.save(admin);
        }
    }
}
