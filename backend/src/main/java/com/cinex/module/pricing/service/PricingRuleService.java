package com.cinex.module.pricing.service;

import com.cinex.common.audit.Auditable;
import com.cinex.common.entity.StorageState;
import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.common.service.SecurityService;
import com.cinex.module.pricing.dto.PricingRuleRequest;
import com.cinex.module.pricing.dto.PricingRuleResponse;
import com.cinex.module.pricing.entity.PricingRule;
import com.cinex.module.pricing.mapper.PricingRuleMapper;
import com.cinex.module.pricing.repository.PricingRuleRepository;
import com.cinex.module.theater.entity.Theater;
import com.cinex.module.theater.repository.TheaterRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Service CRUD pricing rule cho admin.
 *
 * <p><b>Multi-tenant scope:</b>
 * <ul>
 *   <li>SUPER_ADMIN: tạo cả global rule lẫn theater-specific override</li>
 *   <li>Branch ADMIN: chỉ tạo/sửa rule cho rạp mình (theater-specific override)</li>
 * </ul>
 *
 * <p><b>Chú ý:</b> mỗi mutation gọi {@link PricingEngine#refresh()} để engine load lại
 * cache — tránh giá vé booking mới vẫn dùng rule cũ.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PricingRuleService {

    private final PricingRuleRepository pricingRuleRepository;
    private final PricingRuleMapper pricingRuleMapper;
    private final PricingEngine pricingEngine;
    private final SecurityService securityService;
    private final TheaterRepository theaterRepository;

    @Transactional(readOnly = true)
    public Page<PricingRuleResponse> list(Pageable pageable) {
        return list(null, pageable);
    }

    /**
     * List với theater scope.
     * <p>Auto-scope branch ADMIN: chỉ xem rule của rạp mình + rule global.
     * SUPER_ADMIN không bị scope (có thể filter theo theaterId thủ công).
     */
    @Transactional(readOnly = true)
    public Page<PricingRuleResponse> list(Long theaterId, Pageable pageable) {
        Long scopedTheaterId = securityService.getCurrentUserTheaterId();
        Long effectiveId = scopedTheaterId != null ? scopedTheaterId : theaterId;

        if (effectiveId != null) {
            Long target = effectiveId;
            Specification<PricingRule> spec = (root, query, cb) -> cb.or(
                    cb.isNull(root.get("theater")),
                    cb.equal(root.get("theater").get("id"), target)
            );
            return pricingRuleRepository.findAll(spec, pageable).map(pricingRuleMapper::toResponse);
        }
        return pricingRuleRepository.findAll(pageable).map(pricingRuleMapper::toResponse);
    }

    @Transactional(readOnly = true)
    public PricingRuleResponse get(Long id) {
        PricingRule rule = findOrThrow(id);
        requireScopeAccess(rule);
        return pricingRuleMapper.toResponse(rule);
    }

    @Transactional
    @Auditable(action = "CREATE_PRICING_RULE", entityType = "PricingRule")
    public PricingRuleResponse create(PricingRuleRequest request) {
        validateRuleTypeFields(request);

        // Scope theater: branch ADMIN bị override từ JWT
        Long scopedTheaterId = securityService.getCurrentUserTheaterId();
        Long targetTheaterId = scopedTheaterId != null ? scopedTheaterId : request.getTheaterId();
        Theater theater = null;
        if (targetTheaterId != null) {
            theater = theaterRepository.findById(targetTheaterId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.THEATER_NOT_FOUND));
        }

        // Uniqueness check trong scope (global vs theater-specific)
        boolean exists = (targetTheaterId == null)
                ? pricingRuleRepository.existsByCodeAndTheaterIsNull(request.getCode())
                : pricingRuleRepository.existsByCodeAndTheaterId(request.getCode(), targetTheaterId);
        if (exists) {
            String scopeLabel = targetTheaterId == null ? "toàn hệ thống" : "chi nhánh này";
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Mã rule '" + request.getCode() + "' đã tồn tại trong " + scopeLabel);
        }

        PricingRule rule = PricingRule.builder()
                .theater(theater)
                .code(request.getCode())
                .name(request.getName())
                .description(request.getDescription())
                .ruleType(request.getRuleType())
                .multiplierPercent(request.getMultiplierPercent())
                .dayOfWeek(request.getDayOfWeek())
                .hourStart(request.getHourStart())
                .hourEnd(request.getHourEnd())
                .dateStart(request.getDateStart())
                .dateEnd(request.getDateEnd())
                .active(request.isActive())
                .priority(request.getPriority())
                .build();
        pricingRuleRepository.save(rule);
        pricingEngine.refresh();
        log.info("Created pricing rule '{}' ({})", rule.getCode(),
                theater == null ? "GLOBAL" : "theater=" + theater.getCode());
        return pricingRuleMapper.toResponse(rule);
    }

    @Transactional
    @Auditable(action = "UPDATE_PRICING_RULE", entityType = "PricingRule")
    public PricingRuleResponse update(Long id, PricingRuleRequest request) {
        PricingRule rule = findOrThrow(id);
        requireScopeAccess(rule);

        if (!rule.getCode().equals(request.getCode())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Không thể đổi mã rule — vui lòng tạo rule mới");
        }
        validateRuleTypeFields(request);

        // KHÔNG cho đổi theater scope — tạo rule mới nếu cần
        rule.setName(request.getName());
        rule.setDescription(request.getDescription());
        rule.setRuleType(request.getRuleType());
        rule.setMultiplierPercent(request.getMultiplierPercent());
        rule.setDayOfWeek(request.getDayOfWeek());
        rule.setHourStart(request.getHourStart());
        rule.setHourEnd(request.getHourEnd());
        rule.setDateStart(request.getDateStart());
        rule.setDateEnd(request.getDateEnd());
        rule.setActive(request.isActive());
        rule.setPriority(request.getPriority());
        pricingRuleRepository.save(rule);
        pricingEngine.refresh();
        log.info("Updated pricing rule '{}'", rule.getCode());
        return pricingRuleMapper.toResponse(rule);
    }

    @Transactional
    @Auditable(action = "ARCHIVE_PRICING_RULE", entityType = "PricingRule")
    public void archive(Long id) {
        PricingRule rule = findOrThrow(id);
        requireScopeAccess(rule);
        rule.setStorageState(StorageState.ARCHIVED);
        pricingRuleRepository.save(rule);
        pricingEngine.refresh();
        log.info("Archived pricing rule '{}'", rule.getCode());
    }

    @Transactional
    public void bulkArchive(List<Long> ids) {
        List<PricingRule> items = pricingRuleRepository.findAllById(ids);
        items.forEach(this::requireScopeAccess);
        items.forEach(r -> r.setStorageState(StorageState.ARCHIVED));
        pricingRuleRepository.saveAll(items);
        pricingEngine.refresh();
        log.info("Bulk archived {} pricing rules", items.size());
    }

    @Transactional
    public void bulkRestore(List<Long> ids) {
        List<PricingRule> items = pricingRuleRepository.findAllById(ids);
        items.forEach(this::requireScopeAccess);
        items.forEach(r -> r.setStorageState(StorageState.ACTIVE));
        pricingRuleRepository.saveAll(items);
        pricingEngine.refresh();
        log.info("Bulk restored {} pricing rules", items.size());
    }

    /** Branch ADMIN chỉ thao tác được rule của rạp mình. SUPER_ADMIN pass tất cả. */
    private void requireScopeAccess(PricingRule rule) {
        Long scopedTheaterId = securityService.getCurrentUserTheaterId();
        if (scopedTheaterId == null) return;
        if (rule.getTheater() == null
                || !rule.getTheater().getId().equals(scopedTheaterId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN,
                    "Bạn chỉ được thao tác rule của chi nhánh mình");
        }
    }

    /**
     * Validate field set theo rule_type — fail-fast nếu admin nhập thiếu/dư.
     */
    private void validateRuleTypeFields(PricingRuleRequest request) {
        switch (request.getRuleType()) {
            case DAY_OF_WEEK:
                if (request.getDayOfWeek() == null || request.getDayOfWeek().isBlank()) {
                    throw new BusinessException(ErrorCode.INVALID_REQUEST,
                            "DAY_OF_WEEK rule phải có trường day_of_week (CSV thứ)");
                }
                break;
            case HOUR_RANGE:
                if (request.getHourStart() == null || request.getHourEnd() == null) {
                    throw new BusinessException(ErrorCode.INVALID_REQUEST,
                            "HOUR_RANGE rule phải có hour_start và hour_end");
                }
                if (request.getHourStart() >= request.getHourEnd()) {
                    throw new BusinessException(ErrorCode.INVALID_REQUEST,
                            "hour_start phải < hour_end");
                }
                break;
            case DATE_RANGE:
                if (request.getDateStart() == null || request.getDateEnd() == null) {
                    throw new BusinessException(ErrorCode.INVALID_REQUEST,
                            "DATE_RANGE rule phải có date_start và date_end");
                }
                if (request.getDateStart().isAfter(request.getDateEnd())) {
                    throw new BusinessException(ErrorCode.INVALID_REQUEST,
                            "date_start phải ≤ date_end");
                }
                break;
            case COMPOSITE:
                boolean hasAny = (request.getDayOfWeek() != null && !request.getDayOfWeek().isBlank())
                        || (request.getHourStart() != null && request.getHourEnd() != null)
                        || (request.getDateStart() != null && request.getDateEnd() != null);
                if (!hasAny) {
                    throw new BusinessException(ErrorCode.INVALID_REQUEST,
                            "COMPOSITE rule phải có ít nhất 1 trong: day_of_week / hour_range / date_range");
                }
                break;
        }
    }

    private PricingRule findOrThrow(Long id) {
        return pricingRuleRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Không tìm thấy pricing rule"));
    }
}
