package com.cinex.module.booking.dto;

import com.cinex.module.booking.entity.BookingStatus;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class BookingFilter {

    private String keyword;
    private BookingStatus status;
    private Boolean includeDeleted;
}
