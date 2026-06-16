package com.cinex.module.auth.repository;

import com.cinex.module.auth.entity.Role;
import com.cinex.module.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> {

    // Dùng cho login + SecurityContext → PHẢI filter user đã soft-delete (ARCHIVED không được login)
    @Query("SELECT u FROM User u WHERE u.username = :username AND (u.storageState IS NULL OR u.storageState <> 'ARCHIVED')")
    Optional<User> findActiveByUsername(String username);

    // Dùng cho admin getById → không filter (xem chi tiết user đã xóa)
    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    /**
     * Đếm user enabled theo role — dùng để chặn disable/demote SUPER_ADMIN cuối
     * cùng (tránh lockout hệ thống không ai quản trị tổng).
     */
    long countByRoleAndEnabledTrue(Role role);
}
