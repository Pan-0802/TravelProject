package com.travel.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.travel.common.BusinessException;
import org.springframework.beans.factory.annotation.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

/** A fair queue for live POI searches. No provider responses are persisted. */
@Component
public class AmapGateway {
    private static final Set<String> QPS=Set.of("10014","10015","10019","10020","10021","10029");
    private final RestClient http;
    private final String key;
    private final int interval;
    private final ReentrantLock queue=new ReentrantLock(true);
    private long nextStart;

    @Autowired
    public AmapGateway(@Value("${app.external.amap-key}") String key,
        @Value("${app.external.amap-interval-millis:650}") int interval) {
        this(key,builder(),interval);
    }
    AmapGateway(String key,RestClient.Builder builder,int interval) {
        this.key=key;this.http=builder.baseUrl("https://restapi.amap.com").build();this.interval=Math.max(0,interval);
    }
    private static RestClient.Builder builder() {
        var factory=new SimpleClientHttpRequestFactory();factory.setConnectTimeout(3000);factory.setReadTimeout(7000);
        return RestClient.builder().requestFactory(factory);
    }
    public boolean configured() {return !key.isBlank();}
    public JsonNode get(String path,Map<String,?> parameters) {
        if(key.isBlank()) throw new BusinessException(503,"高德服务未配置，暂时无法查询地图");
        boolean locked=false;
        try {
            locked=queue.tryLock(25,TimeUnit.SECONDS);
            if(!locked) throw new BusinessException(429,"地图请求较多，请稍后重试");
            for(int attempt=0;attempt<2;attempt++) {
                long wait=nextStart-System.nanoTime();
                if(wait>0) TimeUnit.NANOSECONDS.sleep(wait);
                nextStart=System.nanoTime()+TimeUnit.MILLISECONDS.toNanos(interval);
                JsonNode response=http.get().uri(b->{b.path(path).queryParam("key",key);parameters.forEach(b::queryParam);return b.build();})
                    .retrieve().body(JsonNode.class);
                String code=response==null?"":response.path("infocode").asText();
                if(response!=null && response.path("status").asText().equals("1") && (code.isBlank()||code.equals("10000"))) return response;
                if(QPS.contains(code) && attempt==0) {nextStart=System.nanoTime()+TimeUnit.MILLISECONDS.toNanos(Math.max(1200,interval));continue;}
                throw error(code);
            }
            throw new BusinessException(429,"地图查询暂时限流，请稍后重试");
        } catch(InterruptedException e) {Thread.currentThread().interrupt();throw new BusinessException(503,"地图查询已中断，请重试");}
        catch(ResourceAccessException e) {throw new BusinessException(504,"地图查询超时，请稍后重试");}
        catch(RestClientResponseException e) {throw new BusinessException(e.getStatusCode().value()==429?429:502,"地图服务暂时不可用，请稍后重试");}
        catch(RestClientException e) {throw new BusinessException(502,"地图返回内容无法读取，请稍后重试");}
        finally {if(locked)queue.unlock();}
    }
    private BusinessException error(String code) {
        if(QPS.contains(code)) return new BusinessException(429,"地图查询过于频繁，已暂停后续请求，请稍后重试");
        if(Set.of("10003","10004","10044","10045").contains(code)) return new BusinessException(429,"地图查询额度暂不可用，请稍后重试或检查账户额度");
        if(Set.of("10001","10002","10005","10006","10007","10008","10009","10012","10013","10026","10041").contains(code))
            return new BusinessException(503,"地图服务配置或权限不可用，请联系维护者检查（"+code+"）");
        return new BusinessException(502,"地图服务暂时未能完成查询，请稍后重试"+(code.isBlank()?"":"（"+code+"）"));
    }
}
