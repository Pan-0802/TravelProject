package com.travel;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import java.time.Clock;
import java.time.ZoneId;

@SpringBootApplication(exclude = org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration.class)
@MapperScan("com.travel.mapper")
public class TravelApplication {
    public static void main(String[] args) { SpringApplication.run(TravelApplication.class, args); }
    @Bean Clock businessClock() { return Clock.system(ZoneId.of("Asia/Shanghai")); }
}
