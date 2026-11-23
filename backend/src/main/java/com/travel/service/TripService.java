package com.travel.service;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.travel.common.*;
import com.travel.domain.Trip;
import com.travel.dto.Requests.TripWrite;
import com.travel.dto.ReadModels.TripFilter;
import com.travel.mapper.*;
import com.travel.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@RequiredArgsConstructor
public class TripService {
    private final TripMapper trips;
    private final QueryMapper queries;
    private final ReadMapper reads;
    private final WriteSupport writes;
    private final ObjectMapper json;
    private final Clock clock;
    public Trip owned(Long id, boolean lock) {
        Trip trip = lock ? trips.lock(id) : trips.find(id);
        if (trip == null || !trip.getUserId().equals(CurrentUser.id())) throw BusinessException.missing();
        return trip;
    }
    public String status(Trip trip) {
        LocalDate today = LocalDate.now(clock);
        return today.isBefore(trip.getStartDate()) ? "NOT_STARTED" : today.isAfter(trip.getEndDate()) ? "FINISHED" : "ONGOING";
    }
    public ObjectNode view(Trip trip) {
        return view(trip, queries.actual(trip.getTripId()));
    }
    private ObjectNode view(Trip trip, java.math.BigDecimal actual) {
        ObjectNode result = json.valueToTree(trip); result.remove("userId");
        result.put("tripStatus",status(trip)); result.put("daysCount",ChronoUnit.DAYS.between(trip.getStartDate(),trip.getEndDate())+1);
        result.put("actualExpense",actual);
        return result;
    }
    public PageResult<ObjectNode> list(int page,int size,String keyword,String status) {
        PageResult.validate(page,size);
        if (status != null && !Set.of("NOT_STARTED","ONGOING","FINISHED").contains(status)) throw new BusinessException(400,"旅行状态不合法");
        var filter = new TripFilter(CurrentUser.id(), keyword, status, LocalDate.now(clock));
        var rows = reads.trips(filter, (long)(page-1)*size, size);
        return new PageResult<>(rows.stream().map(t -> view(t,t.getActualExpense())).toList(), reads.countTrips(filter), page, size);
    }
    @Transactional public ObjectNode create(TripWrite dto) {
        WriteSupport.range(dto.getStartDate(),dto.getEndDate());
        Trip trip = new Trip(); BeanUtils.copyProperties(dto,trip); trip.setUserId(CurrentUser.id()); trips.insert(trip);
        return view(trips.find(trip.getTripId()));
    }
    @Transactional public ObjectNode patch(Long id,JsonNode patch) {
        Trip trip = owned(id,true); TripWrite dto = writes.patch(trip,patch,TripWrite.class);
        WriteSupport.range(dto.getStartDate(),dto.getEndDate());
        if (queries.daysOutside(id,dto.getStartDate(),dto.getEndDate()) > 0 || queries.expensesOutside(id,dto.getStartDate(),dto.getEndDate()) > 0)
            throw new BusinessException(422,"已有行程或消费超出新日期范围，请先调整子数据");
        BeanUtils.copyProperties(dto,trip); trips.update(trip); return view(trips.find(id));
    }
    @Transactional public Map<String,Object> delete(Long id) {
        owned(id,true); trips.delete(id); return Map.of("deleted",true,"tripId",id.toString());
    }
}
