package com.travel.service;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.travel.common.*;
import com.travel.domain.*;
import com.travel.dto.AiRequests.*;
import com.travel.dto.Requests.ItemWrite;
import com.travel.integration.AiClient;
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
public class AiPlanService {
    private final AiClient client;
    private final AiPlanRecordMapper plans;
    private final QueryMapper queries;
    private final ReadMapper reads;
    private final TripService trips;
    private final ItineraryService itinerary;
    private final TripDayMapper days;
    private final ItineraryItemMapper items;
    private final ObjectMapper json;
    private final WriteSupport writes;
    private final Clock clock;
    private AiPlanRecord owned(Long id,boolean lock) {
        AiPlanRecord plan=lock?plans.lock(id):plans.find(id);
        if(plan==null || !plan.getUserId().equals(CurrentUser.id())) throw BusinessException.missing(); return plan;
    }
    private String encode(Object value) {
        try { return json.writeValueAsString(value); } catch(Exception e) { throw new BusinessException(500,"规划数据序列化失败"); }
    }
    private JsonNode decode(String value) {
        try { return value==null?json.createObjectNode():json.readTree(value); } catch(Exception e) { throw new BusinessException(500,"历史规划数据不可解析"); }
    }
    private void matches(Trip trip,Generate request) {
        if(!trip.getDestination().equals(request.destination()) || !trip.getStartDate().equals(request.startDate()) || !trip.getEndDate().equals(request.endDate()))
            throw new BusinessException(422,"目标旅行的目的地与日期必须和规划条件一致");
    }
    public void validateDays(List<Day> rows,LocalDate start,LocalDate end) {
        if(rows==null || rows.size()!=ChronoUnit.DAYS.between(start,end)+1) throw new BusinessException(422,"规划必须覆盖全部旅行日期");
        Set<LocalDate> dates=new HashSet<>();
        for(Day day:rows) {
            if(day==null) throw new BusinessException(422,"规划日期条目不能为空");
            writes.validate(day); WriteSupport.inRange(day.date(),start,end);
            if(!dates.add(day.date()) || day.dayNumber()!=ChronoUnit.DAYS.between(start,day.date())+1)
                throw new BusinessException(422,"规划日期不能重复且 dayNumber 必须正确");
            Set<Integer> order=new HashSet<>();
            for(ItemWrite dto:day.items()) {
                if(dto==null) throw new BusinessException(422,"规划活动不能为空");
                itinerary.check(dto);
                if(!order.add(dto.getSortOrder())) throw new BusinessException(422,"同一天的排序值不能重复");
            }
        }
    }
    // Do not wrap network requests in a DB transaction. Failed attempts remain queryable.
    public ObjectNode generate(Generate request) {
        writes.validate(request); WriteSupport.range(request.startDate(),request.endDate());
        if(request.travelDays()!=ChronoUnit.DAYS.between(request.startDate(),request.endDate())+1)
            throw new BusinessException(422,"旅行天数必须与日期区间一致");
        if(request.tripId()!=null) matches(trips.owned(request.tripId(),false),request);
        AiPlanRecord record=new AiPlanRecord(); record.setUserId(CurrentUser.id()); record.setTripId(request.tripId()); record.setRequestJson(encode(request));
        try {
            Draft draft=client.generate(request);
            try {
                if(draft==null) throw new BusinessException(502,"AI 返回空草稿");
                writes.validate(draft); validateDays(draft.days(),request.startDate(),request.endDate());
                if(draft.days().stream().flatMap(d -> d.items().stream()).anyMatch(i -> i.getAttractionId()!=null))
                    throw new BusinessException(502,"AI 不得自动关联本地景点");
            } catch(BusinessException e) { throw new BusinessException(502,"AI 规划未通过日期、时间或金额校验"); }
            record.setResponseJson(encode(draft)); record.setEstimatedTotal(draft.estimatedTotal()); record.setStatus("DRAFT");
        } catch(BusinessException e) {
            record.setStatus("FAILED"); record.setErrorMessage(e.getMessage()); plans.insert(record); throw e;
        }
        plans.insert(record); return detail(record.getAiPlanId());
    }
    public ObjectNode detail(Long id) {
        AiPlanRecord record=owned(id,false); JsonNode request=decode(record.getRequestJson()),response=decode(record.getResponseJson());
        ObjectNode out=json.createObjectNode(); out.put("aiPlanId",id.toString());
        if(record.getTripId()==null) out.putNull("tripId"); else out.put("tripId",record.getTripId().toString());
        out.put("status",record.getStatus());
        for(String field:List.of("destination","startDate","endDate","travelDays")) out.set(field,request.path(field).isMissingNode()?json.nullNode():request.path(field));
        out.set("estimatedTotal",json.valueToTree(record.getEstimatedTotal())); out.set("days",response.path("days").isArray()?response.path("days"):json.createArrayNode());
        out.set("createdAt",json.valueToTree(record.getCreatedAt())); out.set("savedAt",json.valueToTree(record.getSavedAt()));
        out.set("errorMessage",json.valueToTree(record.getErrorMessage())); out.set("request",request); return out;
    }
    public PageResult<ObjectNode> list(int page,int size,String status) {
        PageResult.validate(page,size);
        if(status!=null && !Set.of("DRAFT","SAVED","FAILED").contains(status)) throw new BusinessException(400,"规划状态不合法");
        var found=reads.plans(CurrentUser.id(),status,(long)(page-1)*size,size);
        var rows=found.stream().map(p -> {
            ObjectNode row=json.createObjectNode(); row.put("aiPlanId",p.getAiPlanId().toString());
            if(p.getTripId()==null) row.putNull("tripId"); else row.put("tripId",p.getTripId().toString());
            row.put("status",p.getStatus()); row.set("destination",decode(p.getRequestJson()).path("destination"));
            row.set("estimatedTotal",json.valueToTree(p.getEstimatedTotal())); row.set("createdAt",json.valueToTree(p.getCreatedAt()));
            row.set("savedAt",json.valueToTree(p.getSavedAt())); row.set("errorMessage",json.valueToTree(p.getErrorMessage())); return row;
        }).toList(); return new PageResult<>(rows,reads.countPlans(CurrentUser.id(),status),page,size);
    }
    @Transactional public Map<String,Object> save(Long id,Save request) {
        Trip trip=trips.owned(request.tripId(),true); AiPlanRecord plan=owned(id,true);
        if(!plan.getStatus().equals("DRAFT")) throw new BusinessException(409,"规划已保存或生成失败，不能重复导入");
        Generate original;
        try { original=json.treeToValue(decode(plan.getRequestJson()),Generate.class); }
        catch(Exception e) { throw new BusinessException(422,"旧版演示草稿缺少日期条件，请重新生成规划"); }
        if(original.startDate()==null || original.endDate()==null) throw new BusinessException(422,"旧版草稿缺少日期条件，请重新生成规划");
        if(plan.getTripId()!=null && !plan.getTripId().equals(request.tripId())) throw new BusinessException(422,"草稿已绑定其他旅行");
        matches(trip,original); validateDays(request.days(),trip.getStartDate(),trip.getEndDate());
        var existing=queries.days(trip.getTripId());
        if(!request.confirmOverwrite() && existing.stream().anyMatch(d -> !queries.items(d.getDayId()).isEmpty()))
            throw new BusinessException(409,"已有行程，是否覆盖？");
        existing.forEach(d -> queries.items(d.getDayId()).forEach(i -> items.delete(i.getItemId())));
        int savedItems=0;
        for(Day row:request.days()) {
            TripDay day=itinerary.ensureDay(trip.getTripId(),row.date()); day.setDescription(row.description()); days.update(day);
            for(ItemWrite dto:row.items()) {
                ItineraryItem item=new ItineraryItem(); BeanUtils.copyProperties(dto,item); item.setDayId(day.getDayId()); item.setSourceType("AI"); items.insert(item); savedItems++;
            }
        }
        LocalDateTime now=LocalDateTime.now(clock); plan.setTripId(trip.getTripId()); plan.setStatus("SAVED"); plan.setSavedAt(now); plans.update(plan);
        return Map.of("aiPlanId",id.toString(),"tripId",trip.getTripId().toString(),"status","SAVED","savedDays",request.days().size(),"savedItems",savedItems,"savedAt",now);
    }
}
