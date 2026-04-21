package com.homeplate.config;

import com.homeplate.util.QueueInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {
    private final QueueInterceptor interceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry){
        registry.addInterceptor(interceptor)
                .addPathPatterns("/api/book/{gameId}/seats/**", "/api/book/orders")
                .excludePathPatterns("/api/book/{gameId}/zones/**");
    }
}
