package com.travel.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.travel.common.*;
import com.travel.domain.*;
import com.travel.dto.Requests.ItemWrite;
import com.travel.mapper.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ItineraryService {
    private final TripService trips;
    private final TripDayMapper days;
    private final ItineraryItemMapper items;
    private final AttractionMapper attractions;
    private final QueryMapper queries;
    private final ReadMapper reads;
    private final WriteSupport writes;
    public Map<String,Object> days(Long tripId) {
        Trip trip = trips.owned(tripId,false);
        Map<LocalDate,TripDay> existing = new HashMap<>();
        queries.days(tripId).forEach(d -> existing.put(d.getTripDate(),d));
        Map<Long,List<ItineraryItem>> byDay = reads.tripItems(tripId).stream()
            .collect(java.util.stream.Collectors.groupingBy(ItineraryItem::getDayId));
        List<Map<String,Object>> result = new ArrayList<>();
        for (LocalDate date=trip.getStartDate();!date.isAfter(trip.getEndDate());date=date.plusDays(1)) {
            TripDay day = existing.get(date); Map<String,Object> row = new LinkedHashMap<>();
            row.put("dayId",day==null?null:day.getDayId().toString()); row.put("date",date);
            row.put("dayNumber",ChronoUnit.DAYS.between(trip.getStartDate(),date)+1);
            row.put("description",day==null?null:day.getDescription()); row.put("items",day==null?List.of():byDay.getOrDefault(day.getDayId(),List.of()));
            result.add(row);
        }
        return Map.of("tripId",tripId.toString(),"startDate",trip.getStartDate(),"endDate",trip.getEndDate(),"days",result);
    }
    public void check(ItemWrite dto) {
        writes.validate(dto);
        if (dto.getStartTime()!=null && dto.getEndTime()!=null && dto.getEndTime().isBefore(dto.getStartTime()))
            throw new BusinessException(422,"结束时间不能早于开始时间");
        if (dto.getAttractionId()!=null && attractions.find(dto.getAttractionId())==null)
            throw new BusinessException(422,"引用的本地景点不存在");
    }
    public TripDay ensureDay(Long tripId,LocalDate date) {
        // All writers lock the parent trip first, serializing creation and reordering.
        TripDay day = queries.days(tripId).stream().filter(d -> d.getTripDate().equals(date)).findFirst().orElse(null);
        if (day==null) { day=new TripDay(); day.setTripId(tripId); day.setTripDate(date); days.insert(day); }
        return day;
    }
    private ItineraryItem owned(Long id) {
        ItineraryItem item=items.find(id); if(item==null) throw BusinessException.missing();
        TripDay day=days.find(item.getDayId()); trips.owned(day.getTripId(),false); return item;
    }
    private void normalize(Long dayId,List<ItineraryItem> ordered) {
        for(int i=0;i<ordered.size();i++) { ItineraryItem item=ordered.get(i); item.setSortOrder(i+1); items.update(item); }
    }
    private void position(ItineraryItem item,int position) {
        List<ItineraryItem> ordered=new ArrayList<>(queries.items(item.getDayId()));
        ordered.removeIf(i -> i.getItemId().equals(item.getItemId()));
        ordered.add(Math.min(position-1,ordered.size()),item); normalize(item.getDayId(),ordered);
    }
    @Transactional public ItineraryItem create(Long tripId,LocalDate date,ItemWrite dto) {
        Trip trip=trips.owned(tripId,true); WriteSupport.inRange(date,trip.getStartDate(),trip.getEndDate()); check(dto);
        TripDay day=ensureDay(tripId,date); ItineraryItem item=new ItineraryItem(); BeanUtils.copyProperties(dto,item);
        item.setDayId(day.getDayId()); item.setSourceType("MANUAL"); items.insert(item); position(item,dto.getSortOrder());
        return items.find(item.getItemId());
    }
    @Transactional public ItineraryItem patch(Long id,JsonNode patch) {
        ItineraryItem snapshot=owned(id); TripDay day=days.find(snapshot.getDayId()); trips.owned(day.getTripId(),true);
        ItineraryItem item=owned(id); ItemWrite dto=writes.patch(item,patch,ItemWrite.class); check(dto);
        BeanUtils.copyProperties(dto,item); items.update(item); position(item,dto.getSortOrder()); return items.find(id);
    }
    @Transactional public Map<String,Boolean> delete(Long id) {
        ItineraryItem item=owned(id); trips.owned(days.find(item.getDayId()).getTripId(),true); owned(id);
        items.delete(id); normalize(item.getDayId(),queries.items(item.getDayId())); return Map.of("deleted",true);
    }
    @Transactional public List<ItineraryItem> order(Long tripId,LocalDate date,List<Long> ids) {
        Trip trip=trips.owned(tripId,true); WriteSupport.inRange(date,trip.getStartDate(),trip.getEndDate());
        TripDay day=queries.days(tripId).stream().filter(d -> d.getTripDate().equals(date)).findFirst().orElse(null);
        List<ItineraryItem> existing=day==null?List.of():queries.items(day.getDayId());
        Map<Long,ItineraryItem> byId=new HashMap<>(); existing.forEach(i -> byId.put(i.getItemId(),i));
        if(ids.size()!=existing.size() || new HashSet<>(ids).size()!=ids.size() || !byId.keySet().equals(new HashSet<>(ids)))
            throw new BusinessException(422,"必须提供当天全部行程 ID，且不能重复或跨日期");
        if(day==null) return List.of();
        normalize(day.getDayId(),ids.stream().map(byId::get).toList()); return queries.items(day.getDayId());
    }
}
