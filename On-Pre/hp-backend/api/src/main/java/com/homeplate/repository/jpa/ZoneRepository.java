package com.homeplate.repository.jpa;

import com.homeplate.entity.book.Zones;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ZoneRepository extends JpaRepository<Zones, String> {
}
