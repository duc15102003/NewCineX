package com.cinex.module.theater.dto;

import com.cinex.module.theater.entity.TheaterStatus;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class TheaterFilter {

    private String keyword;
    private String city;
    private TheaterStatus status;
    private Boolean includeDeleted;
}
