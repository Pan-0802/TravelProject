package com.travel.mapper;

import com.travel.domain.Trip;
import org.apache.ibatis.annotations.Param;

public interface TripMapper {
    Trip find(@Param("id") Long id);
    Trip lock(@Param("id") Long id);
    int insert(Trip entity);
    int update(Trip entity);
    int delete(@Param("id") Long id);
}
