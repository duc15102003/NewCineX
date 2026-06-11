package com.cinex.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Service;

import java.time.Duration;

/**
 * [Caffeine Cache] Cache UserDetails để tránh query DB mỗi request có JWT.
 *
 * <p><b>Bài toán:</b> mỗi request authenticated → JwtAuthFilter gọi
 * {@code userDetailsService.loadUserByUsername()} → 1 query SELECT user JOIN role.
 * Với endpoint hot (vd: /api/showtimes, /api/movies) → DB chịu tải lớn vô ích
 * vì user data hiếm khi đổi giữa các request liên tiếp.
 *
 * <p><b>Giải pháp:</b> local cache (Caffeine) với TTL 2 phút.<br>
 * - TTL ngắn (2p): cân bằng giữa staleness và hit ratio. Nếu admin disable
 *   user, max 2p sau request bị 401.<br>
 * - maxSize 1000: đủ cho user concurrent active. LRU eviction.
 *
 * <p><b>Vì sao không dùng Spring @Cacheable + Redis?</b><br>
 * - UserDetails KHÔNG nên serialize qua network: chứa authorities, password hash.<br>
 * - Local cache nhanh hơn Redis (nanosecond vs millisecond).<br>
 * - Mỗi instance giữ cache riêng OK vì TTL ngắn.
 *
 * <p><b>Invalidate khi nào?</b> User update role / disable account → gọi
 * {@link #invalidate(String)}. Hiện tại để TTL tự xử lý — nâng cấp sau khi cần.
 */
@Slf4j
@Service
public class UserDetailsCacheService {

    private final UserDetailsService delegate;
    private final Cache<String, UserDetails> cache;

    public UserDetailsCacheService(UserDetailsService delegate) {
        this.delegate = delegate;
        this.cache = Caffeine.newBuilder()
                .expireAfterWrite(Duration.ofMinutes(2))
                .maximumSize(1000)
                .recordStats()
                .build();
    }

    /**
     * Lấy UserDetails từ cache; miss → load từ DB và put cache.
     * Dùng get(key, loader) thay vì getIfPresent + put để atomic
     * (tránh 2 thread cùng miss + cùng query DB).
     */
    public UserDetails loadUserByUsername(String username) {
        return cache.get(username, key -> {
            log.debug("UserDetails cache MISS for {}", key);
            return delegate.loadUserByUsername(key);
        });
    }

    /**
     * Bust cache khi user thay đổi quyền / bị disable.
     * Service nào update user PHẢI gọi method này.
     */
    public void invalidate(String username) {
        cache.invalidate(username);
        log.debug("UserDetails cache invalidated for {}", username);
    }

    public void invalidateAll() {
        cache.invalidateAll();
    }
}
