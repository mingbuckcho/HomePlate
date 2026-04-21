package com.homeplate.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.DefaultUriBuilderFactory;

@Configuration
public class WebClientConfig {
    @Bean
    public WebClient weatherWebClient(WebClient.Builder builder) {
        DefaultUriBuilderFactory factory = new DefaultUriBuilderFactory("http://apis.data.go.kr");
        factory.setEncodingMode(DefaultUriBuilderFactory.EncodingMode.VALUES_ONLY);

        return builder
                .uriBuilderFactory(factory)
                .build();
    }
}
