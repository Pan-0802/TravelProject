package com.travel.mapper;

import com.travel.domain.*;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.*;

public interface QueryMapper {
    @Select("SELECT * FROM `user` WHERE username=#{username}") User userByName(String username);
    @Select("SELECT COALESCE(SUM(amount),0) FROM expense WHERE trip_id=#{id}") BigDecimal actual(Long id);
    @Select("<script>SELECT COUNT(*) FROM trip_day WHERE trip_id=#{id} AND (trip_date &lt; #{start} OR trip_date &gt; #{end})</script>")
    long daysOutside(@Param("id") Long id,@Param("start") LocalDate start,@Param("end") LocalDate end);
    @Select("<script>SELECT COUNT(*) FROM expense WHERE trip_id=#{id} AND (spent_on &lt; #{start} OR spent_on &gt; #{end})</script>")
    long expensesOutside(@Param("id") Long id,@Param("start") LocalDate start,@Param("end") LocalDate end);
    @Select("SELECT COUNT(*) FROM favorite WHERE user_id=#{uid} AND attraction_id=#{aid}")
    int favorited(@Param("uid") Long uid,@Param("aid") Long aid);
    @Delete("DELETE FROM favorite WHERE user_id=#{uid} AND attraction_id=#{aid}")
    int unfavorite(@Param("uid") Long uid,@Param("aid") Long aid);
    @Select("SELECT * FROM trip_day WHERE trip_id=#{id} ORDER BY trip_date") List<TripDay> days(Long id);
    @Select("SELECT * FROM itinerary_item WHERE day_id=#{id} ORDER BY sort_order,item_id") List<ItineraryItem> items(Long id);
}
