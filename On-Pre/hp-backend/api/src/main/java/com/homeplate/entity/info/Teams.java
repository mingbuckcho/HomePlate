package com.homeplate.entity.info;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
@Table(name = "teams")
public class Teams {
    @Id
    @Column(name = "team_id", nullable = false, length = 10)
    private String teamId;

    @Column(name = "team_name", nullable = false, length = 50)
    private String teamName;
}
