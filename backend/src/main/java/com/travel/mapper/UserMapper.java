package com.travel.mapper;

import com.travel.domain.User;
import org.apache.ibatis.annotations.Param;

public interface UserMapper {
    User find(@Param("id") Long id);
    User lock(@Param("id") Long id);
    int insert(User entity);
    int update(User entity);
    int delete(@Param("id") Long id);
}
