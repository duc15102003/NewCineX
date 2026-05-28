package com.cinex.common.entity.tracker;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "id_tracker")
@Getter
@Setter
@NoArgsConstructor
public class IdTracker {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "entity_type", nullable = false, unique = true, length = 50)
    private String entityType;

    @Column(nullable = false, length = 10)
    private String prefix;

    @Column(name = "current_value", nullable = false)
    private Long currentValue;

    @Column(length = 100)
    private String description;
}
