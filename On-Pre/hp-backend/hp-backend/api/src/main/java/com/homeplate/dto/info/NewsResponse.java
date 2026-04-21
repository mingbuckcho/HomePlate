package com.homeplate.dto.info;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.homeplate.entity.info.News;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;

@Getter
@Builder
public class NewsResponse {
    private Long newsId;
    private String newsTitle;
    private String newsUrl;
    private String newsThumbnail;
    private String newsPress;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate publishedAt;

    public static NewsResponse from(News news) {
        String newsTitle = news.getNewsTitle();
        if (newsTitle != null && newsTitle.length() > 10) {
            newsTitle = newsTitle.substring(0, 10) + "...";
        }

        return NewsResponse.builder()
                .newsId(news.getNewsId())
                .newsTitle(newsTitle)
                .newsUrl(news.getNewsUrl())
                .newsThumbnail(news.getNewsThumbnail())
                .newsPress(news.getNewsPress())
                .publishedAt(news.getPublishedAt().toLocalDate())
                .build();
    }
}
