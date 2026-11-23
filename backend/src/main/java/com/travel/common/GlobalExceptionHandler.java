package com.travel.common;

import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(BusinessException.class)
    ResponseEntity<ApiResponse<Void>> business(BusinessException e) {
        return ResponseEntity.status(e.status).body(new ApiResponse<>(e.code(), e.getMessage(), null));
    }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiResponse<Void>> validation(MethodArgumentNotValidException e) {
        return business(new BusinessException(400, e.getBindingResult().getFieldErrors().get(0).getField() + " 参数不合法"));
    }
    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
        MissingServletRequestParameterException.class, IllegalArgumentException.class})
    ResponseEntity<ApiResponse<Void>> badRequest(Exception e) { return business(new BusinessException(400, "请求参数或格式不合法")); }
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiResponse<Void>> conflict(Exception e) { return business(new BusinessException(409, "数据重复或关联数据已变化，请刷新后重试")); }
    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<ApiResponse<Void>> notFound(Exception e) { return business(BusinessException.missing()); }
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<ApiResponse<Void>> method(Exception e) { return business(new BusinessException(405, "请求方法不支持")); }
    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiResponse<Void>> unexpected(Exception e) {
        // Keep diagnostic details in server logs; the HTTP response stays generic.
        log.error("Unhandled server error", e);
        return business(new BusinessException(500, "服务器异常，请稍后重试"));
    }
}
