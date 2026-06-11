package com.cinex.module.movie.entity;

/**
 * Trạng thái 1 đợt chiếu ({@link MovieRun}).
 *
 * <p>Khác với {@link MovieStatus} (trạng thái chung của phim — quản lý ở Movie),
 * status này gắn vào 1 đợt chiếu cụ thể nên nhiều run của cùng 1 phim có thể có status khác nhau.
 *
 * <p>Lifecycle (auto-update bởi {@code MovieRunStatusScheduler} ở commit 3):
 * <pre>
 *   today &lt; startDate                      → SCHEDULED
 *   startDate &lt;= today &lt;= endDate          → NOW_SHOWING
 *   today &gt; endDate                        → ENDED
 * </pre>
 */
public enum MovieRunStatus {
    SCHEDULED,
    NOW_SHOWING,
    ENDED
}
