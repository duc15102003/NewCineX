package com.cinex.common.util;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.Locale;

/**
 * Format tien VND.
 * Logic tinh gia (discount, multiplier) de trong PricingService.
 */
public final class MoneyUtil {

    private MoneyUtil() {}

    private static final DecimalFormat VND_FORMAT;

    static {
        DecimalFormatSymbols symbols = new DecimalFormatSymbols(new Locale("vi", "VN"));
        symbols.setGroupingSeparator('.');
        VND_FORMAT = new DecimalFormat("#,###", symbols);
    }

    /**
     * 75000 -> "75.000 dong"
     */
    public static String formatVND(long amount) {
        return VND_FORMAT.format(amount) + " \u20AB";
    }

    public static String formatVND(BigDecimal amount) {
        if (amount == null) return "0 \u20AB";
        return VND_FORMAT.format(amount.longValue()) + " \u20AB";
    }
}
