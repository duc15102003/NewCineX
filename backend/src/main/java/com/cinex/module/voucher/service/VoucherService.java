package com.cinex.module.voucher.service;

import com.cinex.common.entity.StorageState;
import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.module.auth.entity.User;
import com.cinex.module.booking.entity.Booking;
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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

    @Transactional(readOnly = true)
    public Page<VoucherResponse> listVouchers(VoucherFilter filter, Pageable pageable) {
        var spec = VoucherSpecification.fromFilter(filter);
        return voucherRepository.findAll(spec, pageable).map(voucherMapper::toResponse);
    }

    @Transactional(readOnly = true)
    public VoucherResponse getVoucher(Long id) {
        Voucher voucher = voucherRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.VOUCHER_NOT_FOUND));
        return voucherMapper.toResponse(voucher);
    }

    @Transactional
    public VoucherResponse createVoucher(VoucherRequest request) {
        if (voucherRepository.existsByCode(request.getCode())) {
            throw new BusinessException(ErrorCode.VOUCHER_EXISTED,
                    "Mã voucher '" + request.getCode() + "' đã tồn tại");
        }

        validateVoucherRequest(request);

        Voucher voucher = Voucher.builder()
                .code(request.getCode().toUpperCase())
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
        log.info("Created voucher: {}", voucher.getCode());
        return voucherMapper.toResponse(voucher);
    }

    @Transactional
    public VoucherResponse updateVoucher(Long id, VoucherRequest request) {
        Voucher voucher = voucherRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.VOUCHER_NOT_FOUND));

        if (!voucher.getCode().equals(request.getCode().toUpperCase())
                && voucherRepository.existsByCode(request.getCode().toUpperCase())) {
            throw new BusinessException(ErrorCode.VOUCHER_EXISTED,
                    "Mã voucher '" + request.getCode() + "' đã tồn tại");
        }

        validateVoucherRequest(request);

        voucher.setCode(request.getCode().toUpperCase());
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
        voucher.setStorageState(StorageState.ARCHIVED);
        voucherRepository.save(voucher);
        log.info("Soft deleted voucher: {}", voucher.getCode());
    }

    @Transactional
    public VoucherResponse restoreVoucher(Long id) {
        Voucher voucher = voucherRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.VOUCHER_NOT_FOUND));
        voucher.setStorageState(StorageState.ACTIVE);
        voucherRepository.save(voucher);
        log.info("Restored voucher: {}", voucher.getCode());
        return voucherMapper.toResponse(voucher);
    }

    @Transactional
    public void bulkDelete(List<Long> ids) {
        List<Voucher> items = voucherRepository.findAllById(ids);
        items.forEach(i -> i.setStorageState(StorageState.ARCHIVED));
        voucherRepository.saveAll(items);
        log.info("Bulk soft deleted {} items", items.size());
    }

    @Transactional
    public void bulkRestore(List<Long> ids) {
        List<Voucher> items = voucherRepository.findAllById(ids);
        items.forEach(i -> i.setStorageState(StorageState.ACTIVE));
        voucherRepository.saveAll(items);
        log.info("Bulk restored {} items", items.size());
    }

    /**
     * Danh sách voucher khả dụng cho user — đủ điều kiện áp dụng cho đơn hàng.
     */
    @Transactional(readOnly = true)
    public List<ValidateVoucherResponse> getAvailableVouchers(BigDecimal orderAmount, Long userId) {
        LocalDateTime now = LocalDateTime.now();
        List<Voucher> all = voucherRepository.findAll();

        return all.stream()
                .filter(v -> StorageState.ACTIVE.equals(v.getStorageState()))
                .filter(v -> v.isActive())
                .filter(v -> v.getStartDate() != null && v.getEndDate() != null)
                .filter(v -> !now.isBefore(v.getStartDate()) && !now.isAfter(v.getEndDate()))
                .filter(v -> v.getUsageLimit() == null || v.getUsageLimit() == 0
                        || (v.getUsedCount() != null ? v.getUsedCount() : 0) < v.getUsageLimit())
                .filter(v -> v.getMinOrderAmount() == null || orderAmount.compareTo(v.getMinOrderAmount()) >= 0)
                .filter(v -> userId == null
                        || !voucherUsageRepository.existsByVoucherIdAndUserId(v.getId(), userId))
                .map(v -> {
                    BigDecimal discount = calculateDiscount(v, orderAmount);
                    java.text.NumberFormat nf = java.text.NumberFormat.getInstance(new java.util.Locale("vi", "VN"));
                    String desc = v.getDiscountType() == DiscountType.PERCENTAGE
                            ? "Giảm " + v.getDiscountValue().intValue() + "%" + (v.getMaxDiscount() != null ? " (tối đa " + nf.format(v.getMaxDiscount()) + "đ)" : "")
                            : "Giảm " + nf.format(v.getDiscountValue()) + "đ";
                    return ValidateVoucherResponse.builder()
                            .valid(true)
                            .code(v.getCode())
                            .description(desc)
                            .discountAmount(discount)
                            .message(v.getDescription())
                            .build();
                })
                .toList();
    }

    /**
     * Validate voucher — kiểm tra hợp lệ + tính số tiền giảm.
     *
     * Check:
     * 1. Code tồn tại + active + chưa soft delete
     * 2. Chưa hết hạn (now giữa startDate và endDate)
     * 3. Chưa hết lượt (usedCount < usageLimit, hoặc usageLimit = null)
     * 4. User chưa dùng voucher này
     * 5. orderAmount >= minOrderAmount
     *
     * Tính discountAmount:
     * - PERCENTAGE: orderAmount × discountValue / 100, cap maxDiscount
     * - FIXED_AMOUNT: discountValue
     */
    @Transactional(readOnly = true)
    public ValidateVoucherResponse validateVoucher(String code, BigDecimal orderAmount, Long userId) {
        Voucher voucher = voucherRepository.findByCode(code.toUpperCase()).orElse(null);

        if (voucher == null || StorageState.ARCHIVED.equals(voucher.getStorageState())) {
            return invalid("Mã voucher không tồn tại");
        }
        if (!voucher.isActive()) {
            return invalid("Voucher chưa được kích hoạt");
        }

        LocalDateTime now = LocalDateTime.now();
        if (now.isBefore(voucher.getStartDate()) || now.isAfter(voucher.getEndDate())) {
            return invalid("Voucher đã hết hạn hoặc chưa đến ngày áp dụng");
        }

        // FIX 4: usageLimit = null hoặc 0 → không giới hạn lượt dùng
        // usageLimit > 0 → mới kiểm tra đã hết chưa
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

        // Tính discount
        BigDecimal discountAmount = calculateDiscount(voucher, orderAmount);

        return ValidateVoucherResponse.builder()
                .valid(true)
                .discountAmount(discountAmount)
                .message("Áp dụng voucher thành công: -" + discountAmount + " VND")
                .build();
    }

    /**
     * Ghi nhận đã dùng voucher theo code — gọi sau khi booking được tạo (holdSeats).
     * Tìm voucher theo code rồi delegate sang useVoucher(id, user, booking).
     */
    @Transactional
    public void useVoucherByCode(String code, User user, Booking booking) {
        Voucher voucher = voucherRepository.findByCode(code.toUpperCase()).orElse(null);
        if (voucher != null) {
            useVoucher(voucher.getId(), user, booking);
        }
    }

    /**
     * Ghi nhận đã dùng voucher — gọi sau khi booking confirm.
     */
    @Transactional
    public void useVoucher(Long voucherId, User user, Booking booking) {
        Voucher voucher = voucherRepository.findById(voucherId)
                .orElseThrow(() -> new BusinessException(ErrorCode.VOUCHER_NOT_FOUND));

        VoucherUsage usage = VoucherUsage.builder()
                .voucher(voucher)
                .user(user)
                .booking(booking)
                .build();
        voucherUsageRepository.save(usage);

        voucher.setUsedCount(voucher.getUsedCount() + 1);
        voucherRepository.save(voucher);

        log.info("Voucher {} used by user {} for booking {}",
                voucher.getCode(), user.getUsername(), booking.getBookingCode());
    }

    public BigDecimal calculateDiscount(Voucher voucher, BigDecimal orderAmount) {
        if (voucher.getDiscountType() == DiscountType.PERCENTAGE) {
            BigDecimal discount = orderAmount
                    .multiply(voucher.getDiscountValue())
                    .divide(BigDecimal.valueOf(100), 0, RoundingMode.FLOOR);
            // Cap maxDiscount
            if (voucher.getMaxDiscount() != null && discount.compareTo(voucher.getMaxDiscount()) > 0) {
                discount = voucher.getMaxDiscount();
            }
            return discount;
        } else {
            // FIXED_AMOUNT
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
     * Tách ra method riêng để tránh duplicate code (DRY principle).
     */
    private void validateVoucherRequest(VoucherRequest request) {
        // PERCENTAGE không được vượt quá 100%
        if (request.getDiscountType() == DiscountType.PERCENTAGE) {
            if (request.getDiscountValue().compareTo(BigDecimal.valueOf(100)) > 0) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST,
                        "Phần trăm giảm giá không được vượt quá 100%");
            }
        }

        // Giảm tối đa không được lớn hơn đơn tối thiểu
        if (request.getMaxDiscount() != null && request.getMinOrderAmount() != null
                && request.getMaxDiscount().compareTo(request.getMinOrderAmount()) > 0) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Giảm tối đa không được lớn hơn đơn tối thiểu");
        }

        // FIXED_AMOUNT: giá trị giảm không được lớn hơn đơn tối thiểu
        if (request.getDiscountType() == DiscountType.FIXED_AMOUNT
                && request.getMinOrderAmount() != null
                && request.getDiscountValue().compareTo(request.getMinOrderAmount()) > 0) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Giá trị giảm không được lớn hơn đơn tối thiểu");
        }

        // Ngày kết thúc phải sau ngày bắt đầu
        if (request.getEndDate() != null && request.getStartDate() != null
                && request.getEndDate().isBefore(request.getStartDate())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Ngày kết thúc phải sau ngày bắt đầu");
        }
    }
}
