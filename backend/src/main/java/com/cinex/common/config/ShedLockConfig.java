package com.cinex.common.config;

import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.provider.jdbctemplate.JdbcTemplateLockProvider;
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;

/**
 * [ShedLock Config] Distributed lock cho @Scheduled jobs.
 *
 * <p><b>Bài toán:</b> trên môi trường production deploy nhiều instance backend
 * (HA, scale-out), mỗi instance đều có scheduler riêng → cùng 1 job (vd:
 * cleanup booking HOLDING) sẽ chạy đồng thời trên N instance → race condition.
 *
 * <p><b>Giải pháp:</b> trước khi chạy, job phải "giành lock" qua bảng shedlock
 * trong DB. Chỉ 1 instance giành được sẽ chạy, các instance khác skip lần đó.
 *
 * <p><b>defaultLockAtMostFor = PT5M</b>: nếu instance giữ lock crash, lock
 * tự release sau tối đa 5 phút — tránh deadlock vĩnh viễn.
 *
 * <p><b>usingDbTime()</b>: dùng giờ của DB server thay vì giờ JVM. Tránh lệch
 * giờ giữa các instance gây lock sai.
 */
@Configuration
@EnableSchedulerLock(defaultLockAtMostFor = "PT5M")
public class ShedLockConfig {

    @Bean
    public LockProvider lockProvider(DataSource dataSource) {
        return new JdbcTemplateLockProvider(
                JdbcTemplateLockProvider.Configuration.builder()
                        .withJdbcTemplate(new JdbcTemplate(dataSource))
                        .usingDbTime()
                        .build()
        );
    }
}
