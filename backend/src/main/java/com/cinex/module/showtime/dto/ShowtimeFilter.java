package com.cinex.module.showtime.dto;

import com.cinex.module.showtime.entity.ShowtimeStatus;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
public class ShowtimeFilter {

    private Long movieId;
    private Long roomId;
    private LocalDate date;           // Lọc theo ngày (VD: 2026-05-20)
    private ShowtimeStatus status;
    private Boolean includeDeleted;
}
