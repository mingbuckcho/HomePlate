package com.homeplate.entity.book;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "zones")
public class Zones {
    @Id
    @Column(name = "zone_id", length = 30, nullable = false)
    private String zoneId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stadium_id", nullable = false)
    private Stadiums stadium;

    @Column(name = "zone_name", nullable = false, length = 50)
    private String zoneName;

    @Column(name = "zone_number", nullable = false, length = 10)
    private String zoneNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "zone_grade", nullable = false)
    private ZoneGrade zoneGrade;
}
