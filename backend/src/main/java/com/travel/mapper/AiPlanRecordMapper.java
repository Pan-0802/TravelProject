package com.travel.mapper;

import com.travel.domain.AiPlanRecord;
import org.apache.ibatis.annotations.Param;

public interface AiPlanRecordMapper {
    AiPlanRecord find(@Param("id") Long id);
    AiPlanRecord lock(@Param("id") Long id);
    int insert(AiPlanRecord entity);
    int update(AiPlanRecord entity);
    int delete(@Param("id") Long id);
}
