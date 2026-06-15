package com.cinex.module.config.dto;

import com.cinex.module.config.entity.SystemConfig;
import lombok.Builder;
import lombok.Getter;

/**
 * DTO trả về cho admin Cấu hình hệ thống.
 *
 * <p>Tách entity → DTO để:
 * <ul>
 *   <li>Không expose field {@code description} (dev-only, không cần cho admin)</li>
 *   <li>Đảm bảo shape API ổn định khi entity thay đổi</li>
 *   <li>Encapsulate: configKey vẫn cần trả về để FE map khi PUT update,
 *       nhưng FE quyết định hiển thị hay không (mặc định ẩn)</li>
 * </ul>
 */
@Getter
@Builder
public class SystemConfigResponse {

    /** Key kỹ thuật — FE dùng làm identifier khi PUT, không hiển thị mặc định. */
    private String configKey;

    /** Giá trị hiện tại. */
    private String configValue;

    /** Tên thân thiện hiển thị. */
    private String label;

    /** Tooltip giải thích chi tiết. */
    private String hint;

    /** Đơn vị (phút, lần, ngày, điểm, giây). */
    private String unit;

    /** Nhóm: booking / showtime / loyalty / security / dashboard. */
    private String category;

    /** Thứ tự trong nhóm. */
    private Integer displayOrder;

    /** Visible flag — FE filter mặc định, toggle để xem cả ẩn. */
    private boolean visible;

    /** Ràng buộc giá trị (cho input number). */
    private Integer minValue;
    private Integer maxValue;

    public static SystemConfigResponse from(SystemConfig c) {
        return SystemConfigResponse.builder()
                .configKey(c.getConfigKey())
                .configValue(c.getConfigValue())
                .label(c.getLabel())
                .hint(c.getHint())
                .unit(c.getUnit())
                .category(c.getCategory())
                .displayOrder(c.getDisplayOrder())
                .visible(c.isVisible())
                .minValue(c.getMinValue())
                .maxValue(c.getMaxValue())
                .build();
    }
}
