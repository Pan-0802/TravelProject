package com.travel.mapper;

import com.travel.domain.Expense;
import org.apache.ibatis.annotations.Param;

public interface ExpenseMapper {
    Expense find(@Param("id") Long id);
    Expense lock(@Param("id") Long id);
    int insert(Expense entity);
    int update(Expense entity);
    int delete(@Param("id") Long id);
}
