package com.cinex.module.voucher.entity;

public enum DiscountType {
    PERCENTAGE,     // Giảm theo % (VD: 20% đơn 300k = giảm 60k, cap maxDiscount)
    FIXED_AMOUNT    // Giảm số tiền cố định (VD: giảm 50.000đ)
}
