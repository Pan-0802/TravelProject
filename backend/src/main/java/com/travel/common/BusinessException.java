package com.travel.common;

public class BusinessException extends RuntimeException {
    public final int status;
    private final java.util.Map<String,String> fieldErrors;
    public BusinessException(int status, String message) { this(status,message,java.util.Map.of()); }
    public BusinessException(int status, String message, java.util.Map<String,String> fields) {
        super(message); this.status=status; this.fieldErrors=java.util.Map.copyOf(fields);
    }
    public java.util.Map<String,String> fieldErrors() { return fieldErrors; }
    public int code() { return status == 400 ? 40001 : status * 100; }
    public static BusinessException missing() { return new BusinessException(404, "资源不存在"); }
}
