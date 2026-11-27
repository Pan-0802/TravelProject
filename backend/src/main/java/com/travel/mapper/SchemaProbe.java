package com.travel.mapper;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** All schema probes stay in the data access layer; JDBC resources close deterministically. */
@Repository
@RequiredArgsConstructor
public class SchemaProbe {
    private final JdbcTemplate jdbc;
    public void requireUsers() {
        jdbc.execute((org.springframework.jdbc.core.ConnectionCallback<Void>) connection -> {
            try(var statement=connection.prepareStatement("SELECT user_id FROM `user` WHERE 1=0")) {
                statement.setQueryTimeout(2);
                try(var ignored=statement.executeQuery()) { return null; }
            }
        });
    }
    public void requireChat() {
        jdbc.queryForList("SELECT conversation_id,active_request_id FROM ai_conversation WHERE 1=0");
        jdbc.queryForList("SELECT message_id,request_id FROM ai_chat_message WHERE 1=0");
    }
}
