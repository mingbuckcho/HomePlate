package com.homeplate.repository.jpa;

import com.homeplate.entity.info.News;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NewsRepository extends JpaRepository<News, Long> {
    List<News> findAllByOrderByPublishedAtDesc();
}
