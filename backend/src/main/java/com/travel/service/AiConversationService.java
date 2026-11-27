package com.travel.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.travel.common.*;
import com.travel.domain.*;
import com.travel.dto.AiRequests.*;
import com.travel.dto.ChatRequests.*;
import com.travel.integration.AiChatClient;
import com.travel.mapper.AiConversationMapper;
import com.travel.security.CurrentUser;
import org.springframework.jdbc.BadSqlGrammarException;
import com.travel.mapper.SchemaProbe;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.core.task.TaskRejectedException;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

@Service
public class AiConversationService {
    private final AiConversationMapper chats;
    private final AiPlanService plans;
    private final AiChatClient client;
    private final ObjectMapper json;
    private final WriteSupport writes;
    private final Clock clock;
    private final SchemaProbe schema;
    private final TransactionTemplate tx;
    private final TaskExecutor worker;
    private volatile boolean schemaReady;

    public AiConversationService(AiConversationMapper chats,AiPlanService plans,AiChatClient client,
        ObjectMapper json,WriteSupport writes,Clock clock,SchemaProbe schema,PlatformTransactionManager manager,
        @Qualifier("chatExecutor") TaskExecutor worker) {
        this.chats=chats;this.plans=plans;this.client=client;this.json=json;
        this.writes=writes;this.clock=clock;this.schema=schema;this.tx=new TransactionTemplate(manager);
        this.worker=worker;
    }
    private void ensureSchema() {
        if(schemaReady) return;
        try {
            schema.requireChat();
            schemaReady=true;
        } catch(BadSqlGrammarException e) {
            throw new BusinessException(503,"聊天数据库尚未升级，请执行04_AI多轮会话_增量升级.sql后重试");
        }
    }
    private String encode(Object value) {
        try {return json.writeValueAsString(value);} catch(Exception e) {throw new BusinessException(500,"会话内容保存失败");}
    }
    private <T> T decode(String value,Class<T> type) {
        try {return json.readValue(value,type);} catch(Exception e) {throw new BusinessException(500,"会话历史无法读取");}
    }
    private List<Day> decodeDays(String value) {
        if(value==null) return null;
        try {return json.readValue(value,new TypeReference<List<Day>>(){});} catch(Exception e) {throw new BusinessException(500,"会话方案无法读取");}
    }
    private AiConversation owned(Long id,boolean lock) {
        AiConversation row=lock?chats.lock(id):chats.find(id);
        if(row==null || !row.getUserId().equals(CurrentUser.id())) throw BusinessException.missing();
        return row;
    }
    private Generate cleanConditions(Generate r) {
        return new Generate(r.tripId(),r.destination(),r.startDate(),r.endDate(),r.travelDays(),r.totalBudget(),r.transportation(),r.preferences(),r.requirements());
    }
    public ObjectNode create(Create request) {
        ensureSchema();
        if((request.conditions()==null)==(request.aiPlanId()==null)) throw new BusinessException(400,"请提供旅行条件或已有方案，不能同时提供");
        return tx.execute(status -> {
            Generate conditions=request.conditions();
            ObjectNode source=null;
            if(request.aiPlanId()!=null) {
                source=plans.detail(request.aiPlanId()); // Ownership checked before looking up a session.
                AiConversation existing=chats.forPlan(CurrentUser.id(),request.aiPlanId());
                if(existing!=null && request.currentDays()==null) return view(existing);
                try {conditions=json.treeToValue(source.path("request"),Generate.class);}
                catch(Exception e) {throw new BusinessException(422,"旧方案缺少规划条件，请新建会话");}
                if(source.path("status").asText().equals("FAILED")) throw new BusinessException(422,"生成失败的方案无法作为会话起点");
            }
            plans.validateConditions(conditions);
            AiConversation row=new AiConversation(); row.setUserId(CurrentUser.id());
            row.setTitle((conditions.destination()+" · "+conditions.travelDays()+"天旅行").substring(0,Math.min(120,(conditions.destination()+" · "+conditions.travelDays()+"天旅行").length())));
            row.setConditionsJson(encode(cleanConditions(conditions)));row.setMemory("");
            if(source!=null) {row.setCurrentPlanId(request.aiPlanId());row.setCurrentDaysJson(source.path("days").toString());}
            if(request.currentDays()!=null) {plans.validateDays(request.currentDays(),conditions.startDate(),conditions.endDate());row.setCurrentDaysJson(encode(request.currentDays()));}
            chats.insert(row);
            return view(chats.find(row.getConversationId()));
        });
    }
    public PageResult<ObjectNode> list(int page,int size) {
        ensureSchema();PageResult.validate(page,size);
        var rows=chats.list(CurrentUser.id(),(long)(page-1)*size,size).stream().map(this::header).toList();
        return new PageResult<>(rows,chats.count(CurrentUser.id()),page,size);
    }
    private ObjectNode header(AiConversation row) {
        ObjectNode out=json.createObjectNode();out.put("conversationId",row.getConversationId().toString());
        out.put("title",row.getTitle());out.put("version",row.getVersion());
        out.set("createdAt",json.valueToTree(row.getCreatedAt()));out.set("updatedAt",json.valueToTree(row.getUpdatedAt()));
        out.put("processing",row.getActiveRequestId()!=null);
        return out;
    }
    private ObjectNode view(AiConversation row) {
        ObjectNode out=header(row);out.set("conditions",json.valueToTree(decode(row.getConditionsJson(),Generate.class)));
        out.put("memory",row.getMemory());
        out.set("currentPlan",row.getCurrentPlanId()==null?json.nullNode():plans.detail(row.getCurrentPlanId()));
        out.set("currentDays",row.getCurrentDaysJson()==null?json.nullNode():json.valueToTree(decodeDays(row.getCurrentDaysJson())));
        var messages=out.putArray("messages");
        for(AiChatMessage message:chats.messages(row.getConversationId())) {
            ObjectNode node=messages.addObject();node.put("messageId",message.getMessageId().toString());
            node.put("requestId",message.getRequestId());node.put("role",message.getRole());node.put("content",message.getContent());node.put("status",message.getStatus());
            node.set("errorMessage",json.valueToTree(message.getErrorMessage()));
            node.set("planId",message.getPlanId()==null?json.nullNode():json.valueToTree(message.getPlanId().toString()));
            node.set("createdAt",json.valueToTree(message.getCreatedAt()));
        }
        return out;
    }
    private void expire(AiConversation row) {
        if(row.getActiveRequestId()==null || row.getStartedAt()==null || row.getStartedAt().isAfter(LocalDateTime.now(clock).minusMinutes(3))) return;
        AiChatMessage pending=chats.request(row.getConversationId(),row.getActiveRequestId());
        if(pending!=null) {pending.setStatus("FAILED");pending.setErrorMessage("上次请求处理超时，请确认后手动重试");chats.updateMessage(pending);}
        row.setActiveRequestId(null);row.setStartedAt(null);row.setVersion(row.getVersion()+1);chats.update(row);
    }
    public ObjectNode detail(Long id) {
        ensureSchema();
        return tx.execute(status -> {AiConversation row=owned(id,true);expire(row);return view(row);});
    }
    public Map<String,Boolean> delete(Long id) {
        ensureSchema();
        return tx.execute(status -> {AiConversation row=owned(id,true);expire(row);
            if(row.getActiveRequestId()!=null) throw new BusinessException(409,"回复正在生成，请稍后再删除会话");
            chats.delete(id);return Map.of("deleted",true);});
    }
    private record Work(Context context,boolean replay) {}
    public ObjectNode edit(Long id,Edit request) {
        ensureSchema();
        return tx.execute(status -> {
            AiConversation row=owned(id,true);expire(row);
            if(row.getActiveRequestId()!=null || row.getVersion()!=request.expectedVersion()) throw new BusinessException(409,"会话正在处理或已更新，请刷新后重试");
            if(row.getCurrentPlanId()==null || !plans.detail(row.getCurrentPlanId()).path("status").asText().equals("DRAFT")) throw new BusinessException(409,"当前方案不能编辑，请生成新草稿");
            Generate conditions=decode(row.getConditionsJson(),Generate.class);
            plans.validateDays(request.days(),conditions.startDate(),conditions.endDate());
            row.setCurrentDaysJson(encode(request.days()));row.setVersion(row.getVersion()+1);chats.update(row);
            return view(row);
        });
    }
    private Work reserve(Long id,Send request) {
        AiConversation row=owned(id,true);expire(row);
        AiChatMessage previous=chats.request(id,request.requestId());
        if(previous!=null) {
            if(!previous.getContent().equals(request.content().trim())) throw new BusinessException(409,"同一请求标识不能用于不同消息");
            if(previous.getStatus().equals("COMPLETED")) return new Work(null,true);
            throw new BusinessException(409,previous.getStatus().equals("PENDING")?"消息仍在处理中，请刷新会话确认结果":"该发送已失败，请使用重试按钮重新发送");
        }
        if(row.getActiveRequestId()!=null) throw new BusinessException(409,"会话已有消息正在处理，请等待回复");
        if(row.getVersion()!=request.expectedVersion()) throw new BusinessException(409,"会话已在其他窗口更新，请刷新后再发送");
        if(chats.messageCount(id)>=198) throw new BusinessException(422,"此会话已达到消息上限，请新建会话继续");
        Generate conditions=decode(row.getConditionsJson(),Generate.class);
        List<Day> current=request.currentDays()!=null?request.currentDays():decodeDays(row.getCurrentDaysJson());
        if(current!=null) {plans.validateDays(current,conditions.startDate(),conditions.endDate());row.setCurrentDaysJson(encode(current));}
        List<AiChatMessage> recent=new ArrayList<>(chats.recent(id));Collections.reverse(recent);
        List<Message> history=new ArrayList<>();
        for(AiChatMessage m:recent) history.add(new Message(m.getRole(),m.getContent()));
        history.add(new Message("user",request.content().trim()));
        AiChatMessage message=new AiChatMessage();message.setConversationId(id);message.setRequestId(request.requestId());
        message.setRole("user");message.setContent(request.content().trim());message.setStatus("PENDING");chats.insertMessage(message);
        row.setActiveRequestId(request.requestId());row.setStartedAt(LocalDateTime.now(clock));row.setVersion(row.getVersion()+1);chats.update(row);
        Draft currentPlan=current==null?null:new Draft(current.stream().flatMap(d->d.items().stream()).map(i->i.getEstimatedCost()==null?BigDecimal.ZERO:i.getEstimatedCost()).reduce(BigDecimal.ZERO,BigDecimal::add),current);
        return new Work(new Context(conditions,currentPlan,row.getMemory(),request.intent(),history),false);
    }
    private void complete(Long id,Send request,Reply reply) {
        AiConversation row=owned(id,true);
        if(!request.requestId().equals(row.getActiveRequestId())) throw new BusinessException(409,"此回复已过期，请刷新查看会话");
        if(reply.plan()!=null) {
            ObjectNode plan=plans.storeChatDraft(decode(row.getConditionsJson(),Generate.class),reply.plan());
            row.setCurrentPlanId(Long.valueOf(plan.path("aiPlanId").asText()));row.setCurrentDaysJson(plan.path("days").toString());
        }
        AiChatMessage user=chats.request(id,request.requestId());user.setStatus("COMPLETED");chats.updateMessage(user);
        AiChatMessage assistant=new AiChatMessage();assistant.setConversationId(id);assistant.setRequestId(request.requestId());assistant.setRole("assistant");assistant.setStatus("COMPLETED");assistant.setContent(reply.reply());
        if(reply.plan()!=null) assistant.setPlanId(row.getCurrentPlanId());chats.insertMessage(assistant);
        row.setMemory(reply.memory());row.setActiveRequestId(null);row.setStartedAt(null);row.setVersion(row.getVersion()+1);chats.update(row);
    }
    private void failed(Long id,String requestId,String reason) {
        tx.executeWithoutResult(status -> {
            AiConversation row=owned(id,true);
            if(!requestId.equals(row.getActiveRequestId())) return;
            AiChatMessage message=chats.request(id,requestId);message.setStatus("FAILED");message.setErrorMessage(reason.substring(0,Math.min(255,reason.length())));chats.updateMessage(message);
            row.setActiveRequestId(null);row.setStartedAt(null);row.setVersion(row.getVersion()+1);chats.update(row);
        });
    }
    public ObjectNode send(Long id,Send request) {
        ensureSchema();writes.validate(request);
        Work work=tx.execute(status -> reserve(id,request));
        if(work.replay()) return detail(id);
        process(id,request,work);
        return detail(id);
    }
    /** Persist a receipt before dispatch; refresh/retry never needs to re-bill an accepted message. */
    public ObjectNode submit(Long id,Send request) {
        ensureSchema();writes.validate(request);
        Work work=tx.execute(status -> reserve(id,request));
        ObjectNode receipt=detail(id);
        if(work.replay()) return receipt;
        try {
            worker.execute(() -> {
                try { process(id,request,work); }
                catch(RuntimeException ignored) { /* Failure is durable and returned by detail/polling. */ }
            });
        } catch(TaskRejectedException e) {
            failed(id,request.requestId(),"当前生成任务较多，请稍后使用重试按钮");
            throw new BusinessException(503,"当前生成任务较多，请稍后重试；本条消息未调用模型");
        }
        return receipt;
    }
    private void process(Long id,Send request,Work work) {
        try {
            // The connection/row lock is released while waiting for the external model.
            Reply reply=client.reply(work.context());
            if(reply==null) throw new BusinessException(502,"AI 返回空回复");
            try {writes.validate(reply);} catch(BusinessException e) {throw new BusinessException(502,"AI 回复格式或方案字段不合法");}
            if(request.intent().equals("ASK") && reply.plan()!=null) throw new BusinessException(502,"AI 问答意外返回了修改方案，当前方案已保留");
            if(request.intent().equals("REVISE") && reply.plan()==null) throw new BusinessException(502,"AI 未返回完整方案，请调整描述后重试");
            if(reply.plan()!=null) plans.validateGeneratedDraft(reply.plan(),work.context().conditions());
            tx.executeWithoutResult(status -> complete(id,request,reply));
        } catch(RuntimeException e) {
            try {failed(id,request.requestId(),e instanceof BusinessException?e.getMessage():"本次回复保存失败，请稍后重试");} catch(RuntimeException ignored) { /* Preserve original error; lease recovery handles DB outages. */ }
            throw e;
        }
    }
}
