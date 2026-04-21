package com.homeplate.entity.book;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "stadiums")
public class Stadiums {
    @Id
    @Column(name = "stadium_id", length = 10, nullable = false)
    private String stadiumId;

    @Column(name = "stadium_name", length = 50, nullable = false)
    private String stadiumName;

    @Column(name = "stadium_location", length = 100)
    private String stadiumLocation;
}
