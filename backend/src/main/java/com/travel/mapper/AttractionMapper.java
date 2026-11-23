package com.travel.mapper;

import com.travel.domain.Attraction;
import org.apache.ibatis.annotations.Param;

public interface AttractionMapper {
    Attraction find(@Param("id") Long id);
    Attraction lock(@Param("id") Long id);
    int insert(Attraction entity);
    int update(Attraction entity);
    int delete(@Param("id") Long id);
}
