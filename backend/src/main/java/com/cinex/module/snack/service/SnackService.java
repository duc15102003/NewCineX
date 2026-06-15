package com.cinex.module.snack.service;

import com.cinex.common.entity.StorageState;
import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.common.service.FileUploadService;
import com.cinex.common.service.SecurityService;
import com.cinex.module.snack.dto.SnackFilter;
import com.cinex.module.snack.dto.SnackRequest;
import com.cinex.module.snack.dto.SnackResponse;
import com.cinex.module.snack.entity.Snack;
import com.cinex.module.snack.mapper.SnackMapper;
import com.cinex.module.snack.repository.SnackRepository;
import com.cinex.module.snack.specification.SnackSpecification;
import com.cinex.module.theater.entity.Theater;
import com.cinex.module.theater.repository.TheaterRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class SnackService {

    private final SnackRepository snackRepository;
    private final SnackMapper snackMapper;
    private final FileUploadService fileUploadService;
    private final SecurityService securityService;
    private final TheaterRepository theaterRepository;

    @Transactional(readOnly = true)
    public SnackResponse getSnack(Long id) {
        Snack snack = snackRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.SNACK_NOT_FOUND));
        securityService.requireAccessToTheater(snack.getTheater().getId());
        return snackMapper.toResponse(snack);
    }

    /**
     * Danh sách snack đang available và chưa bị xóa (dành cho user/public path).
     * Honor theaterId trong filter — snack thuộc chi nhánh, không nên trả cross-theater.
     */
    @Transactional(readOnly = true)
    public Page<SnackResponse> listSnacksPublic(SnackFilter filter, Pageable pageable) {
        return snackRepository.findAll(SnackSpecification.publicFilter(filter), pageable)
                .map(snackMapper::toResponse);
    }

    /** Backward-compat overload — không filter, trả tất cả snack public. */
    @Transactional(readOnly = true)
    public Page<SnackResponse> listSnacks(Pageable pageable) {
        return snackRepository.findAll(SnackSpecification.publicFilter(), pageable)
                .map(snackMapper::toResponse);
    }

    /**
     * Admin: danh sách snack với filter keyword + includeDeleted.
     * Auto-scope theaterId từ JWT cho branch ADMIN (override request body).
     */
    @Transactional(readOnly = true)
    public Page<SnackResponse> listSnacksAdmin(SnackFilter filter, Pageable pageable) {
        Long scopedTheaterId = securityService.getCurrentUserTheaterId();
        if (scopedTheaterId != null) {
            filter.setTheaterId(scopedTheaterId);
        }
        return snackRepository.findAll(SnackSpecification.fromFilter(filter), pageable)
                .map(snackMapper::toResponse);
    }

    @Transactional
    public SnackResponse createSnack(SnackRequest request) {
        // Branch ADMIN: override theaterId từ JWT, không cho tạo cho chi nhánh khác
        Long scopedTheaterId = securityService.getCurrentUserTheaterId();
        Long targetTheaterId = scopedTheaterId != null ? scopedTheaterId : request.getTheaterId();
        if (targetTheaterId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR);
        }
        Theater theater = theaterRepository.findById(targetTheaterId)
                .orElseThrow(() -> new BusinessException(ErrorCode.THEATER_NOT_FOUND));

        String normalized = request.getName().trim();
        if (normalized.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Tên đồ ăn không được rỗng (chỉ có khoảng trắng)");
        }
        if (snackRepository.existsByNameIgnoreCaseAndTheaterIdAndStorageState(
                normalized, theater.getId(), StorageState.ACTIVE)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Đồ ăn '" + normalized + "' đã tồn tại trong chi nhánh này");
        }

        Snack snack = Snack.builder()
                .theater(theater)
                .name(normalized)
                .description(request.getDescription())
                .price(request.getPrice())
                .imageUrl(request.getImageUrl())
                .category(request.getCategory())
                .available(request.getAvailable() != null ? request.getAvailable() : true)
                .build();

        snackRepository.save(snack);
        log.info("Created snack {} cho theater {}", snack.getName(), theater.getCode());
        return snackMapper.toResponse(snack);
    }

    @Transactional
    public SnackResponse updateSnack(Long id, SnackRequest request) {
        Snack snack = snackRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.SNACK_NOT_FOUND));
        securityService.requireAccessToTheater(snack.getTheater().getId());

        // Enforce theater immutable — fail-fast nếu admin cố đổi
        if (request.getTheaterId() != null
                && !snack.getTheater().getId().equals(request.getTheaterId())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Không thể đổi chi nhánh của đồ ăn — tạo mới ở chi nhánh khác nếu cần");
        }

        String normalized = request.getName().trim();
        if (normalized.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Tên đồ ăn không được rỗng (chỉ có khoảng trắng)");
        }
        if (snackRepository.existsByNameIgnoreCaseAndTheaterIdAndIdNotAndStorageState(
                normalized, snack.getTheater().getId(), id, StorageState.ACTIVE)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Đồ ăn '" + normalized + "' đã tồn tại trong chi nhánh này");
        }

        snack.setName(normalized);
        snack.setDescription(request.getDescription());
        snack.setPrice(request.getPrice());
        snack.setImageUrl(request.getImageUrl());
        snack.setCategory(request.getCategory());
        if (request.getAvailable() != null) {
            snack.setAvailable(request.getAvailable());
        }

        snackRepository.save(snack);
        log.info("Updated snack: {}", snack.getName());
        return snackMapper.toResponse(snack);
    }

    @Transactional
    public SnackResponse uploadImage(Long id, MultipartFile file) {
        Snack snack = snackRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.SNACK_NOT_FOUND));
        securityService.requireAccessToTheater(snack.getTheater().getId());

        if (snack.getImageUrl() != null) {
            fileUploadService.deleteImage(snack.getImageUrl());
        }

        String imageUrl = fileUploadService.uploadImage(file, "cinex/snacks");
        snack.setImageUrl(imageUrl);
        snackRepository.save(snack);
        log.info("Uploaded image for snack {}", snack.getName());
        return snackMapper.toResponse(snack);
    }

    @Transactional
    public void deleteSnack(Long id) {
        Snack snack = snackRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.SNACK_NOT_FOUND));
        securityService.requireAccessToTheater(snack.getTheater().getId());
        ensureNoActiveComboDependency(id, snack.getName());
        snack.setStorageState(StorageState.ARCHIVED);
        snackRepository.save(snack);
        log.info("Soft deleted snack: {}", snack.getName());
    }

    /**
     * Chặn xoá snack nếu vẫn còn Combo ACTIVE reference. Tránh combo bị mất
     * item sau khi snack archived → POS load combo gặp NPE / số tiền sai.
     * Industry chuẩn (CGV/Lotte F&B): item parent đang được combo dùng phải
     * remove khỏi combo trước hoặc archive combo.
     */
    private void ensureNoActiveComboDependency(Long snackId, String snackName) {
        long activeCombos = snackRepository.countActiveCombosUsingSnack(snackId);
        if (activeCombos > 0) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Đồ ăn '" + snackName + "' đang được " + activeCombos
                    + " combo sử dụng. Hãy gỡ khỏi combo hoặc archive combo trước.");
        }
    }

    @Transactional
    public SnackResponse restoreSnack(Long id) {
        Snack snack = snackRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.SNACK_NOT_FOUND));
        securityService.requireAccessToTheater(snack.getTheater().getId());
        snack.setStorageState(StorageState.ACTIVE);
        snackRepository.save(snack);
        log.info("Restored snack: {}", snack.getName());
        return snackMapper.toResponse(snack);
    }

    @Transactional
    public void bulkDelete(List<Long> ids) {
        List<Snack> items = snackRepository.findAllById(ids);
        // RBAC + fail-fast dependency check trước khi mutate gì
        items.forEach(i -> securityService.requireAccessToTheater(i.getTheater().getId()));
        items.forEach(i -> ensureNoActiveComboDependency(i.getId(), i.getName()));
        items.forEach(i -> i.setStorageState(StorageState.ARCHIVED));
        snackRepository.saveAll(items);
        log.info("Bulk soft deleted {} items", items.size());
    }

    @Transactional
    public void bulkRestore(List<Long> ids) {
        List<Snack> items = snackRepository.findAllById(ids);
        items.forEach(i -> securityService.requireAccessToTheater(i.getTheater().getId()));
        items.forEach(i -> i.setStorageState(StorageState.ACTIVE));
        snackRepository.saveAll(items);
        log.info("Bulk restored {} items", items.size());
    }
}
