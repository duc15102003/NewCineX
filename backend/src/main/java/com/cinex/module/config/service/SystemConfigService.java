package com.cinex.module.config.service;

import com.cinex.module.config.entity.SystemConfig;
import com.cinex.module.config.repository.SystemConfigRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

/**
 * [Cache-aside Pattern] Đọc config từ cache (ConcurrentHashMap) trước.
 * Nếu cache miss -> đọc DB -> lưu cache.
 * Khi admin sửa config -> gọi reload() để refresh cache.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SystemConfigService {

    private final SystemConfigRepository systemConfigRepository;

    // Cache in-memory: key -> value
    private final ConcurrentHashMap<String, String> cache = new ConcurrentHashMap<>();

    @PostConstruct
    public void loadAll() {
        List<SystemConfig> configs = systemConfigRepository.findAll();
        cache.clear();
        configs.forEach(c -> cache.put(c.getConfigKey(), c.getConfigValue()));
        log.info("Loaded {} system configs into cache", configs.size());
    }

    public String getString(String key, String defaultValue) {
        return cache.getOrDefault(key, defaultValue);
    }

    public int getInt(String key, int defaultValue) {
        String value = cache.get(key);
        if (value == null) return defaultValue;
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            log.warn("Config key '{}' value '{}' is not a valid integer, using default {}", key, value, defaultValue);
            return defaultValue;
        }
    }

    public long getLong(String key, long defaultValue) {
        String value = cache.get(key);
        if (value == null) return defaultValue;
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException e) {
            log.warn("Config key '{}' value '{}' is not a valid long, using default {}", key, value, defaultValue);
            return defaultValue;
        }
    }

    public boolean getBoolean(String key, boolean defaultValue) {
        String value = cache.get(key);
        if (value == null) return defaultValue;
        return "true".equalsIgnoreCase(value) || "1".equals(value);
    }

    /**
     * Admin cập nhật config -> lưu DB + refresh cache.
     */
    @Transactional
    public void updateConfig(String key, String value) {
        SystemConfig config = systemConfigRepository.findByConfigKey(key)
                .orElseGet(() -> SystemConfig.builder().configKey(key).build());
        config.setConfigValue(value);
        systemConfigRepository.save(config);
        cache.put(key, value);
        log.info("Config updated: {} = {}", key, value);
    }

    /**
     * Reload toàn bộ cache từ DB (dùng khi cần sync lại).
     */
    public void reload() {
        loadAll();
    }
}
