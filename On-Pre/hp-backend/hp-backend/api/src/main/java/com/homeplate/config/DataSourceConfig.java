package com.homeplate.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.datasource.LazyConnectionDataSourceProxy;

import javax.sql.DataSource;
import java.util.HashMap;
import java.util.Map;

@Configuration
public class DataSourceConfig {
    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.master")
    public DataSource master() {
        return DataSourceBuilder.create().type(HikariDataSource.class).build();
    }

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.replica")
    public DataSource replica() {
        return DataSourceBuilder.create().type(HikariDataSource.class).build();
    }

    @Bean
    public DataSource routing(
            @Qualifier("master") DataSource master,
            @Qualifier("replica") DataSource replica) {
        RoutingDataSource routing = new RoutingDataSource();
        Map<Object, Object> datasrc = new HashMap<>();
        datasrc.put("master", master);
        datasrc.put("replica", replica);

        routing.setTargetDataSources(datasrc);
        routing.setDefaultTargetDataSource(master);

        return routing;
    }

    @Bean
    @Primary
    public DataSource dataSource(@Qualifier("routing") DataSource routing) {
        return new LazyConnectionDataSourceProxy(routing);
    }
}
