package com.cinex.module.movie.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class GenreFilter {

    private String keyword;
    private Boolean includeDeleted;
}
