package com.cinex.common.audit.aspect;

import com.cinex.common.audit.Auditable;
import com.cinex.common.audit.service.AuditLogV2Service;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * [AOP — Around Advice] Tự động ghi audit log cho method gắn {@link Auditable}.
 *
 * <p>Luồng:
 * <ol>
 *   <li>Method chạy bình thường (proceed()).</li>
 *   <li>Nếu thành công (không throw) → đọc annotation, trích entityId, gọi
 *       {@link AuditLogV2Service#log}.</li>
 *   <li>Nếu method throw → KHÔNG ghi audit, exception propagate lên.</li>
 * </ol>
 *
 * <p>Cách trích entityId (theo thứ tự ưu tiên):
 * <ol>
 *   <li>Param đầu tiên là {@code Long} (vd: {@code updateRole(Long userId, ...)}).</li>
 *   <li>Return value có method {@code getId()} → entity hoặc DTO có id.</li>
 * </ol>
 *
 * <p>Cách build detail JSON: serialize tất cả args bằng Jackson, bỏ args nhạy cảm
 * (request DTO có {@code password}).
 */
@Aspect
@Component
@RequiredArgsConstructor
@Slf4j
public class AuditableAspect {

    private final AuditLogV2Service auditLogService;

    /**
     * Jackson không serialize null + bỏ password field.
     * NOTE: dùng JsonInclude NON_NULL chỉ ảnh hưởng cấu hình mặc định ở đây;
     * password bị filter ở bước build map (xem maskSensitive).
     */
    private final ObjectMapper objectMapper = new ObjectMapper()
            .setSerializationInclusion(JsonInclude.Include.NON_NULL);

    @Around("@annotation(com.cinex.common.audit.Auditable)")
    public Object aroundAuditable(ProceedingJoinPoint pjp) throws Throwable {
        Object result = pjp.proceed();

        try {
            MethodSignature signature = (MethodSignature) pjp.getSignature();
            Method method = signature.getMethod();
            Auditable annotation = method.getAnnotation(Auditable.class);
            if (annotation == null) {
                return result;
            }

            Object[] args = pjp.getArgs();
            String[] paramNames = signature.getParameterNames();

            Long entityId = extractEntityId(args, paramNames, result);
            String detail = buildDetailJson(method, args, paramNames);

            auditLogService.log(annotation.action(), annotation.entityType(), entityId, detail);
        } catch (Exception ex) {
            // Audit fail không bao giờ được làm hỏng kết quả method gốc
            log.error("Auditable aspect failed (ignored): {}", ex.getMessage(), ex);
        }
        return result;
    }

    /**
     * Trích entityId từ args/return:
     * - Ưu tiên param Long đầu tiên có tên kết thúc "Id" hoặc "id".
     * - Fallback: bất kỳ param nào kiểu Long.
     * - Fallback: return value có method getId().
     */
    private Long extractEntityId(Object[] args, String[] paramNames, Object result) {
        if (args != null && paramNames != null) {
            // Pass 1: ưu tiên Long có tên "...Id"
            for (int i = 0; i < args.length; i++) {
                Object arg = args[i];
                String name = paramNames[i];
                if (arg instanceof Long longArg
                        && name != null
                        && (name.endsWith("Id") || name.endsWith("id"))) {
                    return longArg;
                }
            }
            // Pass 2: Long đầu tiên
            for (Object arg : args) {
                if (arg instanceof Long longArg) {
                    return longArg;
                }
            }
        }
        // Fallback: return value có getId()
        if (result != null) {
            try {
                Method getId = result.getClass().getMethod("getId");
                Object idValue = getId.invoke(result);
                if (idValue instanceof Long l) {
                    return l;
                } else if (idValue instanceof Number n) {
                    return n.longValue();
                }
            } catch (NoSuchMethodException ignored) {
                // result không có getId() → ok
            } catch (Exception ignored) {
                // không lấy được id → ok, trả null
            }
        }
        return null;
    }

    /**
     * Build detail JSON từ args: { paramName: value, ... }
     * Bỏ qua: HttpServletRequest, MultipartFile, password fields.
     * Truncate output ở caller (AuditLogV2Service).
     */
    private String buildDetailJson(Method method, Object[] args, String[] paramNames) {
        if (args == null || args.length == 0 || paramNames == null) {
            return null;
        }
        Map<String, Object> detailMap = new LinkedHashMap<>();
        for (int i = 0; i < args.length; i++) {
            Object arg = args[i];
            String name = paramNames[i];
            if (arg == null) continue;
            if (isSkippableType(arg)) continue;
            detailMap.put(name, maskSensitive(arg));
        }
        if (detailMap.isEmpty()) return null;
        try {
            return objectMapper.writeValueAsString(detailMap);
        } catch (Exception ex) {
            log.warn("Cannot serialize audit detail for {}: {}", method.getName(), ex.getMessage());
            return null;
        }
    }

    private boolean isSkippableType(Object arg) {
        String className = arg.getClass().getName();
        return className.startsWith("jakarta.servlet")
                || className.startsWith("org.springframework.web.multipart");
    }

    /**
     * Mask password trong DTO: nếu object có field tên chứa "password" hoặc "secret"
     * → tạo bản copy thay bằng "***".
     */
    private Object maskSensitive(Object arg) {
        if (arg == null) return null;
        // Primitive/wrapper/String → giữ nguyên
        if (arg instanceof String || arg instanceof Number || arg instanceof Boolean) {
            return arg;
        }
        try {
            Map<String, Object> objAsMap = objectMapper.convertValue(arg, Map.class);
            Map<String, Object> masked = new LinkedHashMap<>();
            for (Map.Entry<String, Object> entry : objAsMap.entrySet()) {
                String key = entry.getKey().toLowerCase();
                if (key.contains("password") || key.contains("secret") || key.contains("token")) {
                    masked.put(entry.getKey(), "***");
                } else {
                    masked.put(entry.getKey(), entry.getValue());
                }
            }
            return masked;
        } catch (Exception ex) {
            // Không convert được → trả toString fallback
            return arg.toString();
        }
    }
}
