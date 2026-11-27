package com.travel.service;

import com.travel.common.*;
import com.travel.domain.User;
import com.travel.dto.Requests.*;
import com.travel.mapper.*;
import com.travel.security.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserMapper users;
    private final QueryMapper queries;
    private final PasswordEncoder passwords;
    private final JwtService jwt;
    @Transactional public User register(Register request) {
        WriteSupport.password(request.password(),request.confirmPassword());
        if (queries.userByName(request.username()) != null) throw new BusinessException(409,"用户名已存在，请换一个用户名",Map.of("username","此用户名已被注册，请更换，或前往登录"));
        User user = new User(); user.setUsername(request.username()); user.setNickname(request.nickname());
        user.setPasswordHash(passwords.encode(request.password())); users.insert(user);
        return users.find(user.getUserId());
    }
    public Map<String,Object> login(Login request) {
        User user = queries.userByName(request.username());
        // A valid dummy hash keeps the unknown-user path computationally similar.
        String hash = user == null ? "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy" : user.getPasswordHash();
        boolean valid = passwords.matches(request.password(),hash);
        if (user == null || !valid) throw new BusinessException(401,"账号或密码错误",Map.of("password","请检查用户名及密码后重新登录"));
        return Map.of("accessToken",jwt.issue(user.getUserId()),"tokenType","Bearer","expiresIn",jwt.expiresIn,"user",user);
    }
    public User me() {
        User user = users.find(CurrentUser.id());
        if (user == null) throw new BusinessException(401,"用户不存在，请重新登录");
        return user;
    }
    @Transactional public User nickname(Nickname request) {
        User user = me(); user.setNickname(request.nickname()); users.update(user); return me();
    }
    @Transactional public Map<String,Boolean> password(Password request) {
        User user = me();
        if (!passwords.matches(request.oldPassword(),user.getPasswordHash())) throw new BusinessException(400,"旧密码错误",Map.of("oldPassword","请输入当前账号正在使用的密码"));
        WriteSupport.password(request.newPassword(),request.confirmPassword());
        user.setPasswordHash(passwords.encode(request.newPassword())); users.update(user);
        return Map.of("updated",true);
    }
}
