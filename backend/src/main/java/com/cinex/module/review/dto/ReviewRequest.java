package com.cinex.module.review.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ReviewRequest {

    @NotNull(message = "Điểm đánh giá là bắt buộc")
    @Min(value = 1, message = "Điểm tối thiểu là 1")
    @Max(value = 10, message = "Điểm tối đa là 10")
    private Integer rating;

    // Comment là tùy chọn — user có thể chỉ cho điểm mà không viết nhận xét
    @Size(max = 1000, message = "Bình luận tối đa 1000 ký tự")
    private String comment;
}
