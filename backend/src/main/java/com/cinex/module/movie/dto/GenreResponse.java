package com.cinex.module.movie.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class GenreResponse {

    private Long id;
    private String storageState;
    private String name;
    private String description;
}
