package com.cinex.common.entity.tracker;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
public class IdTrackerService {

    private final IdTrackerRepository idTrackerRepository;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyyMMdd");

    /**
     * Sinh code có ngày: VD "VC-20260510-001"
     * Dùng cho: booking, payment
     */
    @Transactional
    public String nextCodeWithDate(String entityType) {
        IdTracker tracker = getAndIncrement(entityType);
        String date = LocalDate.now().format(DATE_FMT);
        return String.format("%s-%s-%03d", tracker.getPrefix(), date, tracker.getCurrentValue());
    }

    /**
     * Sinh code không có ngày: VD "USR-001", "MOV-001"
     * Dùng cho: user, movie, room, ...
     */
    @Transactional
    public String nextCode(String entityType) {
        IdTracker tracker = getAndIncrement(entityType);
        return String.format("%s-%03d", tracker.getPrefix(), tracker.getCurrentValue());
    }

    /**
     * Lấy số tiếp theo (không format): VD 1, 2, 3, ...
     */
    @Transactional
    public long nextValue(String entityType) {
        IdTracker tracker = getAndIncrement(entityType);
        return tracker.getCurrentValue();
    }

    private IdTracker getAndIncrement(String entityType) {
        IdTracker tracker = idTrackerRepository.findByEntityType(entityType)
                .orElseThrow(() -> new IllegalArgumentException(
                        "IdTracker not found for entity type: " + entityType));
        tracker.setCurrentValue(tracker.getCurrentValue() + 1);
        return idTrackerRepository.save(tracker);
    }
}
