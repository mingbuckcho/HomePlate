package com.homeplate.repository.jpa;

import com.homeplate.entity.info.Teams;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TeamRepository extends JpaRepository<Teams, String> {
}
