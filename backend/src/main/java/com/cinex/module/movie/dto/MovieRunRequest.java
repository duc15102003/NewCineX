package com.cinex.module.movie.dto;

import com.cinex.module.movie.entity.MovieRun;
import com.cinex.module.movie.entity.MovieRunType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

/**
 * Request tạo / cập nhật {@link MovieRun}.
 *
 * <p><b>Open-ended pattern (chuẩn rạp hiện nay — CGV/Lotte/BHD):</b>
 * <ul>
 *   <li>{@code startDate} BẮT BUỘC — rạp luôn công bố ngày khởi chiếu trước cho marketing</li>
 *   <li>{@code endDate} OPTIONAL — admin set sau khi quyết ngày ngưng (dựa trên doanh thu).
 *       Để {@code null} = chiếu vô thời hạn (open-ended).</li>
 * </ul>
 *
 * <p><b>Không nhận status</b>: status do {@code MovieRunStatusScheduler} suy ra từ
 * (startDate, endDate, today). Admin không set tay → tránh inconsistent.
 */
@Getter
@Setter
public class MovieRunRequest {

    @NotNull(message = "Phim là bắt buộc")
    private Long movieId;

    /**
     * Chi nhánh áp dụng đợt chiếu. Branch ADMIN: service override từ JWT.
     * SUPER_ADMIN: phải gửi theaterId cụ thể (mỗi rạp 1 run riêng cho cùng phim).
     */
    @NotNull(message = "Chi nhánh là bắt buộc")
    private Long theaterId;

    @NotNull(message = "Ngày bắt đầu là bắt buộc")
    private LocalDate startDate;

    /**
     * Optional — để null nếu chưa quyết ngày ngưng chiếu. Set khi admin quyết ngưng.
     */
    private LocalDate endDate;

    @NotNull(message = "Loại đợt chiếu là bắt buộc")
    private MovieRunType runType;

    @Size(max = 500, message = "Ghi chú tối đa 500 ký tự")
    private String notes;
}
