package com.homeplate.initializer;

import com.homeplate.entity.auth.Role;
import com.homeplate.entity.auth.Users;
import com.homeplate.repository.jpa.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AdminInitializer implements CommandLineRunner {
    private final UserRepository userRepo;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        String email = "admin";

        if (!userRepo.existsByEmail(email)) {
            Users admin = Users.of(email, passwordEncoder.encode("1234"), "관리자", "010-1234-5678", Role.ROLE_ADMIN);
            userRepo.save(admin);
            System.out.println("Admin 계정이 생성되었습니다. (ID: admin, PW: 1234)");
        }
    }
}
