package com.cinex.security;

import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.User;

import java.util.Collection;

/**
 * Custom UserDetails của CineX — extend Spring {@link User} thêm field {@code theaterId}.
 *
 * <p><b>Mục đích:</b> sau F1 multi-branch RBAC, ADMIN bị scope theo theater. Thay vì
 * đọc JWT claim mỗi request (tốn parse), giữ theaterId trong UserDetails (đã cache
 * qua {@link UserDetailsCacheService} TTL 2 phút).
 *
 * <p><b>Access pattern:</b>
 * <pre>{@code
 * Authentication auth = SecurityContextHolder.getContext().getAuthentication();
 * CinexUserPrincipal principal = (CinexUserPrincipal) auth.getPrincipal();
 * Long theaterId = principal.getTheaterId(); // null cho USER/SUPER_ADMIN
 * }</pre>
 */
@Getter
public class CinexUserPrincipal extends User {

    /**
     * Chi nhánh user thuộc về. Null cho USER (booking ở đâu cũng được) và
     * SUPER_ADMIN (xem tất cả).
     */
    private final Long theaterId;

    public CinexUserPrincipal(String username, String password, boolean enabled,
                              Collection<? extends GrantedAuthority> authorities,
                              Long theaterId) {
        super(username, password, enabled, true, true, true, authorities);
        this.theaterId = theaterId;
    }
}
