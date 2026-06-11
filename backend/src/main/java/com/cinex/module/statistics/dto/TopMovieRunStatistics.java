package com.cinex.module.statistics.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Top đợt chiếu bán chạy — phân biệt từng MovieRun thay vì gộp theo Movie.
 *
 * <p><b>Vì sao tách khỏi {@link TopMovieStatistics}?</b>
 * Sau refactor MovieRun, 1 phim có thể có nhiều đợt chiếu (FIRST_RUN, REISSUE, FESTIVAL).
 * Báo cáo gộp theo Movie cộng dồn vé của REISSUE 2026 + FIRST_RUN 2009 → không trả lời
 * được câu hỏi "đợt chiếu nào hiệu quả nhất". DTO này expose chi tiết từng đợt.
 *
 * <p>Statistics cấp aggregate (Movie) vẫn dùng {@link TopMovieStatistics}; cấp detail
 * (mỗi run) dùng DTO này. Pattern: dual-level reporting cho parent-child entity.
 */
@Getter
@AllArgsConstructor
public class TopMovieRunStatistics {

    private Long movieRunId;
    private Long movieId;
    private String movieTitle;
    private String moviePosterUrl;
    private String runType;
    private LocalDate startDate;
    private LocalDate endDate;
    private long ticketCount;
    private BigDecimal revenue;
}
