package com.cinex.common.config;

import com.cloudinary.Cloudinary;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;

/**
 * Cấu hình Cloudinary — dịch vụ cloud lưu trữ ảnh/video.
 *
 * Tại sao dùng Cloudinary thay vì lưu file trên server?
 * 1. Server stateless: khi scale nhiều instance, file trên server A không thấy ở server B
 * 2. CDN sẵn có: Cloudinary tự động phân phối ảnh qua CDN → load nhanh toàn cầu
 * 3. Transform: tự động resize, crop, nén ảnh qua URL (VD: thêm /w_200,h_200/ vào URL)
 * 4. Không lo hết dung lượng disk server
 *
 * Ngoài đời thật: hầu hết startup đều dùng cloud storage (S3, Cloudinary, Firebase Storage)
 * thay vì lưu file trực tiếp trên server.
 */
@Configuration
public class CloudinaryConfig {

    @Value("${cloudinary.cloud-name}")
    private String cloudName;

    @Value("${cloudinary.api-key}")
    private String apiKey;

    @Value("${cloudinary.api-secret}")
    private String apiSecret;

    @Bean
    public Cloudinary cloudinary() {
        return new Cloudinary(Map.of(
                "cloud_name", cloudName,
                "api_key", apiKey,
                "api_secret", apiSecret
        ));
    }
}
