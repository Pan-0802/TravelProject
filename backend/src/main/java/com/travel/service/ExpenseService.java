package com.travel.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.travel.common.*;
import com.travel.domain.*;
import com.travel.dto.Requests.*;
import com.travel.dto.ReadModels.ExpenseFilter;
import com.travel.security.CurrentUser;
import com.travel.mapper.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ExpenseService {
    private final TripService trips;
    private final ExpenseMapper expenses;
    private final QueryMapper queries;
    private final ReadMapper reads;
    private final WriteSupport writes;
    private Expense owned(Long id) {
        Expense e=expenses.find(id); if(e==null) throw BusinessException.missing(); trips.owned(e.getTripId(),false); return e;
    }
    public PageResult<Expense> list(Long tripId,int page,int size,Category category,LocalDate start,LocalDate end) {
        trips.owned(tripId,false); PageResult.validate(page,size);
        if(start!=null && end!=null) WriteSupport.range(start,end);
        var filter=new ExpenseFilter(tripId,category==null?null:category.name(),start,end);
        return new PageResult<>(reads.expenses(filter,(long)(page-1)*size,size),reads.countExpenses(filter),page,size);
    }
    private void apply(ExpenseWrite dto,Expense e,Trip trip) {
        WriteSupport.inRange(dto.getSpentOn(),trip.getStartDate(),trip.getEndDate());
        BeanUtils.copyProperties(dto,e); e.setCategory(dto.getCategory().name());
    }
    @Transactional public Expense create(Long tripId,ExpenseWrite dto) {
        Trip trip=trips.owned(tripId,true); Expense e=new Expense(); apply(dto,e,trip); e.setTripId(tripId); expenses.insert(e); return expenses.find(e.getExpenseId());
    }
    @Transactional public Expense patch(Long id,JsonNode patch) {
        Expense snapshot=owned(id); Trip trip=trips.owned(snapshot.getTripId(),true); Expense e=owned(id);
        // Convert the database category string into the write DTO's enum before merging.
        ExpenseWrite current=new ExpenseWrite(); BeanUtils.copyProperties(e,current); current.setCategory(Category.valueOf(e.getCategory()));
        ExpenseWrite dto=writes.patch(current,patch,ExpenseWrite.class); apply(dto,e,trip); expenses.update(e); return expenses.find(id);
    }
    @Transactional public Map<String,Boolean> delete(Long id) {
        Expense e=owned(id); trips.owned(e.getTripId(),true); owned(id); expenses.delete(id); return Map.of("deleted",true);
    }
    public Map<String,Object> summary(Long tripId) {
        Trip trip=trips.owned(tripId,false); BigDecimal actual=queries.actual(tripId), remaining=trip.getTotalBudget().subtract(actual);
        return Map.of("tripId",tripId.toString(),"totalBudget",trip.getTotalBudget(),"actualExpense",actual,
            "remainingBudget",remaining,"overBudget",remaining.signum()<0,"categoryTotals",reads.categories(CurrentUser.id(),tripId));
    }
}
