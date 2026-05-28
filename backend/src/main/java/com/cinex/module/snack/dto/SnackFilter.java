package com.cinex.module.snack.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SnackFilter {
    private String keyword;
    private Boolean includeDeleted;
}
