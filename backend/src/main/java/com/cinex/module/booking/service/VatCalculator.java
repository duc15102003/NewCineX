package com.cinex.module.booking.service;

import com.cinex.module.config.service.SystemConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Tính breakdown VAT cho booking — pattern industry VAT-inclusive (CGV/Lotte/BHD).
 *
 * <p><b>Tại sao VAT-inclusive?</b> Giá vé niêm yết (100k, 150k...) phải là giá
 * khách thực trả — UX rạp chiếu phim VN khách không muốn thấy "+VAT" sau khi
 * đặt vé xong. Logic tính giá ghế (BookingService.computeTotalAmountWithVoucher)
 * KHÔNG đổi — chỉ tách ngược thành 3 dòng hiển thị trên hóa đơn.
 *
 * <p>Công thức:
 * <pre>
 *   subtotal = total * 100 / (100 + vat_percent)   (HALF_UP)
 *   vat      = total - subtotal                     (đảm bảo tổng đúng)
 * </pre>
 *
 * <p>VAT% đọc từ {@code system_config} key {@code pricing.vat_percent} (default 8).
 * Booking lưu lại % lúc tạo — nếu luật đổi sau (8% → 10%), vé cũ vẫn show đúng.
 */
@Component
@RequiredArgsConstructor
public class VatCalculator {

    private static final String CONFIG_KEY = "pricing.vat_percent";
    private static final int DEFAULT_VAT_PERCENT = 8;

    private final SystemConfigService systemConfigService;

    /**
     * Tính breakdown VAT từ tổng gross (đã bao gồm VAT).
     *
     * @param grossTotal giá tổng cộng khách trả (đã VAT)
     * @return breakdown gồm subtotal, vat, percent
     */
    public VatBreakdown breakdownFromGross(BigDecimal grossTotal) {
        int percent = systemConfigService.getInt(CONFIG_KEY, DEFAULT_VAT_PERCENT);
        return breakdownAtPercent(grossTotal, BigDecimal.valueOf(percent));
    }

    /**
     * Tính breakdown VAT với % chỉ định (cho test hoặc refund recalculation).
     */
    public VatBreakdown breakdownAtPercent(BigDecimal grossTotal, BigDecimal vatPercent) {
        BigDecimal divisor = BigDecimal.valueOf(100).add(vatPercent);
        BigDecimal subtotal = grossTotal
                .multiply(BigDecimal.valueOf(100))
                .divide(divisor, 0, RoundingMode.HALF_UP);
        BigDecimal vat = grossTotal.subtract(subtotal);
        return new VatBreakdown(subtotal, vat, vatPercent);
    }

    /** Container kết quả — immutable. */
    public record VatBreakdown(BigDecimal subtotal, BigDecimal vat, BigDecimal vatPercent) {}
}
