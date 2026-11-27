package com.travel.integration;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import com.travel.common.BusinessException;
import com.travel.dto.AiRequests.*;
import com.travel.dto.ChatRequests.*;
import org.slf4j.*;
import java.math.*;
import java.time.*;
import java.util.*;
import java.util.regex.Pattern;

/** Tolerates harmless model formatting, while keeping request validation and business rules strict. */
final class AiResponseDecoder {
    private static final Logger log=LoggerFactory.getLogger(AiResponseDecoder.class);
    private static final Pattern FENCE=Pattern.compile("^```(?:json)?\\s*(.*?)\\s*```$",Pattern.DOTALL|Pattern.CASE_INSENSITIVE);
    private static final Pattern NUMBER=Pattern.compile("-?(?:0|[1-9]\\d*)(?:\\.\\d+)?(?:[eE][+-]?\\d+)?");
    private final ObjectMapper json;
    private final ObjectMapper reader;
    AiResponseDecoder(ObjectMapper json) {
        this.json=json;this.reader=json.copy().enable(DeserializationFeature.FAIL_ON_READING_DUP_TREE_KEY)
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    }
    private JsonNode body(JsonNode envelope) {
        JsonNode choice=envelope==null?json.nullNode():envelope.path("choices").path(0);
        String finish=choice.path("finish_reason").asText("");
        String content=choice.path("message").path("content").asText("").strip();
        if(finish.equals("length")) {
            log.warn("AI output truncated: chars={}",content.length());
            throw new BusinessException(502,"AI 回复被长度限制截断，原方案已保留。请缩小本次调整范围后重试");
        }
        if(content.isBlank())throw new BusinessException(502,"AI 未返回有效内容，原方案已保留，请稍后重试");
        var fence=FENCE.matcher(content);if(fence.matches())content=fence.group(1).strip();
        try {
            JsonNode node=reader.readTree(content);
            if(!node.isObject())throw new IllegalArgumentException("root must be an object");
            return node;
        } catch(Exception e) {
            // Some providers emit 2" instead of 2, or a final comma, even in JSON mode.
            // Remove only these unambiguous punctuation errors outside strings, then parse strictly again.
            // Never add missing values/brackets or complete truncated output.
            String normalized=singleObject(punctuation(content));
            if(!normalized.equals(content))try {
                JsonNode node=reader.readTree(normalized);
                if(node.isObject()) {log.info("AI JSON wrapper/punctuation normalized: removed={}",content.length()-normalized.length());return node;}
            } catch(Exception ignored) { /* The original failure is reported below. */ }
            log.warn("AI JSON rejected: finish={}, chars={}, category={}",finish,content.length(),e.getClass().getSimpleName());
            throw new BusinessException(502,"AI 返回的内容不完整，原方案已保留，请重试本条消息");
        }
    }
    /** Read one complete object; surrounding non-JSON commentary has no authority or business meaning. */
    private String singleObject(String source) {
        if(!source.startsWith("{"))return source;
        Deque<Character> stack=new ArrayDeque<>();boolean quoted=false,escape=false;
        for(int i=0;i<source.length();i++) {
            char c=source.charAt(i);
            if(quoted) {if(escape)escape=false;else if(c=='\\')escape=true;else if(c=='"')quoted=false;continue;}
            if(c=='"')quoted=true;
            else if(c=='{'||c=='[')stack.push(c);
            else if(c=='}'||c==']') {
                if(stack.isEmpty()||stack.pop()!=(c=='}'?'{':'['))return source;
                if(stack.isEmpty()) {
                    String tail=source.substring(i+1).strip();
                    // Another object/array or a broken closing delimiter is ambiguous and must fail.
                    if(tail.chars().anyMatch(t->"{}[]".indexOf(t)>=0))return source;
                    return source.substring(0,i+1);
                }
            }
        }
        return source; // No balancing or completion of truncated content.
    }
    private String punctuation(String source) {
        StringBuilder out=new StringBuilder();boolean quoted=false,escape=false;
        for(int i=0;i<source.length();) {
            char c=source.charAt(i);
            if(quoted) {
                out.append(c);i++;
                if(escape)escape=false;else if(c=='\\')escape=true;else if(c=='"')quoted=false;
            } else if(c=='"') {quoted=true;out.append(c);i++;}
            else if(c==',' && "]}".indexOf(next(source,i+1))>=0) {i++;}
            else if(c=='-'||Character.isDigit(c)) {
                var number=NUMBER.matcher(source).region(i,source.length());
                if(!number.lookingAt()) {out.append(c);i++;continue;}
                out.append(number.group());i=number.end();
                if(i<source.length()&&source.charAt(i)=='"'&&",]}".indexOf(next(source,i+1))>=0)i++;
            } else {out.append(c);i++;}
        }
        return out.toString();
    }
    private char next(String source,int i) {while(i<source.length()&&Character.isWhitespace(source.charAt(i)))i++;return i<source.length()?source.charAt(i):'\0';}
    Reply reply(JsonNode envelope,Context context) {
        JsonNode root=body(envelope),plan=root.path("plan");
        if(plan.isMissingNode()&&root.path("days").isArray())plan=root;
        Draft draft=null;
        if(!plan.isNull()&&!plan.isMissingNode())draft=draft(plan,context.conditions());
        String answer=text(root.path("reply"));
        if(answer.isBlank())answer=text(root.path("answer"));
        if(answer.isBlank()&&draft!=null)answer="已根据要求生成"+draft.days().size()+"天方案，请查看右侧行程。";
        if(answer.isBlank())throw new BusinessException(502,"AI 没有给出有效回答，原方案已保留，请重试");
        String memory=text(root.path("memory"));if(memory.isBlank())memory=context.memory();
        return new Reply(limit(answer,4000),limit(memory,2000),draft);
    }
    Draft generated(JsonNode envelope,Generate request) {return draft(body(envelope),request);}
    private Draft draft(JsonNode source,Generate request) {
        if(!source.isObject()||!source.path("days").isArray())throw new BusinessException(502,"AI 没有返回完整的每日行程，原方案已保留");
        ObjectNode out=json.createObjectNode();ArrayNode days=out.putArray("days");BigDecimal sum=BigDecimal.ZERO;
        try {
            for(JsonNode day:source.path("days")) {
                ObjectNode normalized=days.addObject();
                LocalDate date=LocalDate.parse(day.path("date").asText());normalized.put("date",date.toString());
                normalized.put("dayNumber",java.time.temporal.ChronoUnit.DAYS.between(request.startDate(),date)+1);
                normalized.put("description",limit(text(day.path("description")),255));
                if(!day.path("items").isArray())throw new IllegalArgumentException("items must be an array");
                ArrayNode items=normalized.putArray("items");int order=0;
                for(JsonNode item:day.path("items")) {
                    ObjectNode target=items.addObject();
                    target.put("itemName",text(item.path("itemName")));target.put("sortOrder",++order);
                    for(String field:List.of("startTime","endTime")) {String time=time(item.path(field));if(time==null)target.putNull(field);else target.put(field,time);}
                    for(String field:List.of("transportation","note"))target.put(field,limit(text(item.path(field)),field.equals("note")?500:60));
                    JsonNode price=item.path("estimatedCost");
                    BigDecimal cost=price.isNull()||price.isMissingNode()?BigDecimal.ZERO:new BigDecimal(price.asText()).setScale(2,RoundingMode.HALF_UP);
                    target.put("estimatedCost",cost);sum=sum.add(cost);
                    // Keep this field for the service's explicit rejection of model-made associations.
                    if(item.hasNonNull("attractionId"))target.set("attractionId",item.path("attractionId"));
                }
            }
            out.put("estimatedTotal",sum);
            return json.treeToValue(out,Draft.class);
        } catch(BusinessException e) {throw e;}
        catch(Exception e) {
            log.warn("AI plan fields rejected: category={}",e.getClass().getSimpleName());
            throw new BusinessException(502,"AI 返回的日期、时间或金额格式不正确，原方案已保留，请重试本条消息");
        }
    }
    private String time(JsonNode node) {
        if(node.isMissingNode()||node.isNull()||node.asText().isBlank())return null;
        String value=node.asText().strip().replace('：',':');
        if(!value.matches("(?:[01]?\\d|2[0-3]):[0-5]\\d(?::00)?"))throw new IllegalArgumentException("invalid minute time");
        String[] parts=value.split(":");return String.format(Locale.ROOT,"%02d:%02d",Integer.parseInt(parts[0]),Integer.parseInt(parts[1]));
    }
    private String text(JsonNode node) {
        if(node.isTextual())return node.asText().strip();
        if(node.isArray()) {List<String> values=new ArrayList<>();for(JsonNode part:node)if(part.isTextual())values.add(part.asText().strip());return String.join("；",values);}
        return "";
    }
    private String limit(String value,int length) {return value==null?"":value.length()>length?value.substring(0,length-1)+"…":value;}
}
