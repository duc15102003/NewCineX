package com.cinex.module.combo.service;

import com.cinex.common.audit.Auditable;
import com.cinex.common.entity.StorageState;
import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.common.service.FileUploadService;
import com.cinex.common.service.SecurityService;
import com.cinex.module.combo.dto.ComboItemRequest;
import com.cinex.module.combo.dto.ComboItemResponse;
import com.cinex.module.combo.dto.ComboRequest;
import com.cinex.module.combo.dto.ComboResponse;
import com.cinex.module.combo.entity.Combo;
import com.cinex.module.combo.entity.ComboItem;
import com.cinex.module.combo.repository.ComboRepository;
import com.cinex.module.snack.entity.Snack;
import com.cinex.module.snack.repository.SnackRepository;
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
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Service quản lý combo (snack bundle).
 *
 * <p>Mỗi combo gồm nhiều snacks với quantity tương ứng. Giá combo là cố định (admin set),
 * không tính lại từ snack price. FE hiển thị "tiết kiệm X" = SUM(snack.price × qty) - combo.price.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ComboService {

    private final ComboRepository comboRepository;
    private final SnackRepository snackRepository;
    private final TheaterRepository theaterRepository;
    private final SecurityService securityService;
    private final FileUploadService fileUploadService;

    @Transactional(readOnly = true)
    public Page<ComboResponse> list(Pageable pageable) {
        return list(null, pageable);
    }

    /**
     * Admin list với theaterId optional.
     *
     * <p>Auto-scope theaterId từ JWT cho branch ADMIN — override request param để
     * branch ADMIN không thể vô tình xem combo của chi nhánh khác.
     */
    @Transactional(readOnly = true)
    public Page<ComboResponse> list(Long theaterId, Pageable pageable) {
        Long scopedTheaterId = securityService.getCurrentUserTheaterId();
        Long effectiveTheaterId = scopedTheaterId != null ? scopedTheaterId : theaterId;
        Page<Combo> page = effectiveTheaterId != null
                ? comboRepository.findByTheaterId(effectiveTheaterId, pageable)
                : comboRepository.findAll(pageable);
        return page.map(this::toResponse);
    }

    /**
     * List public active — user xem ở POS / booking add-on. Yêu cầu theaterId.
     *
     * <p>Filter 2 tầng: active+!ARCHIVED ở DB (index), rồi loại combo có
     * ingredient hết ở app layer (computed). Không filter ingredient ở DB vì
     * cần check nested entity — N+1 nếu join, app-level đủ vì list combo nhỏ.
     */
    @Transactional(readOnly = true)
    public List<ComboResponse> listActiveByTheater(Long theaterId) {
        return comboRepository
                .findByActiveTrueAndStorageStateNotAndTheaterIdOrderByPriceAsc(StorageState.ARCHIVED, theaterId)
                .stream().map(this::toResponse)
                .filter(ComboResponse::isEffectiveAvailable)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ComboResponse> listActive() {
        return comboRepository.findByActiveTrueAndStorageStateNotOrderByPriceAsc(StorageState.ARCHIVED)
                .stream().map(this::toResponse)
                .filter(ComboResponse::isEffectiveAvailable)
                .toList();
    }

    @Transactional(readOnly = true)
    public ComboResponse get(Long id) {
        Combo combo = findOrThrow(id);
        securityService.requireAccessToTheater(combo.getTheater().getId());
        return toResponse(combo);
    }

    @Transactional
    @Auditable(action = "CREATE_COMBO", entityType = "Combo")
    public ComboResponse create(ComboRequest request) {
        // Branch ADMIN: override theaterId từ JWT (không cho tạo cho chi nhánh khác)
        Long scopedTheaterId = securityService.getCurrentUserTheaterId();
        Long targetTheaterId = scopedTheaterId != null ? scopedTheaterId : request.getTheaterId();
        if (targetTheaterId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR);
        }
        Theater theater = theaterRepository.findById(targetTheaterId)
                .orElseThrow(() -> new BusinessException(ErrorCode.THEATER_NOT_FOUND));

        if (comboRepository.existsByTheaterIdAndCode(theater.getId(), request.getCode())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Mã combo '" + request.getCode() + "' đã tồn tại trong chi nhánh này");
        }
        String normalizedName = request.getName().trim();
        if (normalizedName.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Tên combo không được rỗng (chỉ có khoảng trắng)");
        }
        if (comboRepository.existsByNameIgnoreCaseAndTheaterIdAndStorageState(
                normalizedName, theater.getId(), StorageState.ACTIVE)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Combo tên '" + normalizedName + "' đã tồn tại trong chi nhánh này");
        }
        Map<Long, Snack> snackMap = loadSnacks(request.getItems(), theater.getId());

        Combo combo = Combo.builder()
                .theater(theater)
                .code(request.getCode())
                .name(normalizedName)
                .description(request.getDescription())
                .imageUrl(request.getImageUrl())
                .price(request.getPrice())
                .active(request.isActive())
                .build();

        for (ComboItemRequest itemReq : request.getItems()) {
            ComboItem item = ComboItem.builder()
                    .combo(combo)
                    .snack(snackMap.get(itemReq.getSnackId()))
                    .quantity(itemReq.getQuantity())
                    .build();
            combo.getItems().add(item);
        }

        comboRepository.save(combo);
        log.info("Created combo '{}' with {} items", combo.getCode(), combo.getItems().size());
        return toResponse(combo);
    }

    @Transactional
    @Auditable(action = "UPDATE_COMBO", entityType = "Combo")
    public ComboResponse update(Long id, ComboRequest request) {
        Combo combo = findOrThrow(id);
        securityService.requireAccessToTheater(combo.getTheater().getId());
        if (!combo.getCode().equals(request.getCode())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Không thể đổi mã combo — vui lòng tạo combo mới");
        }
        // Theater immutable — fail-fast nếu admin cố đổi (FE đã lock, BE defense)
        if (request.getTheaterId() != null
                && !combo.getTheater().getId().equals(request.getTheaterId())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Không thể đổi chi nhánh của combo — tạo combo mới ở chi nhánh khác nếu cần");
        }

        String normalizedName = request.getName().trim();
        if (normalizedName.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Tên combo không được rỗng (chỉ có khoảng trắng)");
        }
        if (comboRepository.existsByNameIgnoreCaseAndTheaterIdAndIdNotAndStorageState(
                normalizedName, combo.getTheater().getId(), id, StorageState.ACTIVE)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Combo tên '" + normalizedName + "' đã tồn tại trong chi nhánh này");
        }
        Map<Long, Snack> snackMap = loadSnacks(request.getItems(), combo.getTheater().getId());

        combo.setName(normalizedName);
        combo.setDescription(request.getDescription());
        combo.setImageUrl(request.getImageUrl());
        combo.setPrice(request.getPrice());
        combo.setActive(request.isActive());

        // Replace items: clear cũ + add mới. orphanRemoval=true → JPA tự xoá items cũ.
        combo.getItems().clear();
        for (ComboItemRequest itemReq : request.getItems()) {
            ComboItem item = ComboItem.builder()
                    .combo(combo)
                    .snack(snackMap.get(itemReq.getSnackId()))
                    .quantity(itemReq.getQuantity())
                    .build();
            combo.getItems().add(item);
        }

        comboRepository.save(combo);
        log.info("Updated combo '{}'", combo.getCode());
        return toResponse(combo);
    }

    /** Upload ảnh combo — pattern y hệt snack: xóa ảnh cũ trên Cloudinary nếu có, upload mới. */
    @Transactional
    public ComboResponse uploadImage(Long id, org.springframework.web.multipart.MultipartFile file) {
        Combo combo = findOrThrow(id);
        securityService.requireAccessToTheater(combo.getTheater().getId());

        if (combo.getImageUrl() != null) {
            fileUploadService.deleteImage(combo.getImageUrl());
        }
        String imageUrl = fileUploadService.uploadImage(file, "cinex/combos");
        combo.setImageUrl(imageUrl);
        comboRepository.save(combo);
        log.info("Uploaded image for combo '{}'", combo.getCode());
        return toResponse(combo);
    }

    @Transactional
    @Auditable(action = "ARCHIVE_COMBO", entityType = "Combo")
    public void archive(Long id) {
        Combo combo = findOrThrow(id);
        securityService.requireAccessToTheater(combo.getTheater().getId());
        combo.setStorageState(StorageState.ARCHIVED);
        comboRepository.save(combo);
        log.info("Archived combo '{}'", combo.getCode());
    }

    @Transactional
    public void bulkArchive(List<Long> ids) {
        List<Combo> combos = comboRepository.findAllById(ids);
        // RBAC: branch ADMIN chỉ archive combo thuộc chi nhánh mình
        combos.forEach(c -> securityService.requireAccessToTheater(c.getTheater().getId()));
        combos.forEach(c -> c.setStorageState(StorageState.ARCHIVED));
        comboRepository.saveAll(combos);
        log.info("Bulk archived {} combos", combos.size());
    }

    @Transactional
    public void bulkRestore(List<Long> ids) {
        List<Combo> combos = comboRepository.findAllById(ids);
        combos.forEach(c -> securityService.requireAccessToTheater(c.getTheater().getId()));
        combos.forEach(c -> c.setStorageState(StorageState.ACTIVE));
        comboRepository.saveAll(combos);
        log.info("Bulk restored {} combos", combos.size());
    }

    // ────────── Helpers ──────────

    /**
     * Load all snacks trong 1 query, validate exists + thuộc đúng theater của combo.
     * Combo chỉ chứa snack của cùng chi nhánh — tránh combo HN bán snack HCM.
     */
    private Map<Long, Snack> loadSnacks(List<ComboItemRequest> items, Long expectedTheaterId) {
        List<Long> snackIds = items.stream().map(ComboItemRequest::getSnackId).distinct().toList();
        List<Snack> snacks = snackRepository.findAllById(snackIds);
        if (snacks.size() != snackIds.size()) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Một hoặc nhiều snack không tồn tại");
        }
        for (Snack s : snacks) {
            if (!s.getTheater().getId().equals(expectedTheaterId)) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST,
                        "Snack '" + s.getName() + "' không thuộc chi nhánh của combo");
            }
            // Industry chuẩn (CGV/Lotte): combo không thể bundle snack archived
            // hoặc unavailable — POS load combo sẽ gặp lỗi item missing.
            if (s.getStorageState() == StorageState.ARCHIVED) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST,
                        "Snack '" + s.getName() + "' đã archived — không thể đưa vào combo");
            }
            if (!s.isAvailable()) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST,
                        "Snack '" + s.getName() + "' đang hết hàng (unavailable) — không thể đưa vào combo");
            }
        }
        return snacks.stream().collect(Collectors.toMap(Snack::getId, s -> s));
    }

    private Combo findOrThrow(Long id) {
        return comboRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Không tìm thấy combo"));
    }

    private ComboResponse toResponse(Combo combo) {
        List<ComboItemResponse> itemResponses = combo.getItems().stream()
                .map(i -> ComboItemResponse.builder()
                        .id(i.getId())
                        .snackId(i.getSnack().getId())
                        .snackName(i.getSnack().getName())
                        .snackImageUrl(i.getSnack().getImageUrl())
                        .snackPrice(i.getSnack().getPrice())
                        .quantity(i.getQuantity())
                        .build())
                .toList();

        // Regular price = SUM(snack.price × qty) — giá nếu mua từng snack riêng
        BigDecimal regularPrice = combo.getItems().stream()
                .map(i -> i.getSnack().getPrice().multiply(BigDecimal.valueOf(i.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Savings = regularPrice - combo.price. Ẩn nếu combo không có lợi (≤ 0).
        BigDecimal savings = regularPrice.subtract(combo.getPrice());
        BigDecimal savingsAmount = savings.compareTo(BigDecimal.ZERO) > 0 ? savings : null;
        Integer savingsPercent = null;
        if (savingsAmount != null && regularPrice.compareTo(BigDecimal.ZERO) > 0) {
            savingsPercent = savingsAmount
                    .multiply(BigDecimal.valueOf(100))
                    .divide(regularPrice, 0, java.math.RoundingMode.HALF_UP)
                    .intValue();
        }

        Theater theater = combo.getTheater();

        // Compute effective availability — combo chỉ bán được khi tất cả nguyên
        // liệu còn hàng + chưa bị archived. Industry pattern (CGV/Lotte): hết
        // 1 ingredient → combo tự ẩn POS, admin thấy lý do trên dashboard.
        List<String> unavailable = combo.getItems().stream()
                .map(com.cinex.module.combo.entity.ComboItem::getSnack)
                .filter(s -> s.getStorageState() == StorageState.ARCHIVED || !s.isAvailable())
                .map(com.cinex.module.snack.entity.Snack::getName)
                .distinct()
                .toList();
        boolean effectiveAvailable = combo.isActive()
                && combo.getStorageState() != StorageState.ARCHIVED
                && unavailable.isEmpty();

        return ComboResponse.builder()
                .id(combo.getId())
                .storageState(combo.getStorageState() != null ? combo.getStorageState().name() : null)
                .theaterId(theater != null ? theater.getId() : null)
                .theaterName(theater != null ? theater.getName() : null)
                .theaterCity(theater != null ? theater.getCity() : null)
                .code(combo.getCode())
                .name(combo.getName())
                .description(combo.getDescription())
                .imageUrl(combo.getImageUrl())
                .price(combo.getPrice())
                .active(combo.isActive())
                .items(itemResponses)
                .regularPrice(regularPrice)
                .savingsAmount(savingsAmount)
                .savingsPercent(savingsPercent)
                .createdAt(combo.getCreatedAt())
                .updatedAt(combo.getUpdatedAt())
                .effectiveAvailable(effectiveAvailable)
                .unavailableItems(unavailable)
                .build();
    }
}
