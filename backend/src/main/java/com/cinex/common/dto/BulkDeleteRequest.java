package com.cinex.common.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class BulkDeleteRequest {

    @NotEmpty(message = "Vui lòng chọn ít nhất 1 mục")
    private List<Long> ids;
}
