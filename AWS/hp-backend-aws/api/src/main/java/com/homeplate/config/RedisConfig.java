package com.homeplate.config;

import io.lettuce.core.SocketOptions;
import io.lettuce.core.TimeoutOptions;
import io.lettuce.core.cluster.ClusterClientOptions;
import io.lettuce.core.cluster.ClusterTopologyRefreshOptions;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.connection.RedisClusterConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;

import java.time.Duration;
import java.util.List;

@Slf4j
@Configuration
public class RedisConfig {

    @Value("${spring.data.redis.cluster.nodes}")
    private List<String> clusterNodes;

    @Bean
    @Primary
    public LettuceConnectionFactory redisConnectionFactory() {

        log.info("=========================================================");
        log.info("🚀 [SAMADAL-TEST] Redis TLS (비밀번호 없음) + 인증서 무시 설정 가동 🚀");
        log.info("=========================================================");

        RedisClusterConfiguration clusterConfig = new RedisClusterConfiguration(clusterNodes);
        clusterConfig.setMaxRedirects(3);

        ClusterTopologyRefreshOptions topologyRefreshOptions = ClusterTopologyRefreshOptions.builder()
                .enablePeriodicRefresh(Duration.ofSeconds(60))
                .enableAllAdaptiveRefreshTriggers()
                .build();

        ClusterClientOptions clientOptions = ClusterClientOptions.builder()
                .topologyRefreshOptions(topologyRefreshOptions)
                .socketOptions(SocketOptions.builder().keepAlive(true).build())
                .timeoutOptions(TimeoutOptions.enabled())
                .build();

        LettuceClientConfiguration clientConfig = LettuceClientConfiguration.builder()
                .clientOptions(clientOptions)
                .useSsl().disablePeerVerification().and()
                .build();

        return new LettuceConnectionFactory(clusterConfig, clientConfig);
    }
}