package com.travel.common;

public class BusinessException extends RuntimeException {
    public final int status;
    public BusinessException(int status, String message) { super(message); this.status = status; }
    public int code() { return status == 400 ? 40001 : status * 100; }
    public static BusinessException missing() { return new BusinessException(404, "资源不存在"); }
}
