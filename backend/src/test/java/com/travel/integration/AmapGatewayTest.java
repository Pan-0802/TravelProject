package com.travel.integration;

import com.travel.common.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.anything;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class AmapGatewayTest {
    @Test void totalServiceQpsCodeIsRetriedOnceThenReportedAsRateLimit() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();
        for(int i=0;i<2;i++)server.expect(anything()).andRespond(withSuccess("{\"status\":\"0\",\"infocode\":\"10019\"}",MediaType.APPLICATION_JSON));
        var client=new AmapGateway("test-only-key",builder,0);
        var error=assertThrows(BusinessException.class,()->client.get("/v5/place/text",Map.of("keywords","前门大街")));
        assertEquals(429,error.status);assertTrue(error.getMessage().contains("过于频繁"));assertFalse(error.getMessage().contains("test-only-key"));server.verify();
    }
    @Test void transientQpsLimitRecoversWithoutThirdRequest() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();
        server.expect(anything()).andRespond(withSuccess("{\"status\":\"0\",\"infocode\":\"10019\"}",MediaType.APPLICATION_JSON));
        server.expect(anything()).andRespond(withSuccess("{\"status\":\"1\",\"infocode\":\"10000\",\"pois\":[]}",MediaType.APPLICATION_JSON));
        assertEquals("1",new AmapGateway("test-only-key",builder,0).get("/v5/place/text",Map.of()).path("status").asText());server.verify();
    }
    @Test void missingPermissionIsNotRetried() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();
        server.expect(anything()).andRespond(withSuccess("{\"status\":\"0\",\"infocode\":\"10041\"}",MediaType.APPLICATION_JSON));
        var error=assertThrows(BusinessException.class,()->new AmapGateway("test-only-key",builder,0).get("/v5/place/text",Map.of()));
        assertEquals(503,error.status);server.verify();
    }
}
