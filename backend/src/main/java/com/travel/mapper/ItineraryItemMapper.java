package com.travel.mapper;

import com.travel.domain.ItineraryItem;
import org.apache.ibatis.annotations.Param;

public interface ItineraryItemMapper {
    ItineraryItem find(@Param("id") Long id);
    ItineraryItem lock(@Param("id") Long id);
    int insert(ItineraryItem entity);
    int update(ItineraryItem entity);
    int delete(@Param("id") Long id);
}
