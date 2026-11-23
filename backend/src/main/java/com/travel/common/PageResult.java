package com.travel.common;

import java.util.List;

public record PageResult<T>(List<T> list, long total, int page, int size) {
    public static void validate(int page, int size) {
        if (page < 1 || size < 1 || size > 50 || (long) page * size > Integer.MAX_VALUE)
            throw new BusinessException(400, "page 从 1 开始，size 范围 1–50");
    }
}
