package com.cinex.module.statistics.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * Tỉ lệ lấp ghế tổng hợp trong khoảng thời gian — KPI số 1 của rạp.
 *
 * <p>Cinema chuẩn industry track 2 layer:
 * <ul>
 *   <li><b>Per-showtime</b> ({@link OccupancyStatistics}) — operations daily,
 *       biết suất nào chiếu phòng trống quá để cancel hoặc khuyến mãi.</li>
 *   <li><b>Aggregate</b> (DTO này) — strategic, manager xem hiệu quả tuần/tháng,
 *       distributor báo cáo, đánh giá hiệu suất phòng.</li>
 * </ul>
 *
 * <p>Formula: {@code SUM(booked_seats) / SUM(total_seats) * 100}. Đếm tất cả
 * suất chiếu ONGOING + FINISHED trong khoảng (DRAFT/SCHEDULED chưa chiếu chưa
 * tính). Booking phải CONFIRMED/CHECKED_IN, seat phải status=BOOKED.
 */
@Getter
@AllArgsConstructor
public class OccupancyAggregateStatistics {

    /** Tổng số ghế đã bán (BookingSeat status=BOOKED của booking CONFIRMED/CHECKED_IN). */
    private long bookedSeats;

    /** Tổng số ghế chào bán (SUM total_seats của các Showtime đã chiếu trong khoảng). */
    private long totalSeats;

    /** Tỉ lệ % = bookedSeats / totalSeats × 100. 0.0 nếu totalSeats = 0. */
    private double occupancyRate;

    /** Số suất đã chiếu trong khoảng — denominator cho context "trung bình bao nhiêu suất". */
    private long sessionCount;
}
