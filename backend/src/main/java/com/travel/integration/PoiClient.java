package com.travel.integration;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import com.travel.common.BusinessException;
import org.springframework.stereotype.Component;
import org.springframework.web.client.*;

/** Deliberately has no Mapper/cache dependency: live POIs never enter local tables. */
@Component
public class PoiClient {
    private final AmapGateway gateway;
    private final ObjectMapper json;
    public PoiClient(ObjectMapper json,AmapGateway gateway) {
        this.json=json;this.gateway=gateway;
    }
    public ObjectNode search(String keywords,String region,boolean cityLimit,int page,int size) {
        if(keywords.isBlank() || keywords.length()>80 || keywords.contains("|") || region.isBlank() || region.length()>80 || page<1 || size<1 || size>25)
            throw new BusinessException(400,"搜索关键词、区域或分页参数不合法");
        try {
            JsonNode response=gateway.get("/v5/place/text",java.util.Map.of("keywords",keywords,"region",region,"city_limit",cityLimit,"page_num",page,"page_size",size));
            ObjectNode result=json.createObjectNode(); result.put("source","AMAP_LIVE"); result.put("page",page); result.put("size",size);
            ArrayNode list=result.putArray("list");
            for(JsonNode poi:response.path("pois")) {
                ObjectNode item=list.addObject();
                for(String field:java.util.List.of("name","address","type")) item.put(field,poi.path(field).asText(""));
                item.put("id",poi.path("id").asText(""));
                item.put("city",poi.path("cityname").asText("")); item.put("district",poi.path("adname").asText(""));
                item.putNull("longitude"); item.putNull("latitude");
                String[] xy=poi.path("location").asText().split(",");
                if(xy.length==2) try {
                    var lon=new java.math.BigDecimal(xy[0]); var lat=new java.math.BigDecimal(xy[1]);
                    if(lon.abs().compareTo(java.math.BigDecimal.valueOf(180))<=0 && lat.abs().compareTo(java.math.BigDecimal.valueOf(90))<=0) {
                        item.put("longitude",lon); item.put("latitude",lat);
                    }
                } catch(NumberFormatException ignored) { }
            }
            return result;
        } catch(RestClientResponseException e) { throw new BusinessException(e.getStatusCode().value()==429?429:502,"高德外部服务请求失败"); }
        catch(ResourceAccessException e) { throw new BusinessException(504,"高德服务连接失败或超时"); }
        catch(BusinessException e) { throw e; }
        catch(Exception e) {
            if(ExternalErrors.isTimeout(e)) throw new BusinessException(504,"高德服务连接失败或超时");
            throw new BusinessException(502,"高德响应结构不可解析");
        }
    }
}
