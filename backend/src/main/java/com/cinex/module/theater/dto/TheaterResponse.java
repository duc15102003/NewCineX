package com.cinex.module.theater.dto;

import com.cinex.module.theater.entity.TheaterStatus;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Builder
public class TheaterResponse {

    private Long id;
    private String storageState;
    private String code;
    private String name;
    private String address;
    private String city;
    private String hotline;
    private String email;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private TheaterStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
