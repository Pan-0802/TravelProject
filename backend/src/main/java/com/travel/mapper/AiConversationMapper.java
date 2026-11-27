package com.travel.mapper;
import com.travel.domain.*;
import org.apache.ibatis.annotations.Param;
import java.util.List;

public interface AiConversationMapper {
    AiConversation find(Long id);
    AiConversation lock(Long id);
    AiConversation forPlan(@Param("userId") Long userId,@Param("planId") Long planId);
    List<AiConversation> list(@Param("userId") Long userId,@Param("offset") long offset,@Param("limit") int limit);
    long count(Long userId);
    void insert(AiConversation row);
    void update(AiConversation row);
    void delete(Long id);
    List<AiChatMessage> messages(Long id);
    List<AiChatMessage> recent(Long id);
    int messageCount(Long id);
    AiChatMessage request(@Param("id") Long id,@Param("requestId") String requestId);
    void insertMessage(AiChatMessage row);
    void updateMessage(AiChatMessage row);
}
