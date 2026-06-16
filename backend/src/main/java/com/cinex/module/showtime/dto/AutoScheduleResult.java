package com.cinex.module.showtime.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Kết quả auto-schedule — admin xem được tạo bao nhiêu suất + skip những gì.
 */
@Data
@Builder
public class AutoScheduleResult {

    /** Số suất chiếu đã tạo thành công. */
    private int created;

    /** Số slot bị skip (conflict hoặc lý do khác). */
    private int skipped;

    /** Chi tiết từng slot — UI hiển thị để admin biết suất nào tạo, suất nào skip vì sao. */
    private List<ScheduleEntry> details;

    @Data
    @Builder
    public static class ScheduleEntry {
        private Long roomId;
        private String roomName;
        private LocalDateTime startTime;
        /** CREATED | SKIPPED */
        private String status;
        /** Lý do skip (null khi CREATED). */
        private String reason;
        /** ID suất chiếu mới (chỉ có khi CREATED). */
        private Long showtimeId;
    }
}
