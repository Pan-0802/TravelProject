package com.travel;

import com.fasterxml.jackson.databind.*;
import com.travel.domain.TripDay;
import com.travel.dto.AiRequests.*;
import com.travel.dto.Requests.ItemWrite;
import com.travel.integration.AiClient;
import com.travel.service.ItineraryService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.*;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class BackendIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean AiClient ai;
    @MockitoSpyBean ItineraryService itinerary;
    String token,otherToken,tripId;
    @BeforeEach void setup() throws Exception {
        token=account("owner"); otherToken=account("other"); tripId=createTrip(token);
    }
    JsonNode call(String method,String path,String bearer,Object body,int status) throws Exception {
        var request=switch(method) {
            case "POST" -> post(path); case "PATCH" -> patch(path); case "PUT" -> put(path); case "DELETE" -> delete(path); default -> get(path);
        };
        if(bearer!=null) request.header("Authorization","Bearer "+bearer);
        if(body!=null) request.contentType("application/json").content(body instanceof String?(String)body:json.writeValueAsString(body));
        String result=mvc.perform(request).andExpect(status().is(status)).andReturn().getResponse().getContentAsString();
        return json.readTree(result);
    }
    String account(String username) throws Exception {
        call("POST","/api/auth/register",null,Map.of("username",username,"password","Test@123456","confirmPassword","Test@123456"),201);
        JsonNode result=call("POST","/api/auth/login",null,Map.of("username",username,"password","Test@123456"),200);
        assertThat(result.path("data").path("user").has("passwordHash")).isFalse();
        return result.path("data").path("accessToken").asText();
    }
    String createTrip(String bearer) throws Exception {
        return call("POST","/api/trips",bearer,Map.of("title","重庆三日游","destination","重庆","startDate","2026-12-01","endDate","2026-12-03","totalBudget",1500),201)
            .path("data").path("tripId").asText();
    }
    Map<String,Object> expense() { return Map.of("category","FOOD","amount",65,"spentOn","2026-12-01"); }
    Map<String,Object> generate() { return Map.of("tripId",tripId,"destination","重庆","startDate","2026-12-01","endDate","2026-12-03","travelDays",3,"totalBudget",1500); }
    @Test void refinementUsesEditedDaysAndRejectsMismatchedDates() throws Exception {
        ItemWrite item=new ItemWrite();item.setItemName("当前编辑后的故宫安排");item.setSortOrder(1);
        var reference=List.of(new Day(LocalDate.parse("2026-12-01"),1,null,List.of(item)),
            new Day(LocalDate.parse("2026-12-02"),2,null,List.of()),new Day(LocalDate.parse("2026-12-03"),3,null,List.of()));
        when(ai.generate(any())).thenAnswer(invocation->{Generate request=invocation.getArgument(0);
            assertThat(request.referenceDays().get(0).items().get(0).getItemName()).isEqualTo("当前编辑后的故宫安排");
            return new Draft(BigDecimal.ZERO,reference);});
        var payload=new HashMap<String,Object>(generate());payload.put("referenceDays",reference);payload.put("requirements","保留首日，多休息");
        call("POST","/api/ai/plans",token,payload,200);
        payload.put("referenceDays",List.of(reference.get(0)));
        call("POST","/api/ai/plans",token,payload,422);
        verify(ai,times(1)).generate(any());
    }
    List<Day> plannedDays() {
        ItemWrite item=new ItemWrite(); item.setItemName("午餐"); item.setEstimatedCost(new BigDecimal("50.00"));
        return List.of(new Day(LocalDate.parse("2026-12-01"),1,"第一天",List.of(item)),new Day(LocalDate.parse("2026-12-02"),2,null,List.of()),new Day(LocalDate.parse("2026-12-03"),3,null,List.of()));
    }
    String draft() throws Exception {
        when(ai.generate(any())).thenReturn(new Draft(new BigDecimal("900.00"),plannedDays()));
        return call("POST","/api/ai/plans",token,generate(),200).path("data").path("aiPlanId").asText();
    }
    @Test void authenticationAndIdSerialization() throws Exception {
        call("GET","/health",null,null,200);
        assertThat(call("GET","/health/ready",null,null,200).path("data").path("database").asText()).isEqualTo("UP");
        call("GET","/api/trips",null,null,401);
        call("GET","/api/trips","bad-token",null,401);
        var trip=call("GET","/api/trips/"+tripId,token,null,200).path("data");
        assertThat(trip.path("tripId").isTextual()).isTrue();
        assertThat(trip.path("daysCount").asInt()).isEqualTo(3);
        assertThat(trip.path("actualExpense").decimalValue()).isEqualByComparingTo("0");
        assertThat(trip.has("userId")).isFalse();
    }
    @Test void ownerIsolation() throws Exception {
        call("GET","/api/trips/"+tripId,otherToken,null,404);
        call("PATCH","/api/trips/"+tripId,otherToken,Map.of("title","偷改"),404);
        call("DELETE","/api/trips/"+tripId,otherToken,null,404);
        assertThat(call("GET","/api/trips",otherToken,null,200).path("data").path("total").asInt()).isZero();
    }
    @Test void registerAndPasswordValidation() throws Exception {
        call("POST","/api/auth/register",null,Map.of("username","owner","password","Test@123456","confirmPassword","Test@123456"),409);
        call("POST","/api/auth/register",null,Map.of("username","new","password","Test@123456","confirmPassword","different"),400);
        call("POST","/api/auth/login",null,Map.of("username","owner","password","wrong"),401);
        call("POST","/api/auth/login",null,Map.of("username","unknown","password","wrong"),401);
        call("PATCH","/api/users/me/password",token,Map.of("oldPassword","Test@123456","newPassword","New@123456","confirmPassword","New@123456"),200);
        call("POST","/api/auth/login",null,Map.of("username","owner","password","New@123456"),200);
    }
    @Test void partialUpdateAndForbiddenFields() throws Exception {
        var data=call("PATCH","/api/trips/"+tripId,token,Map.of("title","改名"),200).path("data");
        assertThat(data.path("destination").asText()).isEqualTo("重庆");
        call("PATCH","/api/trips/"+tripId,token,Map.of("userId","2"),400);
        call("PATCH","/api/trips/"+tripId,token,"{}",400);
        call("PATCH","/api/trips/"+tripId,token,"{\"title\":null}",400);
        call("PATCH","/api/trips/"+tripId,token,Map.of("totalBudget",1.001),400);
    }
    @Test void expenseDateAndIsolationAndDateShrink() throws Exception {
        var data=call("POST","/api/trips/"+tripId+"/expenses",token,expense(),201).path("data");
        String id=data.path("expenseId").asText();
        call("PATCH","/api/expenses/"+id,otherToken,Map.of("amount",90),404);
        call("PATCH","/api/trips/"+tripId,token,Map.of("startDate","2026-12-02"),422);
        call("PATCH","/api/expenses/"+id,token,Map.of("spentOn","2026-12-04"),422);
        call("PATCH","/api/expenses/"+id,token,Map.of("amount",0),400);
        assertThat(call("PATCH","/api/expenses/"+id,token,Map.of("amount",90),200).path("data").path("category").asText()).isEqualTo("FOOD");
    }
    @Test void emptyDaysAndReordering() throws Exception {
        var empty=call("GET","/api/trips/"+tripId+"/days",token,null,200).path("data").path("days");
        assertThat(empty.size()).isEqualTo(3); assertThat(empty.get(0).path("dayId").isNull()).isTrue();
        String path="/api/trips/"+tripId+"/days/2026-12-01/items";
        String a=call("POST",path,token,Map.of("itemName","A","sortOrder",1),201).path("data").path("itemId").asText();
        String b=call("POST",path,token,Map.of("itemName","B","sortOrder",1),201).path("data").path("itemId").asText();
        var result=call("PUT",path+"/order",token,Map.of("itemIds",List.of(a,b)),200).path("data");
        assertThat(result.get(0).path("itemId").asText()).isEqualTo(a);
        assertThat(result.get(1).path("sortOrder").asInt()).isEqualTo(2);
        call("PUT",path+"/order",token,Map.of("itemIds",List.of(a,a)),422);
        call("POST",path,token,Map.of("itemName","bad","startTime","12:00","endTime","11:00"),422);
        call("POST",path,token,Map.of("itemName","bad","sourceType","AI"),400);
    }
    String timedItem(String name,String start,String end) throws Exception {
        Map<String,Object> body=new HashMap<>();body.put("itemName",name);body.put("sortOrder",999);
        if(start!=null)body.put("startTime",start);if(end!=null)body.put("endTime",end);
        return call("POST","/api/trips/"+tripId+"/days/2026-12-01/items",token,body,201).path("data").path("itemId").asText();
    }
    List<JsonNode> firstDayItems() throws Exception {
        var result=call("GET","/api/trips/"+tripId+"/days",token,null,200).path("data").path("days").get(0).path("items");
        List<JsonNode> rows=new ArrayList<>();result.forEach(rows::add);return rows;
    }
    @Test void timedManualItemIsInsertedAmongExistingAiActivitiesAndUntimedItemsStayLast() throws Exception {
        String morning=timedItem("早间活动","08:30","09:20");
        String afternoon=timedItem("北海公园","14:45","16:30");
        String dinner=timedItem("晚餐","17:00","18:00");
        String night=timedItem("什刹海夜景","18:15","19:45");
        jdbc.update("UPDATE itinerary_item SET source_type='AI' WHERE item_id IN (?,?,?,?)",Long.valueOf(morning),Long.valueOf(afternoon),Long.valueOf(dinner),Long.valueOf(night));
        timedItem("时间待定",null,null);
        call("POST","/api/trips/"+tripId+"/expenses",token,expense(),201);
        String added=timedItem("手动餐馆","16:00",null);
        var rows=firstDayItems();
        assertThat(rows.stream().map(r->r.path("itemName").asText())).containsExactly("早间活动","北海公园","手动餐馆","晚餐","什刹海夜景","时间待定");
        assertThat(rows.stream().map(r->r.path("sortOrder").asInt())).containsExactly(1,2,3,4,5,6);
        assertThat(rows.get(2).path("itemId").asText()).isEqualTo(added);
        assertThat(rows.get(2).path("sourceType").asText()).isEqualTo("MANUAL");
        assertThat(rows.get(2).path("endTime").isNull()).isTrue();
        assertThat(rows.get(1).path("endTime").asText()).isEqualTo("16:30");
        assertThat(rows.get(1).path("sourceType").asText()).isEqualTo("AI");
        assertThat(call("GET","/api/trips/"+tripId+"/budget-summary",token,null,200).path("data").path("actualExpense").decimalValue()).isEqualByComparingTo("65");
        assertThat(call("GET","/api/trips/"+tripId+"/days",token,null,200).path("data").path("days").get(1).path("items")).isEmpty();
    }
    @Test void changingStartTimeRepositionsAndClearingItMovesToUntimedEnd() throws Exception {
        timedItem("早上","09:00","10:00");timedItem("晚上","18:00","19:00");
        String changed=timedItem("待修改","16:00",null);
        call("PATCH","/api/itinerary-items/"+changed,token,Map.of("startTime","08:00"),200);
        assertThat(firstDayItems().get(0).path("itemId").asText()).isEqualTo(changed);
        call("PATCH","/api/itinerary-items/"+changed,token,"{\"startTime\":null}",200);
        assertThat(firstDayItems().get(2).path("itemId").asText()).isEqualTo(changed);
        assertThat(firstDayItems().get(2).path("startTime").isNull()).isTrue();
    }
    @Test void equalStartTimesKeepExistingOrderAndNewItemComesAfterThem() throws Exception {
        String a=timedItem("同一时段A","12:00",null),b=timedItem("同一时段B","12:00",null);
        var created=call("POST","/api/trips/"+tripId+"/days/2026-12-01/items",token,Map.of("itemName","同一时段C","startTime","12:00","sortOrder",1),201).path("data");
        assertThat(firstDayItems().stream().map(r->r.path("itemId").asText())).containsExactly(a,b,created.path("itemId").asText());
        assertThat(created.path("sortOrder").asInt()).isEqualTo(3);
    }
    @Test void editingMetadataPreservesExplicitCustomOrder() throws Exception {
        String a=timedItem("上午","09:00","10:00"),b=timedItem("下午","16:00","17:00");
        String path="/api/trips/"+tripId+"/days/2026-12-01/items/order";
        call("PUT",path,token,Map.of("itemIds",List.of(b,a)),200);
        call("PATCH","/api/itinerary-items/"+a,token,Map.of("startTime","09:00","note","只修改备注","estimatedCost",20),200);
        assertThat(firstDayItems().stream().map(r->r.path("itemId").asText())).containsExactly(b,a);
    }
    @Test void invalidTimeEditDoesNotPartiallyReorderOrChangeAnotherUsersDay() throws Exception {
        String a=timedItem("上午","09:00","10:00");timedItem("下午","16:00","17:00");
        var before=firstDayItems();
        call("PATCH","/api/itinerary-items/"+a,token,Map.of("startTime","18:00","note","不应写入"),422);
        call("PATCH","/api/itinerary-items/"+a,otherToken,Map.of("startTime","08:00"),404);
        assertThat(firstDayItems()).isEqualTo(before);
    }
    @Test void attractionOwnershipFavoritesAndCascade() throws Exception {
        String id=call("POST","/api/attractions",token,Map.of("name","观景点","city","重庆"),201).path("data").path("attractionId").asText();
        call("PATCH","/api/attractions/"+id,otherToken,Map.of("name","改名"),404);
        call("POST","/api/favorites",otherToken,Map.of("attractionId",id),201);
        call("POST","/api/favorites",otherToken,Map.of("attractionId",id),409);
        call("DELETE","/api/attractions/"+id,token,null,200);
        assertThat(call("GET","/api/favorites",otherToken,null,200).path("data").path("total").asInt()).isZero();
    }
    @Test void statisticsDoNotMultiplyBudget() throws Exception {
        call("POST","/api/trips/"+tripId+"/expenses",token,expense(),201);
        call("POST","/api/trips/"+tripId+"/expenses",token,expense(),201);
        var stats=call("GET","/api/statistics/overview",token,null,200).path("data");
        assertThat(stats.path("totalBudget").decimalValue()).isEqualByComparingTo("1500");
        assertThat(stats.path("totalActualExpense").decimalValue()).isEqualByComparingTo("130");
        assertThat(stats.path("totalTravelDays").asInt()).isEqualTo(3);
    }
    @Test void aiDraftSaveAndIdempotency() throws Exception {
        String id=draft();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM itinerary_item",Integer.class)).isZero();
        call("POST","/api/ai/plans/"+id+"/save",otherToken,new Save(Long.valueOf(tripId),false,plannedDays()),404);
        call("POST","/api/ai/plans/"+id+"/save",token,new Save(Long.valueOf(tripId),false,plannedDays()),200);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM expense",Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT source_type FROM itinerary_item",String.class)).isEqualTo("AI");
        call("POST","/api/ai/plans/"+id+"/save",token,new Save(Long.valueOf(tripId),true,plannedDays()),409);
        call("DELETE","/api/trips/"+tripId,token,null,200);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM itinerary_item",Integer.class)).isZero();
        assertThat(call("GET","/api/ai/plans/"+id,token,null,200).path("data").path("tripId").isNull()).isTrue();
    }
    @Test void aiOverwriteRequiresConfirmation() throws Exception {
        call("POST","/api/trips/"+tripId+"/days/2026-12-01/items",token,Map.of("itemName","原行程"),201);
        String id=draft();
        call("POST","/api/ai/plans/"+id+"/save",token,new Save(Long.valueOf(tripId),false,plannedDays()),409);
        assertThat(jdbc.queryForObject("SELECT item_name FROM itinerary_item",String.class)).isEqualTo("原行程");
        call("POST","/api/ai/plans/"+id+"/save",token,new Save(Long.valueOf(tripId),true,plannedDays()),200);
    }
    @Test void invalidAiOutputNeverBecomesDraft() throws Exception {
        when(ai.generate(any())).thenReturn(new Draft(BigDecimal.ZERO,List.of(plannedDays().get(0))));
        call("POST","/api/ai/plans",token,generate(),502);
        assertThat(jdbc.queryForObject("SELECT status FROM ai_plan_record",String.class)).isEqualTo("FAILED");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM trip_day",Integer.class)).isZero();
    }
    @Test void externalKeysAndInputValidation() throws Exception {
        call("GET","/api/pois/search?keywords=公园&region=重庆",token,null,503);
        call("GET","/api/pois/search?keywords=公园&region=重庆&size=26",token,null,400);
        call("GET","/api/trips?page=0",token,null,400);
        call("GET","/api/trips?status=UNKNOWN",token,null,400);
    }
    @Test void aiImportRollsBackAfterPartialWriteFailure() throws Exception {
        String id=draft();
        org.springframework.test.context.transaction.TestTransaction.flagForCommit();
        org.springframework.test.context.transaction.TestTransaction.end();
        try {
            doThrow(new IllegalStateException("simulated storage failure")).when(itinerary)
                .ensureDay(Long.valueOf(tripId),LocalDate.parse("2026-12-02"));
            call("POST","/api/ai/plans/"+id+"/save",token,new Save(Long.valueOf(tripId),false,plannedDays()),500);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM trip_day",Integer.class)).isZero();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM itinerary_item",Integer.class)).isZero();
            assertThat(jdbc.queryForObject("SELECT status FROM ai_plan_record",String.class)).isEqualTo("DRAFT");
        } finally {
            jdbc.update("DELETE FROM `user` WHERE username IN ('owner','other')");
        }
    }

    @Test void sqlPaginationAndLiteralKeywordFiltering() throws Exception {
        String second=createTrip(token), third=createTrip(token);
        createTrip(otherToken);
        var firstPage=call("GET","/api/trips?page=1&size=2",token,null,200).path("data");
        var nextPage=call("GET","/api/trips?page=2&size=2",token,null,200).path("data");
        assertThat(firstPage.path("total").asLong()).isEqualTo(3);
        assertThat(firstPage.path("list").size()).isEqualTo(2);
        assertThat(firstPage.path("list").get(0).path("tripId").asText()).isEqualTo(third);
        assertThat(nextPage.path("list").get(0).path("tripId").asText()).isEqualTo(tripId);
        assertThat(call("GET","/api/trips?page=3&size=2",token,null,200).path("data").path("list").isEmpty()).isTrue();
        call("PATCH","/api/trips/"+second,token,Map.of("title","100%_独特行程"),200);
        // Use an explicit request parameter to avoid URI double-encoding differences across clients.
        String result=mvc.perform(get("/api/trips").param("keyword","%_").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(result).path("data").path("total").asLong()).isEqualTo(1);
        LocalDate today=LocalDate.now(java.time.ZoneId.of("Asia/Shanghai"));
        call("PATCH","/api/trips/"+second,token,Map.of("startDate",today.toString(),"endDate",today.toString()),200);
        var ongoing=call("GET","/api/trips?status=ONGOING",token,null,200).path("data").path("list");
        assertThat(ongoing.toString()).contains(second);
        for(JsonNode row:ongoing) assertThat(row.path("tripStatus").asText()).isEqualTo("ONGOING");
    }

    @Test void paginatedAttractionsAndFavoritesKeepOwnerFlags() throws Exception {
        String a=call("POST","/api/attractions",token,Map.of("name","山顶甲","city","重庆"),201).path("data").path("attractionId").asText();
        call("POST","/api/attractions",token,Map.of("name","山顶乙","city","重庆"),201);
        call("POST","/api/attractions",otherToken,Map.of("name","山顶丙","city","成都"),201);
        call("POST","/api/favorites",otherToken,Map.of("attractionId",a),201);
        var mine=call("GET","/api/attractions?mineOnly=true&size=1&page=2",token,null,200).path("data");
        assertThat(mine.path("total").asInt()).isEqualTo(2);
        assertThat(mine.path("list").get(0).path("isOwner").asBoolean()).isTrue();
        assertThat(mine.path("list").get(0).has("favoriteCreatedAt")).isFalse();
        var favorites=call("GET","/api/favorites?city=重庆&keyword=山顶&size=1",otherToken,null,200).path("data");
        assertThat(favorites.path("total").asInt()).isEqualTo(1);
        JsonNode attraction=favorites.path("list").get(0).path("attraction");
        assertThat(attraction.path("isFavorited").asBoolean()).isTrue();
        assertThat(attraction.path("isOwner").asBoolean()).isFalse();
        assertThat(attraction.path("attractionId").isTextual()).isTrue();
        assertThat(call("GET","/api/favorites",token,null,200).path("data").path("total").asInt()).isZero();
    }

    @Test void expensePaginationAndAggregatesRespectFiltersAndOwnership() throws Exception {
        call("POST","/api/trips/"+tripId+"/expenses",token,expense(),201);
        call("POST","/api/trips/"+tripId+"/expenses",token,Map.of("category","HOTEL","amount",300,"spentOn","2026-12-02"),201);
        String otherTrip=createTrip(otherToken);
        call("POST","/api/trips/"+otherTrip+"/expenses",otherToken,Map.of("category","FOOD","amount",999,"spentOn","2026-12-01"),201);
        var page=call("GET","/api/trips/"+tripId+"/expenses?size=1&page=2",token,null,200).path("data");
        assertThat(page.path("total").asInt()).isEqualTo(2);
        assertThat(page.path("list").get(0).path("category").asText()).isEqualTo("FOOD");
        var filtered=call("GET","/api/trips/"+tripId+"/expenses?category=HOTEL&startDate=2026-12-02&endDate=2026-12-02",token,null,200).path("data");
        assertThat(filtered.path("total").asInt()).isEqualTo(1);
        var categories=call("GET","/api/statistics/expense-categories",token,null,200).path("data");
        assertThat(categories.path("totalAmount").decimalValue()).isEqualByComparingTo("365");
        assertThat(categories.path("items").size()).isEqualTo(2);
        call("GET","/api/statistics/expense-categories?tripId="+otherTrip,token,null,404);
        var summary=call("GET","/api/trips/"+tripId+"/budget-summary",token,null,200).path("data");
        assertThat(summary.path("categoryTotals").size()).isEqualTo(2);
        assertThat(summary.path("remainingBudget").decimalValue()).isEqualByComparingTo("1135");
        assertThat(call("GET","/api/statistics/trip-costs?limit=1",token,null,200).path("data").path("items").get(0).path("actualExpense").decimalValue()).isEqualByComparingTo("365");
    }

    @Test void planHistoryUsesFilteredCountsAndDoesNotIncludeLargeDrafts() throws Exception {
        draft(); draft();
        when(ai.generate(any())).thenThrow(new com.travel.common.BusinessException(504,"测试超时"));
        call("POST","/api/ai/plans",token,generate(),504);
        var page=call("GET","/api/ai/plans?status=DRAFT&size=1&page=2",token,null,200).path("data");
        assertThat(page.path("total").asInt()).isEqualTo(2);
        assertThat(page.path("list").size()).isEqualTo(1);
        assertThat(page.path("list").get(0).has("days")).isFalse();
        assertThat(call("GET","/api/ai/plans?status=FAILED",token,null,200).path("data").path("total").asInt()).isEqualTo(1);
        assertThat(call("GET","/api/ai/plans",otherToken,null,200).path("data").path("total").asInt()).isZero();
    }

    @Test void emptyStatisticsAreNumbersAndCollections() throws Exception {
        var overview=call("GET","/api/statistics/overview",otherToken,null,200).path("data");
        assertThat(overview.path("totalTrips").asLong()).isZero();
        assertThat(overview.path("totalBudget").decimalValue()).isEqualByComparingTo("0");
        assertThat(overview.path("totalActualExpense").decimalValue()).isEqualByComparingTo("0");
        assertThat(call("GET","/api/statistics/expense-categories",otherToken,null,200).path("data").path("items").isArray()).isTrue();
        assertThat(call("GET","/api/statistics/budget-comparison",otherToken,null,200).path("data").path("items").isEmpty()).isTrue();
    }

    @Test void expiredJwtIsRejected() throws Exception {
        var clock=java.time.Clock.fixed(java.time.Instant.now().minusSeconds(90000),java.time.ZoneId.of("Asia/Shanghai"));
        var jwt=new com.travel.security.JwtService("test-secret-only-32-bytes-minimum-123456789",86400,clock);
        call("GET","/api/trips",jwt.issue(1L),null,401);
    }
    @Test void retiredDistanceEndpointsAreUnavailable() throws Exception {
        call("POST","/api/pois/route",token,Map.of(),404);
        call("POST","/api/pois/routes",token,Map.of(),404);
    }
}
