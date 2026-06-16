package com.cinex.module.snack.service;

import com.cinex.common.entity.StorageState;
import com.cinex.common.entity.tracker.IdTrackerService;
import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.common.service.SecurityService;
import com.cinex.module.combo.entity.Combo;
import com.cinex.module.combo.repository.ComboRepository;
import com.cinex.module.snack.dto.SnackOrderFilter;
import com.cinex.module.snack.dto.SnackOrderItemRequest;
import com.cinex.module.snack.dto.SnackOrderItemResponse;
import com.cinex.module.snack.dto.SnackOrderRequest;
import com.cinex.module.snack.dto.SnackOrderResponse;
import com.cinex.module.snack.entity.Snack;
import com.cinex.module.snack.entity.SnackOrder;
import com.cinex.module.snack.entity.SnackOrderItem;
import com.cinex.module.snack.repository.SnackOrderRepository;
import com.cinex.module.snack.repository.SnackRepository;
import com.cinex.module.snack.specification.SnackOrderSpecification;
import com.cinex.module.theater.entity.Theater;
import com.cinex.module.theater.repository.TheaterRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class SnackOrderService {

    private final SnackOrderRepository snackOrderRepository;
    private final SnackRepository snackRepository;
    private final ComboRepository comboRepository;
    private final TheaterRepository theaterRepository;
    private final IdTrackerService idTrackerService;
    private final SecurityService securityService;

    /**
     * Tạo đơn hàng POS tại quầy.
     *
     * <p>Business rule:
     * <ul>
     *   <li>Branch ADMIN: theaterId override từ JWT (bỏ qua field từ request).</li>
     *   <li>SUPER_ADMIN: bắt buộc gửi theaterId trong request.</li>
     *   <li>Mọi snack trong order phải cùng theater với order — chống bán snack rạp khác.</li>
     * </ul>
     */
    @Transactional
    public SnackOrderResponse createOrder(SnackOrderRequest request) {
        Long scopedTheaterId = securityService.getCurrentUserTheaterId();
        Long targetTheaterId = scopedTheaterId != null ? scopedTheaterId : request.getTheaterId();
        if (targetTheaterId == null) {
            // SUPER_ADMIN không scope theater + FE quên gửi theaterId → message
            // cụ thể giúp dev/admin debug nhanh hơn là VALIDATION_ERROR chung.
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Vui lòng chọn chi nhánh ở thanh trên cùng trước khi tạo đơn POS");
        }
        Theater theater = theaterRepository.findById(targetTheaterId)
                .orElseThrow(() -> new BusinessException(ErrorCode.THEATER_NOT_FOUND));

        // [IdTracker Pattern] Sinh mã đơn: VD "SNACK-20260527-001"
        // Entity type "SNACK_ORDER" match seed ở migration 009 (NOT "SNACK" —
        // typo này trước đây gây IllegalArgumentException ngay khi POS đồ ăn
        // tạo đơn đầu tiên).
        String orderCode = idTrackerService.nextCodeWithDate("SNACK_ORDER");

        SnackOrder order = SnackOrder.builder()
                .theater(theater)
                .orderCode(orderCode)
                .note(request.getNote())
                .totalAmount(BigDecimal.ZERO)
                .build();

        BigDecimal total = BigDecimal.ZERO;

        for (SnackOrderItemRequest itemReq : request.getItems()) {
            // Combo line — bán nguyên combo, hưởng giá combo (gồm discount của combo)
            if (itemReq.getComboId() != null) {
                Combo combo = comboRepository.findById(itemReq.getComboId())
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND,
                                "Combo không tồn tại"));
                if (combo.getStorageState() == StorageState.ARCHIVED || !combo.isActive()) {
                    throw new BusinessException(ErrorCode.INVALID_REQUEST,
                            "Combo " + combo.getName() + " không khả dụng");
                }
                if (!combo.getTheater().getId().equals(theater.getId())) {
                    throw new BusinessException(ErrorCode.INVALID_REQUEST,
                            "Combo '" + combo.getName() + "' không thuộc chi nhánh của đơn hàng");
                }
                // Effective availability check — combo có nguyên liệu hết hàng
                // thì không bán được dù admin chưa kịp tắt active. Tránh nhận
                // order rồi mới phát hiện thiếu snack.
                List<String> outOfStock = combo.getItems().stream()
                        .map(it -> it.getSnack())
                        .filter(s -> s.getStorageState() == StorageState.ARCHIVED || !s.isAvailable())
                        .map(s -> s.getName())
                        .distinct()
                        .toList();
                if (!outOfStock.isEmpty()) {
                    throw new BusinessException(ErrorCode.INVALID_REQUEST,
                            "Combo '" + combo.getName() + "' tạm hết — nguyên liệu thiếu: "
                                    + String.join(", ", outOfStock));
                }
                BigDecimal itemTotal = combo.getPrice().multiply(BigDecimal.valueOf(itemReq.getQuantity()));
                total = total.add(itemTotal);
                order.getItems().add(SnackOrderItem.builder()
                        .snackOrder(order)
                        .combo(combo)
                        .quantity(itemReq.getQuantity())
                        .price(combo.getPrice())
                        .build());
                continue;
            }

            // Snack line — đường cũ
            Snack snack = snackRepository.findById(itemReq.getSnackId())
                    .orElseThrow(() -> new BusinessException(ErrorCode.SNACK_NOT_FOUND));

            // Business rule: Chỉ bán snack đang available và chưa bị archive
            if (snack.getStorageState() == StorageState.ARCHIVED || !snack.isAvailable()) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST,
                        "Snack " + snack.getName() + " không khả dụng");
            }

            // Cross-theater guard: snack phải thuộc đúng theater của order
            if (!snack.getTheater().getId().equals(theater.getId())) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST,
                        "Snack '" + snack.getName() + "' không thuộc chi nhánh của đơn hàng");
            }

            // Lưu giá tại thời điểm đặt — giá snack có thể thay đổi sau này
            BigDecimal itemTotal = snack.getPrice().multiply(BigDecimal.valueOf(itemReq.getQuantity()));
            total = total.add(itemTotal);

            SnackOrderItem item = SnackOrderItem.builder()
                    .snackOrder(order)
                    .snack(snack)
                    .quantity(itemReq.getQuantity())
                    .price(snack.getPrice())
                    .build();
            order.getItems().add(item);
        }

        order.setTotalAmount(total);
        // [Cascade ALL] Lưu order → tự lưu cả items trong 1 transaction
        snackOrderRepository.save(order);

        log.info("POS order created: {} cho theater {} - total {}đ, {} items",
                orderCode, theater.getCode(), total, order.getItems().size());
        return toResponse(order);
    }

    /**
     * Danh sách đơn hàng cho admin — phân trang, sort createdAt DESC.
     * Giữ overload không filter để tương thích lùi.
     */
    @Transactional(readOnly = true)
    public Page<SnackOrderResponse> listOrders(Pageable pageable) {
        return listOrders(new SnackOrderFilter(), pageable);
    }

    /**
     * Danh sách đơn hàng có filter (staff/date/total/keyword/theater).
     *
     * <p>Auto-scope theaterId từ JWT cho branch ADMIN — override request param.
     *
     * <p>[Specification Pattern] Filter DTO → Specification → findAll(spec, pageable).
     */
    @Transactional(readOnly = true)
    public Page<SnackOrderResponse> listOrders(SnackOrderFilter filter, Pageable pageable) {
        Long scopedTheaterId = securityService.getCurrentUserTheaterId();
        if (scopedTheaterId != null) {
            filter.setTheaterId(scopedTheaterId);
        }
        var spec = SnackOrderSpecification.fromFilter(filter);
        return snackOrderRepository.findAll(spec, pageable)
                .map(this::toResponse);
    }

    // ===== Mapper nội bộ =====

    private SnackOrderResponse toResponse(SnackOrder order) {
        List<SnackOrderItemResponse> itemResponses = order.getItems().stream()
                .map(this::toItemResponse)
                .toList();

        Theater theater = order.getTheater();
        return SnackOrderResponse.builder()
                .id(order.getId())
                .theaterId(theater != null ? theater.getId() : null)
                .theaterName(theater != null ? theater.getName() : null)
                .theaterCity(theater != null ? theater.getCity() : null)
                .orderCode(order.getOrderCode())
                .totalAmount(order.getTotalAmount())
                .note(order.getNote())
                .items(itemResponses)
                .createdAt(order.getCreatedAt())
                .build();
    }

    private SnackOrderItemResponse toItemResponse(SnackOrderItem item) {
        BigDecimal subtotal = item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity()));
        SnackOrderItemResponse.SnackOrderItemResponseBuilder b = SnackOrderItemResponse.builder()
                .id(item.getId())
                .quantity(item.getQuantity())
                .price(item.getPrice())
                .subtotal(subtotal);
        if (item.getCombo() != null) {
            b.kind("COMBO")
                    .comboId(item.getCombo().getId())
                    .comboName(item.getCombo().getName())
                    .comboImageUrl(item.getCombo().getImageUrl());
        } else if (item.getSnack() != null) {
            b.kind("SNACK")
                    .snackId(item.getSnack().getId())
                    .snackName(item.getSnack().getName())
                    .snackImageUrl(item.getSnack().getImageUrl());
        }
        return b
                .build();
    }
}
