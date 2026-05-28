package com.cinex.common.util;

import java.text.Normalizer;
import java.util.regex.Pattern;

/**
 * Xu ly chuoi dac thu (tieng Viet, slug, mask data).
 * isBlank/isEmpty -> dung Spring StringUtils.hasText() thay the.
 */
public final class StringUtil {

    private StringUtil() {}

    private static final Pattern DIACRITICS = Pattern.compile("\\p{InCombiningDiacriticalMarks}+");
    private static final Pattern NON_ALPHANUMERIC = Pattern.compile("[^a-z0-9\\s-]");
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");
    private static final Pattern MULTI_DASH = Pattern.compile("-{2,}");
    private static final Pattern LEADING_TRAILING_DASH = Pattern.compile("^-|-$");

    /**
     * Bo dau tieng Viet.
     * VD: "Vu Tuong An" -> "Vu Tuong An"
     */
    public static String removeDiacritics(String str) {
        if (str == null || str.isBlank()) return str;
        String normalized = Normalizer.normalize(str, Normalizer.Form.NFD);
        return DIACRITICS.matcher(normalized).replaceAll("")
                .replace('\u0111', 'd').replace('\u0110', 'D');
    }

    /**
     * Tao slug URL-friendly.
     * VD: "Avengers: Hoi Ket" -> "avengers-hoi-ket"
     */
    public static String toSlug(String str) {
        if (str == null || str.isBlank()) return "";
        String result = removeDiacritics(str).toLowerCase();
        result = NON_ALPHANUMERIC.matcher(result).replaceAll("");
        result = WHITESPACE.matcher(result).replaceAll("-");
        result = MULTI_DASH.matcher(result).replaceAll("-");
        result = LEADING_TRAILING_DASH.matcher(result).replaceAll("");
        return result;
    }

    /**
     * An giua email: "vanan@gmail.com" -> "va***@gmail.com"
     */
    public static String maskEmail(String email) {
        if (email == null || email.isBlank()) return email;
        int atIndex = email.indexOf('@');
        if (atIndex < 0) return email;
        String name = email.substring(0, atIndex);
        String domain = email.substring(atIndex);
        int show = Math.min(2, name.length());
        return name.substring(0, show) + "***" + domain;
    }

    /**
     * An giua phone: "0912345678" -> "091*****78"
     */
    public static String maskPhone(String phone) {
        if (phone == null || phone.isBlank() || phone.length() < 6) return phone;
        int len = phone.length();
        return phone.substring(0, 3) + "*".repeat(len - 5) + phone.substring(len - 2);
    }
}
