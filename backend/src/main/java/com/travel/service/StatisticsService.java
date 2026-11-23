package com.travel.service;

import com.travel.common.BusinessException;
import com.travel.dto.ReadModels.*;
import com.travel.mapper.ReadMapper;
import com.travel.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.math.*;
import java.time.*;
import java.util.*;

@Service
@RequiredArgsConstructor
public class StatisticsService {
    private final TripService trips;
    private final ReadMapper reads;
    private final Clock clock;
    public Overview overview() {
        return reads.overview(CurrentUser.id(), LocalDate.now(clock));
    }
    public Map<String,Object> categories(Long tripId) {
        if (tripId != null) trips.owned(tripId, false);
        var rows=reads.categories(CurrentUser.id(), tripId);
        BigDecimal total=rows.stream().map(CategoryTotal::getAmount).reduce(BigDecimal.ZERO,BigDecimal::add);
        Map<String,String> names=Map.of("FOOD","餐饮","TRANSPORT","交通","HOTEL","住宿","TICKET","门票","SHOPPING","购物","OTHER","其他");
        var items=rows.stream().map(row -> {
            Map<String,Object> item=new LinkedHashMap<>(); item.put("category",row.getCategory());
            item.put("amount",row.getAmount()); item.put("name",names.get(row.getCategory()));
            item.put("percentage",total.signum()==0?BigDecimal.ZERO:row.getAmount().multiply(BigDecimal.valueOf(100)).divide(total,2,RoundingMode.HALF_UP)); return item;
        }).toList();
        return Map.of("totalAmount",total,"items",items);
    }
    public Map<String,Object> comparison(int limit,boolean budget) {
        if(limit<1 || limit>50) throw new BusinessException(400,"limit 范围 1–50");
        var filter=new TripFilter(CurrentUser.id(),null,null,LocalDate.now(clock));
        var items=reads.trips(filter,0,limit).stream().map(t -> {
            Map<String,Object> item=new LinkedHashMap<>(); item.put("tripId",t.getTripId().toString()); item.put("title",t.getTitle());
            BigDecimal actual=t.getActualExpense(); item.put("actualExpense",actual);
            if(budget) { BigDecimal remaining=t.getTotalBudget().subtract(actual); item.put("totalBudget",t.getTotalBudget()); item.put("remainingBudget",remaining); item.put("overBudget",remaining.signum()<0); }
            return item;
        }).toList(); return Map.of("items",items);
    }
}
