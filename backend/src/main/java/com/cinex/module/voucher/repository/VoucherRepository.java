package com.cinex.module.voucher.repository;

import com.cinex.common.entity.StorageState;
import com.cinex.module.voucher.entity.Voucher;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface VoucherRepository extends JpaRepository<Voucher, Long>, JpaSpecificationExecutor<Voucher> {

    /**
     * Lookup voucher với theater context — ưu tiên theater-specific, fallback global.
     *
     * <p>Khi user nhập code "SUMMER2026" tại theater #5:
     * <ol>
     *   <li>Tìm voucher theater-specific: code=SUMMER2026 AND theater_id=5 → ưu tiên</li>
     *   <li>Nếu không có → tìm voucher global: code=SUMMER2026 AND theater_id IS NULL</li>
     *   <li>Caller sẽ check: nếu vẫn null nhưng existsByCode=true → reject "voucher thuộc rạp khác"</li>
     * </ol>
     */
    Optional<Voucher> findFirstByCodeAndTheaterId(String code, Long theaterId);

    /** Lookup global voucher (theater_id IS NULL). */
    Optional<Voucher> findFirstByCodeAndTheaterIsNull(String code);

    /** Tồn tại voucher với code này (bất kể theater) — dùng để báo lỗi "thuộc rạp khác". */
    boolean existsByCode(String code);

    /** Tồn tại voucher global với code này — check uniqueness khi tạo global voucher. */
    boolean existsByCodeAndTheaterIsNull(String code);

    /** Tồn tại voucher theater-specific với code này tại theater — check uniqueness khi tạo. */
    boolean existsByCodeAndTheaterId(String code, Long theaterId);

    List<Voucher> findByStorageStateAndEndDateBefore(StorageState state, LocalDateTime before);

    /**
     * [Atomic UPDATE - chống double-spend]
     *
     * Tăng usedCount lên 1 CHỈ KHI usageLimit chưa hết (hoặc null = không giới hạn).
     * Trả về số row bị ảnh hưởng:
     *   - 1: tăng thành công (voucher còn lượt).
     *   - 0: voucher đã hết lượt → caller cần throw lỗi.
     *
     * Vì sao cần?
     * Pattern read-modify-write (load Voucher → kiểm tra usedCount → +1 → save) bị race
     * khi 2 thread cùng đọc usedCount = N rồi cùng ghi N+1 → vé bán quá usageLimit.
     * UPDATE ... WHERE usedCount < usageLimit nằm gọn trong 1 statement,
     * DB serialize qua row lock → đảm bảo nguyên tử.
     */
    @Modifying
    @Query("UPDATE Voucher v SET v.usedCount = v.usedCount + 1 " +
            "WHERE v.id = :id " +
            "AND (v.usageLimit IS NULL OR v.usageLimit = 0 OR v.usedCount < v.usageLimit)")
    int incrementUsedCountIfAvailable(@Param("id") Long id);

    /**
     * [Atomic UPDATE - trả lại voucher khi booking bị hủy/expired]
     *
     * Giảm usedCount đi 1 CHỈ KHI usedCount > 0 (tránh âm).
     * Atomic trong 1 statement → tránh race khi nhiều booking cancel song song.
     */
    @Modifying
    @Query("UPDATE Voucher v SET v.usedCount = v.usedCount - 1 " +
            "WHERE v.id = :id AND v.usedCount > 0")
    int decrementUsedCount(@Param("id") Long id);
}
