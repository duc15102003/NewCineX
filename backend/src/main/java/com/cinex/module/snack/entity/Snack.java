package com.cinex.module.snack.entity;

import com.cinex.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "snacks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Snack extends BaseEntity {

    @Column(nullable = false, length = 100, columnDefinition = "NVARCHAR(100)")
    private String name;

    @Column(length = 255)
    private String description;

    @Column(nullable = false, precision = 12, scale = 0)
    private BigDecimal price;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(length = 50)
    private String category;

    @Column(nullable = false)
    @Builder.Default
    private boolean available = true;
}
