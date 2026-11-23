package com.travel.common;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Component;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

@Component
@RequiredArgsConstructor
public class WriteSupport {
    private final ObjectMapper json;
    private final Validator validator;
    public <T> T patch(Object current, JsonNode patch, Class<T> type) {
        if (!patch.isObject() || patch.isEmpty()) throw new BusinessException(400,"至少提供一个可修改字段");
        T dto;
        try {
            dto = type.getDeclaredConstructor().newInstance();
            BeanUtils.copyProperties(current,dto);
            ObjectNode base = json.valueToTree(dto);
            patch.fieldNames().forEachRemaining(key -> {
                if (!base.has(key)) throw new BusinessException(400,"不可修改字段：" + key);
                base.set(key,patch.get(key));
            });
            dto = json.treeToValue(base,type);
        } catch (BusinessException e) { throw e; }
        catch (Exception e) { throw new BusinessException(400,"请求字段格式不正确"); }
        validate(dto);
        return dto;
    }
    public void validate(Object dto) {
        var errors = validator.validate(dto);
        if (!errors.isEmpty()) throw new BusinessException(400, errors.iterator().next().getPropertyPath()+" 参数不合法");
    }
    public static void range(LocalDate start, LocalDate end) {
        if (end.isBefore(start)) throw new BusinessException(422,"结束日期不能早于开始日期");
    }
    public static void inRange(LocalDate date, LocalDate start, LocalDate end) {
        if (date.isBefore(start) || date.isAfter(end)) throw new BusinessException(422,"日期必须在旅行期间内");
    }
    public static void password(String value, String confirm) {
        if (!value.equals(confirm) || value.getBytes(StandardCharsets.UTF_8).length > 72)
            throw new BusinessException(400,"确认密码不一致或密码超过 72 字节");
    }
}
