package com.cinex.common.util;

import java.time.format.DateTimeFormatter;

/**
 * Constants format ngay gio dung chung.
 * Logic nghiep vu (isOverlapping, isWeekend, ...) de trong Service tuong ung.
 */
public final class DateTimeUtil {

    private DateTimeUtil() {}

    public static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    public static final DateTimeFormatter DATETIME_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    public static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HH:mm");
    public static final DateTimeFormatter ISO_DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");
}
