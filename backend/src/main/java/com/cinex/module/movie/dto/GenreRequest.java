package com.cinex.module.movie.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class GenreRequest {

    @NotBlank(message = "Tên thể loại là bắt buộc")
    @Size(max = 50, message = "Tên thể loại tối đa 50 ký tự")
    private String name;

    @Size(max = 255, message = "Mô tả tối đa 255 ký tự")
    private String description;
}
