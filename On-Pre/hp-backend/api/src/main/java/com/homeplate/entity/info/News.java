package com.homeplate.entity.info;

import com.homeplate.entity.AtEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Getter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Table(name = "news")
public class News extends AtEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "news_id", nullable = false)
    private Long newsId;

    @Column(name = "news_title", nullable = false, length = 255)
    private String newsTitle;

    @Column(name = "news_url", nullable = false)
    private String newsUrl;

    @Column(name = "news_thumbnail")
    private String newsThumbnail;

    @Column(name = "news_press", length = 50)
    private String newsPress;

    @Column(name = "published_at", nullable = false)
    private LocalDateTime publishedAt;
}
