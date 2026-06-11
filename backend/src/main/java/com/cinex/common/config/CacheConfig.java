package com.cinex.common.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * [Cache Configuration] Cấu hình Spring Cache + Caffeine cho các API thống kê nặng.
 *
 * <p><b>Bài toán:</b> Statistics API (dashboard) phải JOIN nhiều bảng + GROUP BY + SUM →
 * mỗi lần admin mở dashboard, query chạy 200-500ms. Admin refresh liên tục → DB quá tải.
 *
 * <p><b>Giải pháp:</b> Cache kết quả trong RAM với TTL 60s. Lần đầu query → DB; lần sau
 * trong 60s → trả thẳng từ RAM (1ms). Sau 60s tự expire, request tiếp theo refresh cache.
 *
 * <p><b>Tại sao Caffeine?</b>
 * - Local cache (in-process) → không cần network call như Redis
 * - Hiệu năng cao nhất Java caching libs (W-TinyLFU eviction)
 * - Đã có sẵn trong dependency (UserDetails cache)
 *
 * <p><b>Cache names:</b>
 * <ul>
 *   <li>stats-overview — dashboard tổng quan (today bookings, revenue, total users/movies)</li>
 *   <li>stats-revenue — biểu đồ doanh thu theo ngày</li>
 *   <li>stats-top-movies — top phim bán chạy</li>
 *   <li>stats-top-snacks — top snack bán chạy</li>
 * </ul>
 *
 * <p>TTL 60s là cân bằng: dữ liệu thống kê không cần real-time tuyệt đối, 1 phút lag chấp nhận.
 */
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager(
                "stats-overview",
                "stats-revenue",
                "stats-top-movies",
                "stats-top-movie-runs",
                "stats-top-snacks",
                "stats-occupancy"
        );
        manager.setCaffeine(Caffeine.newBuilder()
                .expireAfterWrite(Duration.ofSeconds(60))
                .maximumSize(100)
                .recordStats());
        return manager;
    }
}
