package com.cinex.module.snack.service;

import com.cinex.common.entity.StorageState;
import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.common.service.FileUploadService;
import com.cinex.module.snack.dto.SnackFilter;
import com.cinex.module.snack.dto.SnackRequest;
import com.cinex.module.snack.dto.SnackResponse;
import com.cinex.module.snack.entity.Snack;
import com.cinex.module.snack.mapper.SnackMapper;
import com.cinex.module.snack.repository.SnackRepository;
import com.cinex.module.snack.specification.SnackSpecification;
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

    @Transactional(readOnly = true)
    public SnackResponse getSnack(Long id) {
        Snack snack = snackRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.SNACK_NOT_FOUND));
        return snackMapper.toResponse(snack);
    }

    /**
     * Danh sách snack đang available và chưa bị xóa (dành cho user).
     * [Specification Pattern] Dùng SnackSpecification.publicFilter() thay vì inline lambda.
     */
    @Transactional(readOnly = true)
    public Page<SnackResponse> listSnacks(Pageable pageable) {
        return snackRepository.findAll(SnackSpecification.publicFilter(), pageable)
                .map(snackMapper::toResponse);
    }

    /**
     * Admin: danh sách snack với filter keyword + includeDeleted.
     * [Specification Pattern] Delegate sang SnackSpecification.fromFilter().
     */
    @Transactional(readOnly = true)
    public Page<SnackResponse> listSnacksAdmin(SnackFilter filter, Pageable pageable) {
        return snackRepository.findAll(SnackSpecification.fromFilter(filter), pageable)
                .map(snackMapper::toResponse);
    }

    @Transactional
    public SnackResponse createSnack(SnackRequest request) {
        Snack snack = Snack.builder()
                .name(request.getName())
                .description(request.getDescription())
                .price(request.getPrice())
                .imageUrl(request.getImageUrl())
                .category(request.getCategory())
                .available(request.getAvailable() != null ? request.getAvailable() : true)
                .build();

        snackRepository.save(snack);
        log.info("Created snack: {}", snack.getName());
        return snackMapper.toResponse(snack);
    }

    @Transactional
    public SnackResponse updateSnack(Long id, SnackRequest request) {
        Snack snack = snackRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.SNACK_NOT_FOUND));

        snack.setName(request.getName());
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
        String imageUrl = fileUploadService.uploadImage(file, "cinex/snacks");
        snack.setImageUrl(imageUrl);
        snackRepository.save(snack);
        log.info("Uploaded image for snack {}", snack.getName());
        return snackMapper.toResponse(snack);
    }

    public void deleteSnack(Long id) {
        Snack snack = snackRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.SNACK_NOT_FOUND));
        snack.setStorageState(StorageState.ARCHIVED);
        snackRepository.save(snack);
        log.info("Soft deleted snack: {}", snack.getName());
    }

    @Transactional
    public SnackResponse restoreSnack(Long id) {
        Snack snack = snackRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.SNACK_NOT_FOUND));
        snack.setStorageState(StorageState.ACTIVE);
        snackRepository.save(snack);
        log.info("Restored snack: {}", snack.getName());
        return snackMapper.toResponse(snack);
    }

    @Transactional
    public void bulkDelete(List<Long> ids) {
        List<Snack> items = snackRepository.findAllById(ids);
        items.forEach(i -> i.setStorageState(StorageState.ARCHIVED));
        snackRepository.saveAll(items);
        log.info("Bulk soft deleted {} items", items.size());
    }

    @Transactional
    public void bulkRestore(List<Long> ids) {
        List<Snack> items = snackRepository.findAllById(ids);
        items.forEach(i -> i.setStorageState(StorageState.ACTIVE));
        snackRepository.saveAll(items);
        log.info("Bulk restored {} items", items.size());
    }
}
