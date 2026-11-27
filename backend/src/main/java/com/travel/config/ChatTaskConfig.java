package com.travel.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.security.concurrent.DelegatingSecurityContextRunnable;

@Configuration
public class ChatTaskConfig {
    /** Bounded queue prevents a burst of model requests from exhausting DB/request threads. */
    @Bean("chatExecutor")
    public ThreadPoolTaskExecutor chatExecutor() {
        var executor=new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);executor.setMaxPoolSize(4);executor.setQueueCapacity(16);
        executor.setThreadNamePrefix("travel-chat-");
        executor.setTaskDecorator(DelegatingSecurityContextRunnable::new);
        executor.setWaitForTasksToCompleteOnShutdown(true);executor.setAwaitTerminationSeconds(15);
        return executor;
    }
}
