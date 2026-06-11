package com.cinex.common.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.aop.interceptor.AsyncUncaughtExceptionHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.AsyncConfigurer;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * [Async Config] Cấu hình executor riêng cho các method @Async.
 *
 * <p><b>Tại sao cần executor riêng?</b><br>
 * Mặc định Spring dùng {@code SimpleAsyncTaskExecutor} — tạo thread MỚI mỗi lần
 * gọi @Async (không pool, không giới hạn). Khi traffic cao → spawn hàng nghìn
 * thread → OutOfMemory hoặc CPU thrashing. Pool riêng giới hạn tài nguyên rõ ràng.
 *
 * <p><b>proxyTargetClass = true</b>: dùng CGLIB proxy thay vì JDK dynamic proxy
 * — cần thiết khi @Async áp dụng cho class concrete không implement interface.
 *
 * <p><b>CallerRunsPolicy</b>: khi queue đầy → caller thread tự execute task
 * (thay vì throw RejectedExecutionException). Giúp giảm tải tự nhiên — caller
 * sẽ chậm lại, không drop task quan trọng (email, notification, audit).
 */
@Slf4j
@Configuration
@EnableAsync(proxyTargetClass = true)
public class AsyncConfig implements AsyncConfigurer {

    @Override
    @Bean(name = "taskExecutor")
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("cinex-async-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();
        return executor;
    }

    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return (throwable, method, params) ->
                log.error("Async error in {}: {}", method.getName(), throwable.getMessage(), throwable);
    }
}
