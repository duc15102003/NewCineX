package com.cinex.module.showtime.dto;

import com.cinex.module.showtime.entity.ShowtimeFormat;
import com.cinex.module.showtime.entity.ShowtimeLanguage;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;

/**
 * Auto-schedule request — tạo hàng loạt suất chiếu trong 1 dải ngày.
 *
 * <p>Algorithm: với mỗi phòng × mỗi ngày, fill khung [startHour, endHour) bằng slot
 * = movie.duration + bufferMinutes. Slot conflict suất hiện có → SKIP (không throw).
 *
 * <p>Hard limit: dateTo - dateFrom ≤ 30 ngày (tránh tạo quá lố).
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class AutoScheduleRequest {

    @NotNull(message = "movieId là bắt buộc")
    private Long movieId;

    @NotNull(message = "theaterId là bắt buộc")
    private Long theaterId;

    @NotEmpty(message = "roomIds không được rỗng")
    private List<@Positive Long> roomIds;

    @NotNull(message = "dateFrom là bắt buộc")
    private LocalDate dateFrom;

    @NotNull(message = "dateTo là bắt buộc")
    private LocalDate dateTo;

    @NotNull
    @Min(value = 0, message = "startHour từ 0-23")
    @Max(value = 23, message = "startHour từ 0-23")
    private Integer startHour;

    @NotNull
    @Min(value = 1, message = "endHour từ 1-24")
    @Max(value = 24, message = "endHour từ 1-24")
    private Integer endHour;

    /**
     * Ngày trong tuần được chiếu — chuẩn ISO {@code 1=Mon..7=Sun}.
     * null/empty → mọi ngày trong khoảng. Dùng khi rạp chỉ chiếu cuối tuần
     * hoặc loại weekday để dành phòng cho event. Chuẩn Vista/Veezi/Cinetixx.
     */
    private Set<Integer> weekdays;

    /**
     * Chế độ rải slot — {@link AutoScheduleSlotMode#WINDOW} (default) hoặc
     * {@link AutoScheduleSlotMode#TEMPLATES}. null = WINDOW (backward-compat).
     */
    private AutoScheduleSlotMode slotMode;

    /**
     * Giờ cố định khi {@code slotMode = TEMPLATES} — vd {@code [10:00, 13:00, 16:00, 19:00]}.
     * BẮT BUỘC khi TEMPLATES, BỎ QUA khi WINDOW. Mỗi giờ sẽ tạo 1 slot/ngày/phòng;
     * conflict/past/ngoài run → skip như WINDOW mode.
     *
     * <p>Industry note: Cinetixx/CGV-admin gọi đây là "show templates" — admin set
     * 1 lần cho cả tuần để giờ chiếu đồng nhất, user dễ nhớ.
     */
    private List<LocalTime> fixedTimes;

    /**
     * Buffer giữa các suất LẤY TỪ system_config (key showtime.buffer_minutes).
     * KHÔNG cho admin truyền per-batch — tránh setting toàn cục bị bypass tuỳ tiện.
     * Field cũ giữ tạm để FE cũ không vỡ (BE ignore).
     */
    @Deprecated
    private Integer bufferMinutes;

    @NotNull
    @Positive
    private BigDecimal basePrice;

    /** Giá VIP optional — null = phòng không có VIP thì skip, có VIP thì auto-fill từ config. */
    private BigDecimal vipPrice;
    private BigDecimal couplePrice;
    private BigDecimal sweetboxPrice;
    private BigDecimal deluxePrice;

    /**
     * Định dạng chiếu áp cho TẤT CẢ suất sinh ra — TWO_D/THREE_D/IMAX/IMAX_3D/FOUR_DX/SCREEN_X.
     * null → service default TWO_D.
     */
    private ShowtimeFormat format;

    /** Mode ngôn ngữ áp cho TẤT CẢ suất sinh ra — SUB_VI/DUB_VI/ORIGINAL. null → SUB_VI. */
    private ShowtimeLanguage languageMode;

    /**
     * Tạo dưới dạng DRAFT (nháp, không public) thay vì SCHEDULED — chuẩn Vista/Veezi
     * "publish workflow". Admin tạo trước, review, rồi publish (đổi SCHEDULED) sau.
     * Default false → tạo SCHEDULED ngay (hành vi cũ).
     */
    private Boolean asDraft;
}
