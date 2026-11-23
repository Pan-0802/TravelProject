package com.travel.security;

import org.springframework.security.core.context.SecurityContextHolder;

public final class CurrentUser {
    private CurrentUser() {}
    public static Long id() { return (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal(); }
}
