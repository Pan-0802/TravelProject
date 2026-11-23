package com.travel.common;

import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateTimeSerializer;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.*;
import java.time.format.DateTimeFormatter;

@Configuration
public class JsonConfig {
    @Bean Jackson2ObjectMapperBuilderCustomizer timestampFormat() {
        return builder -> builder.serializers(new LocalDateTimeSerializer(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss")));
    }
}
