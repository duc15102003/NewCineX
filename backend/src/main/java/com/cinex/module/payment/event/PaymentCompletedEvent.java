package com.cinex.module.payment.event;

import com.cinex.module.payment.entity.Payment;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

/**
 * [Observer Pattern] Event phát ra khi thanh toán thành công.
 * PaymentService publish event → PaymentEventListener lắng nghe → xử lý (gửi email, log, ...)
 *
 * Tại sao dùng Event thay vì gọi trực tiếp?
 * - Gọi trực tiếp: PaymentService phải biết EmailService → tight coupling
 * - Event: PaymentService chỉ publish, KHÔNG biết ai lắng nghe → loose coupling
 * - Thêm hành động mới (gửi SMS, push notification) → chỉ thêm listener, KHÔNG sửa PaymentService
 */
@Getter
public class PaymentCompletedEvent extends ApplicationEvent {

    private final Payment payment;

    public PaymentCompletedEvent(Object source, Payment payment) {
        super(source);
        this.payment = payment;
    }
}
