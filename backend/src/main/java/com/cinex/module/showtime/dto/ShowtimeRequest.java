package com.cinex.module.showtime.dto;

import com.cinex.module.showtime.entity.ShowtimeFormat;
import com.cinex.module.showtime.entity.ShowtimeLanguage;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
public class ShowtimeRequest {

    @NotNull(message = "Vui lòng chọn phim")
    private Long movieId;

    /**
     * (Optional) ID của đợt chiếu cụ thể.
     *
     * <p>Hành vi của ShowtimeService:
     * <ul>
     *   <li><b>null</b> (default UX): Service tự pick MovieRun phù hợp của movie — ưu tiên run
     *       đang {@code NOW_SHOWING}, fallback nearest {@code SCHEDULED}. Nếu phim chưa có run
     *       nào active → throw {@code INVALID_REQUEST}.</li>
     *   <li><b>not null</b> (advanced UX): admin chỉ định run nào (vd: chọn đợt re-issue khi
     *       phim có cả first-run lẫn re-release). Service validate run này thuộc đúng movie và
     *       chưa ARCHIVED, status khác ENDED.</li>
     * </ul>
     */
    private Long movieRunId;

    @NotNull(message = "Vui lòng chọn phòng chiếu")
    private Long roomId;

    @NotNull(message = "Thời gian bắt đầu là bắt buộc")
    private LocalDateTime startTime;

    /**
     * Giá vé — để null nếu muốn ShowtimeService tự fill mặc định theo RoomType
     * (đọc từ system_config: pricing.standard.* hoặc pricing.imax.*).
     */
    @Min(value = 1, message = "Giá vé phải ít nhất 1đ")
    private BigDecimal basePrice;

    @Min(value = 0, message = "Giá vé VIP không được âm")
    private BigDecimal vipPrice;

    @Min(value = 0, message = "Giá vé đôi không được âm")
    private BigDecimal couplePrice;

    @Min(value = 0, message = "Giá vé Sweetbox không được âm")
    private BigDecimal sweetboxPrice;

    @Min(value = 0, message = "Giá vé Deluxe không được âm")
    private BigDecimal deluxePrice;

    /**
     * Định dạng chiếu — 2D/3D/IMAX/4DX/Screen-X. null → service default TWO_D
     * cho backward-compat khi FE cũ chưa gửi field.
     */
    private ShowtimeFormat format;

    /**
     * Mode ngôn ngữ — SUB_VI/DUB_VI/ORIGINAL. null → service default SUB_VI.
     */
    private ShowtimeLanguage languageMode;
}
