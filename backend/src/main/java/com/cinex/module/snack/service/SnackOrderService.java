package com.cinex.module.snack.service;

import com.cinex.common.entity.tracker.IdTrackerService;
import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.common.response.PageResponse;
import com.cinex.module.snack.dto.SnackOrderItemRequest;
import com.cinex.module.snack.dto.SnackOrderItemResponse;
import com.cinex.module.snack.dto.SnackOrderRequest;
import com.cinex.module.snack.dto.SnackOrderResponse;
import com.cinex.module.snack.entity.Snack;
import com.cinex.module.snack.entity.SnackOrder;
import com.cinex.module.snack.entity.SnackOrderItem;
import com.cinex.module.snack.repository.SnackOrderRepository;
import com.cinex.module.snack.repository.SnackRepository;
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
    private final IdTrackerService idTrackerService;

    /**
     * Tạo đơn hàng POS tại quầy.
     * Business rule: Thu ngân chọn món → hệ thống tính tổng → lưu đơn.
     */
    @Transactional
    public SnackOrderResponse createOrder(SnackOrderRequest request) {
        // [IdTracker Pattern] Sinh mã đơn: VD "SNACK-20260527-001"
        String orderCode = idTrackerService.nextCodeWithDate("SNACK");

        SnackOrder order = SnackOrder.builder()
                .orderCode(orderCode)
                .note(request.getNote())
                .totalAmount(BigDecimal.ZERO)
                .build();

        BigDecimal total = BigDecimal.ZERO;

        for (SnackOrderItemRequest itemReq : request.getItems()) {
            Snack snack = snackRepository.findById(itemReq.getSnackId())
                    .orElseThrow(() -> new BusinessException(ErrorCode.SNACK_NOT_FOUND));

            // Lưu giá tại thời điểm đặt — quan trọng: giá snack có thể thay đổi sau này
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

        log.info("POS order created: {} - total {}đ, {} items", orderCode, total, order.getItems().size());
        return toResponse(order);
    }

    /**
     * Danh sách đơn hàng cho admin — phân trang, sort createdAt DESC.
     */
    @Transactional(readOnly = true)
    public Page<SnackOrderResponse> listOrders(Pageable pageable) {
        return snackOrderRepository.findAll(pageable)
                .map(this::toResponse);
    }

    // ===== Mapper nội bộ =====

    private SnackOrderResponse toResponse(SnackOrder order) {
        List<SnackOrderItemResponse> itemResponses = order.getItems().stream()
                .map(this::toItemResponse)
                .toList();

        return SnackOrderResponse.builder()
                .id(order.getId())
                .orderCode(order.getOrderCode())
                .totalAmount(order.getTotalAmount())
                .note(order.getNote())
                .items(itemResponses)
                .createdAt(order.getCreatedAt())
                .build();
    }

    private SnackOrderItemResponse toItemResponse(SnackOrderItem item) {
        BigDecimal subtotal = item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity()));
        return SnackOrderItemResponse.builder()
                .id(item.getId())
                .snackId(item.getSnack().getId())
                .snackName(item.getSnack().getName())
                .snackImageUrl(item.getSnack().getImageUrl())
                .quantity(item.getQuantity())
                .price(item.getPrice())
                .subtotal(subtotal)
                .build();
    }
}
