package com.travel.mapper;

import com.travel.domain.TripDay;
import org.apache.ibatis.annotations.Param;

public interface TripDayMapper {
    TripDay find(@Param("id") Long id);
    TripDay lock(@Param("id") Long id);
    int insert(TripDay entity);
    int update(TripDay entity);
    int delete(@Param("id") Long id);
}
