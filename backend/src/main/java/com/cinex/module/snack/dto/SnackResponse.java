package com.cinex.module.snack.dto;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Builder
public class SnackResponse {

    private Long id;
    private String storageState;
    /** Chi nhánh sở hữu snack — breadcrumb + audit (FE đã force theater pick). */
    private Long theaterId;
    private String theaterName;
    private String theaterCity;
    private String name;
    private String description;
    private BigDecimal price;
    private String imageUrl;
    private String category;
    private boolean available;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
