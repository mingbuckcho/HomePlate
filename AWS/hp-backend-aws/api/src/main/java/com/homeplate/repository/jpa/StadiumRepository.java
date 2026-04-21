package com.homeplate.repository.jpa;

import com.homeplate.entity.book.Stadiums;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface StadiumRepository extends JpaRepository<Stadiums, String> {
}
