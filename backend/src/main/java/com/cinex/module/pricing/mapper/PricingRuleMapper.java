package com.cinex.module.pricing.mapper;

import com.cinex.module.pricing.dto.PricingRuleResponse;
import com.cinex.module.pricing.entity.PricingRule;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface PricingRuleMapper {

    @Mapping(target = "theaterId", source = "theater.id")
    @Mapping(target = "theaterName", source = "theater.name")
    @Mapping(target = "theaterCity", source = "theater.city")
    PricingRuleResponse toResponse(PricingRule rule);
}
