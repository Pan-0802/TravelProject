package com.travel.controller;
import com.travel.common.ApiResponse;
import com.travel.dto.ChatRequests.*;
import com.travel.service.AiConversationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;

@RestController
@RequestMapping("/api/ai/conversations")
@RequiredArgsConstructor
public class AiConversationController {
    private final AiConversationService chats;
    @PostMapping public ApiResponse<?> create(@Valid @RequestBody Create dto) {return ApiResponse.ok(chats.create(dto));}
    @GetMapping public ApiResponse<?> list(@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size) {return ApiResponse.ok(chats.list(page,size));}
    @GetMapping("/{id}") public ApiResponse<?> detail(@PathVariable Long id) {return ApiResponse.ok(chats.detail(id));}
    @PostMapping("/{id}/messages") public ApiResponse<?> send(@PathVariable Long id,@Valid @RequestBody Send dto) {return ApiResponse.ok(chats.send(id,dto));}
    @PostMapping("/{id}/messages/submit") public ResponseEntity<?> submit(@PathVariable Long id,@Valid @RequestBody Send dto) {
        return ResponseEntity.accepted().body(ApiResponse.ok(chats.submit(id,dto)));
    }
    @PutMapping("/{id}/draft") public ApiResponse<?> edit(@PathVariable Long id,@Valid @RequestBody Edit dto) {return ApiResponse.ok(chats.edit(id,dto));}
    @DeleteMapping("/{id}") public ApiResponse<?> delete(@PathVariable Long id) {return ApiResponse.ok(chats.delete(id));}
}
