package com.cinex.common.service;

import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.Set;

/**
 * Service upload file lên Cloudinary.
 *
 * Dùng chung cho toàn bộ dự án: avatar user, poster phim, ảnh rạp, ...
 * Mỗi nơi gọi chỉ cần truyền file + folder là xong.
 *
 * [Single Responsibility] Class này CHỈ lo việc upload.
 * Validation file type/size cũng nằm ở đây vì nó gắn liền với upload.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FileUploadService {

    private final Cloudinary cloudinary;

    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp"
    );
    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB (poster phim lớn hơn avatar)

    /**
     * Upload ảnh lên Cloudinary, trả về URL public.
     *
     * @param file   file ảnh từ client (MultipartFile)
     * @param folder thư mục trên Cloudinary (VD: "cinex/avatars", "cinex/posters")
     * @return URL public của ảnh đã upload
     *
     * Luồng chi tiết:
     * 1. Client gửi file binary qua HTTP multipart/form-data
     * 2. Spring nhận → wrap thành MultipartFile (giữ nguyên binary gốc, KHÔNG nén)
     * 3. Server gửi byte[] gốc sang Cloudinary qua HTTPS (TLS mã hóa đường truyền)
     * 4. Cloudinary nhận → lưu bản gốc + tự động tối ưu:
     *    - "quality"="auto": nén ảnh mức tốt nhất (giữ chất lượng, giảm dung lượng 60-80%)
     *    - "fetch_format"="auto": chọn format tối ưu theo browser (WebP cho Chrome, AVIF cho Safari)
     *    - Tạo public_id unique (tránh trùng tên khi 2 người upload file cùng tên)
     * 5. Trả về secure_url (HTTPS + CDN)
     */
    public String uploadImage(MultipartFile file, String folder) {
        validateImage(file);

        try {
            // Gửi byte[] gốc sang Cloudinary qua HTTPS
            // Không cần mã hóa/nén trước — Cloudinary lo việc tối ưu sau khi nhận
            Map<?, ?> result = cloudinary.uploader().upload(file.getBytes(), ObjectUtils.asMap(
                    "folder", folder,
                    "resource_type", "image",
                    "quality", "auto",       // Tự chọn mức nén tốt nhất (ảnh 2MB → ~300-500KB)
                    "fetch_format", "auto"   // Tự chọn format theo browser: WebP, AVIF, ...
            ));
            String url = (String) result.get("secure_url");
            log.info("Uploaded image to Cloudinary: {}", url);
            return url;
        } catch (IOException e) {
            log.error("Failed to upload image to Cloudinary", e);
            throw new BusinessException(ErrorCode.UNCATEGORIZED, "Tải ảnh lên thất bại");
        }
    }

    /**
     * Xóa ảnh cũ trên Cloudinary khi cập nhật poster/avatar mới.
     *
     * @param imageUrl URL ảnh cần xóa (VD: https://res.cloudinary.com/.../cinex/posters/abc123.jpg)
     *
     * Tại sao cần xóa ảnh cũ?
     * → Mỗi lần upload poster mới, ảnh cũ vẫn nằm trên Cloudinary → tốn storage
     * → Xóa ảnh cũ = giữ storage sạch, không lãng phí free tier
     *
     * Cách lấy public_id từ URL:
     * URL: https://res.cloudinary.com/cinex/image/upload/v123/cinex/posters/abc123.jpg
     * public_id: cinex/posters/abc123 (bỏ domain + /upload/vXXX/ + đuôi file)
     */
    public void deleteImage(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) return;

        try {
            // Trích public_id từ URL: lấy phần sau "/upload/vXXX/" và bỏ đuôi file
            String[] parts = imageUrl.split("/upload/");
            if (parts.length < 2) return;

            String pathWithVersion = parts[1]; // "v123/cinex/posters/abc123.jpg"
            // Bỏ version prefix (v123/)
            String pathAfterVersion = pathWithVersion.substring(pathWithVersion.indexOf('/') + 1);
            // Bỏ đuôi file (.jpg, .png, ...)
            String publicId = pathAfterVersion.substring(0, pathAfterVersion.lastIndexOf('.'));

            cloudinary.uploader().destroy(publicId, ObjectUtils.emptyMap());
            log.info("Deleted image from Cloudinary: {}", publicId);
        } catch (Exception e) {
            // Xóa ảnh thất bại không nên làm crash request chính
            log.warn("Failed to delete image from Cloudinary: {}", imageUrl, e);
        }
    }

    private void validateImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_FILE, "File không được để trống");
        }
        if (!ALLOWED_IMAGE_TYPES.contains(file.getContentType())) {
            throw new BusinessException(ErrorCode.INVALID_FILE,
                    "Chỉ chấp nhận ảnh JPG, PNG, WEBP");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BusinessException(ErrorCode.INVALID_FILE,
                    "Kích thước file không được vượt quá 5MB");
        }
        // Validate magic bytes: content-type do client gửi có thể bị giả mạo
        // → đọc bytes đầu file để xác nhận đúng là ảnh thật
        validateMagicBytes(file);
    }

    /**
     * Kiểm tra magic bytes (file signature) của file ảnh.
     *
     * Tại sao cần?
     * - Header Content-Type do client tự gửi, có thể giả mạo (VD: đổi tên virus.exe thành virus.jpg)
     * - Magic bytes là vài byte đầu file, do định dạng file quy định, KHÔNG đổi được
     *   nếu không phá hỏng file
     *
     * Magic bytes các định dạng:
     * - JPEG: FF D8 FF
     * - PNG:  89 50 4E 47 0D 0A 1A 0A
     * - WebP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50  (RIFF....WEBP)
     */
    private void validateMagicBytes(MultipartFile file) {
        try {
            byte[] header = new byte[12];
            int read;
            try (var is = file.getInputStream()) {
                read = is.read(header, 0, 12);
            }
            if (read < 3) {
                throw new BusinessException(ErrorCode.INVALID_FILE, "File không phải ảnh hợp lệ");
            }

            // JPEG: FF D8 FF
            boolean isJpeg = (header[0] & 0xFF) == 0xFF
                    && (header[1] & 0xFF) == 0xD8
                    && (header[2] & 0xFF) == 0xFF;

            // PNG: 89 50 4E 47 0D 0A 1A 0A
            boolean isPng = read >= 8
                    && (header[0] & 0xFF) == 0x89
                    && (header[1] & 0xFF) == 0x50
                    && (header[2] & 0xFF) == 0x4E
                    && (header[3] & 0xFF) == 0x47
                    && (header[4] & 0xFF) == 0x0D
                    && (header[5] & 0xFF) == 0x0A
                    && (header[6] & 0xFF) == 0x1A
                    && (header[7] & 0xFF) == 0x0A;

            // WebP: "RIFF" (52 49 46 46) ở byte 0-3, "WEBP" (57 45 42 50) ở byte 8-11
            boolean isWebp = read >= 12
                    && (header[0] & 0xFF) == 0x52
                    && (header[1] & 0xFF) == 0x49
                    && (header[2] & 0xFF) == 0x46
                    && (header[3] & 0xFF) == 0x46
                    && (header[8] & 0xFF) == 0x57
                    && (header[9] & 0xFF) == 0x45
                    && (header[10] & 0xFF) == 0x42
                    && (header[11] & 0xFF) == 0x50;

            if (!isJpeg && !isPng && !isWebp) {
                throw new BusinessException(ErrorCode.INVALID_FILE, "File không phải ảnh hợp lệ");
            }
        } catch (IOException e) {
            log.warn("Không đọc được magic bytes của file upload", e);
            throw new BusinessException(ErrorCode.INVALID_FILE, "File không phải ảnh hợp lệ");
        }
    }
}
