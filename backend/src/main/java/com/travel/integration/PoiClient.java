package com.travel.integration;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import com.travel.common.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.*;

/** Deliberately has no Mapper/cache dependency: live POIs never enter local tables. */
@Component
public class PoiClient {
    private final RestClient http;
    private final String key;
    private final ObjectMapper json;
    public PoiClient(ObjectMapper json,@Value("${app.external.amap-key}") String key,@Value("${app.external.timeout-seconds}") int timeout) {
        this.key=key; this.json=json;
        var factory=new SimpleClientHttpRequestFactory(); factory.setConnectTimeout(10000); factory.setReadTimeout(timeout*1000);
        http=RestClient.builder().baseUrl("https://restapi.amap.com").requestFactory(factory).build();
    }
    public ObjectNode search(String keywords,String region,boolean cityLimit,int page,int size) {
        if(keywords.isBlank() || keywords.length()>80 || keywords.contains("|") || region.isBlank() || region.length()>80 || page<1 || size<1 || size>25)
            throw new BusinessException(400,"搜索关键词、区域或分页参数不合法");
        if(key.isBlank()) throw new BusinessException(503,"高德服务未配置 API Key");
        try {
            JsonNode response=http.get().uri(b -> b.path("/v5/place/text").queryParam("key",key).queryParam("keywords",keywords)
                .queryParam("region",region).queryParam("city_limit",cityLimit).queryParam("page_num",page).queryParam("page_size",size).build())
                .retrieve().body(JsonNode.class);
            if(response==null || !response.path("status").asText().equals("1") || !response.path("infocode").asText().equals("10000"))
                throw new BusinessException(response!=null && java.util.Set.of("10003","10004","10020","10021").contains(response.path("infocode").asText())?429:502,"高德查询失败，请稍后重试或检查服务配置");
            ObjectNode result=json.createObjectNode(); result.put("source","AMAP_LIVE"); result.put("page",page); result.put("size",size);
            ArrayNode list=result.putArray("list");
            for(JsonNode poi:response.path("pois")) {
                ObjectNode item=list.addObject();
                for(String field:java.util.List.of("name","address","type")) item.put(field,poi.path(field).asText(""));
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
