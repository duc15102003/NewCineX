package com.cinex.module.voucher.service;

import com.cinex.common.entity.StorageState;
import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.common.service.SecurityService;
import com.cinex.module.auth.entity.User;
import com.cinex.module.booking.entity.Booking;
import com.cinex.module.theater.entity.Theater;
import com.cinex.module.theater.repository.TheaterRepository;
import com.cinex.module.voucher.dto.ValidateVoucherResponse;
import com.cinex.module.voucher.dto.VoucherFilter;
import com.cinex.module.voucher.dto.VoucherRequest;
import com.cinex.module.voucher.dto.VoucherResponse;
import com.cinex.module.voucher.entity.DiscountType;
import com.cinex.module.voucher.entity.Voucher;
import com.cinex.module.voucher.entity.VoucherUsage;
import com.cinex.module.voucher.mapper.VoucherMapper;
import com.cinex.module.voucher.repository.VoucherRepository;
import com.cinex.module.voucher.repository.VoucherUsageRepository;
import com.cinex.module.voucher.specification.VoucherSpecification;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class VoucherService {

    private final VoucherRepository voucherRepository;
    private final VoucherUsageRepository voucherUsageRepository;
    private final VoucherMapper voucherMapper;
    private final SecurityService securityService;
    private final TheaterRepository theaterRepository;

    /**
     * Admin list voucher.
     * <p>Auto-scope branch ADMIN: force filter.theaterId = JWT.theaterId — admin chi nhánh
     * chỉ xem voucher của rạp mình + voucher global. SUPER_ADMIN không bị scope.
     */
    @Transactional(readOnly = true)
    public Page<VoucherResponse> listVouchers(VoucherFilter filter, Pageable pageable) {
        Long scopedTheaterId = securityService.getCurrentUserTheaterId();
        if (scopedTheaterId != null) {
            filter.setTheaterId(scopedTheaterId);
            filter.setGlobalOnly(null);
        }
        var spec = VoucherSpecification.fromFilter(filter);
        return voucherRepository.findAll(spec, pageable).map(voucherMapper::toResponse);
    }

    @Transactional(readOnly = true)
    public VoucherResponse getVoucher(Long id) {
        Voucher voucher = voucherRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.VOUCHER_NOT_FOUND));
        // Branch ADMIN: chỉ xem voucher của rạp mình hoặc voucher global
        Long scopedTheaterId = securityService.getCurrentUserTheaterId();
        if (scopedTheaterId != null && voucher.getTheater() != null
                && !voucher.getTheater().getId().equals(scopedTheaterId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Voucher thuộc chi nhánh khác");
        }
        return voucherMapper.toResponse(voucher);
    }

    @Transactional
    public VoucherResponse createVoucher(VoucherRequest request) {
        String code = request.getCode().toUpperCase();

        // Branch ADMIN: force theaterId từ JWT, không cho tạo cho rạp khác hoặc tạo global
        Long scopedTheaterId = securityService.getCurrentUserTheaterId();
        Long targetTheaterId = scopedTheaterId != null ? scopedTheaterId : request.getTheaterId();
        Theater theater = null;
        if (targetTheaterId != null) {
            theater = theaterRepository.findById(targetTheaterId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.THEATER_NOT_FOUND));
        }

        // Uniqueness check trong scope (global vs theater-specific)
        boolean exists = (targetTheaterId == null)
                ? voucherRepository.existsByCodeAndTheaterIsNull(code)
                : voucherRepository.existsByCodeAndTheaterId(code, targetTheaterId);
        if (exists) {
            String scopeLabel = targetTheaterId == null ? "toàn hệ thống" : "chi nhánh này";
            throw new BusinessException(ErrorCode.VOUCHER_EXISTED,
                    "Mã voucher '" + code + "' đã tồn tại trong " + scopeLabel);
        }

        validateVoucherRequest(request);

        Voucher voucher = Voucher.builder()
                .theater(theater)
                .code(code)
                .description(request.getDescription())
                .discountType(request.getDiscountType())
                .discountValue(request.getDiscountValue())
                .minOrderAmount(request.getMinOrderAmount() != null ? request.getMinOrderAmount() : BigDecimal.ZERO)
                .maxDiscount(request.getMaxDiscount())
                .usageLimit(request.getUsageLimit())
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .build();

        voucherRepository.save(voucher);
        log.info("Created voucher {} ({})", voucher.getCode(),
                theater == null ? "GLOBAL" : "theater=" + theater.getCode());
        return voucherMapper.toResponse(voucher);
    }

    @Transactional
    public VoucherResponse updateVoucher(Long id, VoucherRequest request) {
        Voucher voucher = voucherRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.VOUCHER_NOT_FOUND));

        // Branch ADMIN không được sửa voucher của rạp khác / voucher global
        Long scopedTheaterId = securityService.getCurrentUserTheaterId();
        if (scopedTheaterId != null) {
            if (voucher.getTheater() == null
                    || !voucher.getTheater().getId().equals(scopedTheaterId)) {
                throw new BusinessException(ErrorCode.FORBIDDEN,
                        "Bạn chỉ được sửa voucher của chi nhánh mình");
            }
        }

        // KHÔNG cho đổi theater khi update — voucher scope là identity, tạo mới nếu cần
        String newCode = request.getCode().toUpperCase();
        Long voucherTheaterId = voucher.getTheater() != null ? voucher.getTheater().getId() : null;
        if (!voucher.getCode().equals(newCode)) {
            boolean exists = (voucherTheaterId == null)
                    ? voucherRepository.existsByCodeAndTheaterIsNull(newCode)
                    : voucherRepository.existsByCodeAndTheaterId(newCode, voucherTheaterId);
            if (exists) {
                throw new BusinessException(ErrorCode.VOUCHER_EXISTED,
                        "Mã voucher '" + newCode + "' đã tồn tại trong scope này");
            }
        }

        validateVoucherRequest(request);

        voucher.setCode(newCode);
        voucher.setDescription(request.getDescription());
        voucher.setDiscountType(request.getDiscountType());
        voucher.setDiscountValue(request.getDiscountValue());
        voucher.setMinOrderAmount(request.getMinOrderAmount() != null ? request.getMinOrderAmount() : BigDecimal.ZERO);
        voucher.setMaxDiscount(request.getMaxDiscount());
        voucher.setUsageLimit(request.getUsageLimit());
        voucher.setStartDate(request.getStartDate());
        voucher.setEndDate(request.getEndDate());

        voucherRepository.save(voucher);
        log.info("Updated voucher: {}", voucher.getCode());
        return voucherMapper.toResponse(voucher);
    }

    @Transactional
    public void deleteVoucher(Long id) {
        Voucher voucher = voucherRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.VOUCHER_NOT_FOUND));
        requireScopeAccess(voucher);
        voucher.setStorageState(StorageState.ARCHIVED);
        voucherRepository.save(voucher);
        log.info("Soft deleted voucher: {}", voucher.getCode());
    }

    @Transactional
    public VoucherResponse restoreVoucher(Long id) {
        Voucher voucher = voucherRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.VOUCHER_NOT_FOUND));
        requireScopeAccess(voucher);
        voucher.setStorageState(StorageState.ACTIVE);
        voucherRepository.save(voucher);
        log.info("Restored voucher: {}", voucher.getCode());
        return voucherMapper.toResponse(voucher);
    }

    @Transactional
    public void bulkDelete(List<Long> ids) {
        List<Voucher> items = voucherRepository.findAllById(ids);
        items.forEach(this::requireScopeAccess);
        items.forEach(i -> i.setStorageState(StorageState.ARCHIVED));
        voucherRepository.saveAll(items);
        log.info("Bulk soft deleted {} items", items.size());
    }

    @Transactional
    public void bulkRestore(List<Long> ids) {
        List<Voucher> items = voucherRepository.findAllById(ids);
        items.forEach(this::requireScopeAccess);
        items.forEach(i -> i.setStorageState(StorageState.ACTIVE));
        voucherRepository.saveAll(items);
        log.info("Bulk restored {} items", items.size());
    }

    /**
     * Branch ADMIN: chỉ thao tác được voucher của rạp mình.
     * SUPER_ADMIN: pass mọi voucher.
     */
    private void requireScopeAccess(Voucher voucher) {
        Long scopedTheaterId = securityService.getCurrentUserTheaterId();
        if (scopedTheaterId == null) return;
        if (voucher.getTheater() == null
                || !voucher.getTheater().getId().equals(scopedTheaterId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN,
                    "Bạn chỉ được thao tác voucher của chi nhánh mình");
        }
    }

    /**
     * Danh sách voucher khả dụng cho user — đủ điều kiện áp dụng cho đơn hàng.
     *
     * <p>Theater context optional:
     * <ul>
     *   <li>theaterId NULL: chỉ trả voucher global (booking chưa biết theater)</li>
     *   <li>theaterId NOT NULL: trả voucher của theater đó + voucher global</li>
     * </ul>
     */
    @Transactional(readOnly = true)
    public Page<ValidateVoucherResponse> getAvailableVouchers(
            BigDecimal orderAmount, Long userId, Long theaterId, Pageable pageable) {
        Specification<Voucher> spec = Specification
                .where(VoucherSpecification.notDeleted())
                .and(VoucherSpecification.isActive(true))
                .and(VoucherSpecification.isCurrentlyValid())
                .and(VoucherSpecification.hasUsageLeft(true))
                .and(VoucherSpecification.orderMeetsMin(orderAmount));

        // Theater scope: theater-specific của rạp + voucher global
        if (theaterId != null) {
            spec = spec.and(VoucherSpecification.inTheaterOrGlobal(theaterId));
        } else {
            spec = spec.and(VoucherSpecification.isGlobal());
        }

        if (userId != null) {
            spec = spec.and(VoucherSpecification.notUsedByUser(userId));
        }

        java.text.NumberFormat nf = java.text.NumberFormat.getInstance(new java.util.Locale("vi", "VN"));

        return voucherRepository.findAll(spec, pageable).map(v -> {
            BigDecimal discount = calculateDiscount(v, orderAmount);
            String desc = v.getDiscountType() == DiscountType.PERCENTAGE
                    ? "Giảm " + v.getDiscountValue().intValue() + "%"
                        + (v.getMaxDiscount() != null ? " (tối đa " + nf.format(v.getMaxDiscount()) + "đ)" : "")
                    : "Giảm " + nf.format(v.getDiscountValue()) + "đ";
            return ValidateVoucherResponse.builder()
                    .valid(true)
                    .code(v.getCode())
                    .description(desc)
                    .discountAmount(discount)
                    .message(v.getDescription())
                    .build();
        });
    }

    /**
     * Validate voucher với theater context.
     *
     * <p><b>Resolution order (industry-standard, more specific wins):</b>
     * <ol>
     *   <li>Nếu có theaterId → tìm voucher theater-specific trước</li>
     *   <li>Fallback: tìm voucher global (theater_id IS NULL)</li>
     *   <li>Nếu vẫn null nhưng tồn tại voucher cùng code ở rạp khác → reject "thuộc rạp khác"</li>
     * </ol>
     */
    @Transactional(readOnly = true)
    public ValidateVoucherResponse validateVoucher(String code, BigDecimal orderAmount,
                                                    Long userId, Long theaterId) {
        Voucher voucher = resolveVoucherByCode(code, theaterId);

        if (voucher == null) {
            if (voucherRepository.existsByCode(code.toUpperCase())) {
                return invalid("Voucher không áp dụng cho chi nhánh hiện tại");
            }
            return invalid("Mã voucher không tồn tại");
        }
        if (StorageState.ARCHIVED.equals(voucher.getStorageState())) {
            return invalid("Mã voucher không tồn tại");
        }
        if (!voucher.isActive()) {
            return invalid("Voucher chưa được kích hoạt");
        }

        LocalDateTime now = LocalDateTime.now();
        if (now.isBefore(voucher.getStartDate()) || now.isAfter(voucher.getEndDate())) {
            return invalid("Voucher đã hết hạn hoặc chưa đến ngày áp dụng");
        }

        if (voucher.getUsageLimit() != null && voucher.getUsageLimit() > 0
                && voucher.getUsedCount() >= voucher.getUsageLimit()) {
            return invalid("Voucher đã hết lượt sử dụng");
        }

        if (userId != null && voucherUsageRepository.existsByVoucherIdAndUserId(voucher.getId(), userId)) {
            return invalid("Bạn đã sử dụng voucher này rồi");
        }

        if (orderAmount.compareTo(voucher.getMinOrderAmount()) < 0) {
            return invalid("Đơn hàng tối thiểu phải là " + voucher.getMinOrderAmount() + " VND");
        }

        BigDecimal discountAmount = calculateDiscount(voucher, orderAmount);

        return ValidateVoucherResponse.builder()
                .valid(true)
                .discountAmount(discountAmount)
                .message("Áp dụng voucher thành công: -" + discountAmount + " VND")
                .build();
    }

    /** Backward-compat overload — không có theater context → chỉ tìm global. */
    @Transactional(readOnly = true)
    public ValidateVoucherResponse validateVoucher(String code, BigDecimal orderAmount, Long userId) {
        return validateVoucher(code, orderAmount, userId, null);
    }

    /**
     * Resolution: theater-specific FIRST (more specific), fallback global.
     * Return null nếu không tìm thấy ở scope nào.
     */
    private Voucher resolveVoucherByCode(String code, Long theaterId) {
        String upper = code.toUpperCase();
        if (theaterId != null) {
            var specific = voucherRepository.findFirstByCodeAndTheaterId(upper, theaterId);
            if (specific.isPresent()) return specific.get();
        }
        return voucherRepository.findFirstByCodeAndTheaterIsNull(upper).orElse(null);
    }

    /**
     * Ghi nhận đã dùng voucher theo code với theater context — gọi sau khi booking tạo (holdSeats).
     */
    @Transactional
    public void useVoucherByCode(String code, User user, Booking booking, Long theaterId) {
        Voucher voucher = resolveVoucherByCode(code, theaterId);
        if (voucher != null) {
            useVoucher(voucher.getId(), user, booking);
        }
    }

    /** Backward-compat overload — chỉ tìm global. */
    @Transactional
    public void useVoucherByCode(String code, User user, Booking booking) {
        useVoucherByCode(code, user, booking, null);
    }

    /**
     * Ghi nhận đã dùng voucher — gọi sau khi booking confirm.
     *
     * [Concurrency hardening]
     *  1. Tăng usedCount bằng atomic UPDATE (DB-side WHERE check) — chống race
     *     khiến 2 thread cùng đọc usedCount rồi cùng +1, dẫn đến vượt usageLimit.
     *  2. Catch DataIntegrityViolationException khi INSERT VoucherUsage (UNIQUE
     *     constraint voucher_id+user_id) — chống user dùng cùng voucher 2 lần
     *     đồng thời.
     */
    @Transactional
    public void useVoucher(Long voucherId, User user, Booking booking) {
        Voucher voucher = voucherRepository.findById(voucherId)
                .orElseThrow(() -> new BusinessException(ErrorCode.VOUCHER_NOT_FOUND));

        int updated = voucherRepository.incrementUsedCountIfAvailable(voucher.getId());
        if (updated == 0) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "Voucher đã hết lượt sử dụng");
        }

        VoucherUsage usage = VoucherUsage.builder()
                .voucher(voucher)
                .user(user)
                .booking(booking)
                .build();
        try {
            voucherUsageRepository.saveAndFlush(usage);
        } catch (DataIntegrityViolationException ex) {
            log.warn("User {} tried to use voucher {} twice concurrently",
                    user.getUsername(), voucher.getCode());
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "Bạn đã dùng voucher này rồi");
        }

        log.info("Voucher {} used by user {} for booking {}",
                voucher.getCode(), user.getUsername(), booking.getBookingCode());
    }

    public BigDecimal calculateDiscount(Voucher voucher, BigDecimal orderAmount) {
        if (voucher.getDiscountType() == DiscountType.PERCENTAGE) {
            BigDecimal discount = orderAmount
                    .multiply(voucher.getDiscountValue())
                    .divide(BigDecimal.valueOf(100), 0, RoundingMode.FLOOR);
            if (voucher.getMaxDiscount() != null && discount.compareTo(voucher.getMaxDiscount()) > 0) {
                discount = voucher.getMaxDiscount();
            }
            return discount;
        } else {
            return voucher.getDiscountValue();
        }
    }

    private ValidateVoucherResponse invalid(String message) {
        return ValidateVoucherResponse.builder()
                .valid(false)
                .discountAmount(BigDecimal.ZERO)
                .message(message)
                .build();
    }

    /**
     * Validate business rules chung cho cả create và update.
     */
    private void validateVoucherRequest(VoucherRequest request) {
        if (request.getDiscountType() == DiscountType.PERCENTAGE) {
            if (request.getDiscountValue().compareTo(BigDecimal.valueOf(100)) > 0) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST,
                        "Phần trăm giảm giá không được vượt quá 100%");
            }
        }

        if (request.getMaxDiscount() != null && request.getMinOrderAmount() != null
                && request.getMaxDiscount().compareTo(request.getMinOrderAmount()) > 0) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Giảm tối đa không được lớn hơn đơn tối thiểu");
        }

        if (request.getDiscountType() == DiscountType.FIXED_AMOUNT
                && request.getMinOrderAmount() != null
                && request.getDiscountValue().compareTo(request.getMinOrderAmount()) > 0) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Giá trị giảm không được lớn hơn đơn tối thiểu");
        }

        if (request.getEndDate() != null && request.getStartDate() != null
                && request.getEndDate().isBefore(request.getStartDate())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Ngày kết thúc phải sau ngày bắt đầu");
        }
    }
}
