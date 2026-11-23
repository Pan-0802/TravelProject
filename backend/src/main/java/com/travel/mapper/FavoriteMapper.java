package com.travel.mapper;

import com.travel.domain.Favorite;
import org.apache.ibatis.annotations.Param;

public interface FavoriteMapper {
    Favorite find(@Param("id") Long id);
    Favorite lock(@Param("id") Long id);
    int insert(Favorite entity);
    int update(Favorite entity);
    int delete(@Param("id") Long id);
}
