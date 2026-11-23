package com.travel.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.Date;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtService {
    private final SecretKey key;
    private final Clock clock;
    public final long expiresIn;
    public JwtService(@Value("${app.jwt.secret}") String secret,
                      @Value("${app.jwt.expires-in}") long expiresIn, Clock clock) {
        if (secret.getBytes(StandardCharsets.UTF_8).length < 32)
            throw new IllegalStateException("请设置至少 32 字节的 JWT_SECRET 环境变量");
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expiresIn = expiresIn;
        this.clock = clock;
    }
    public String issue(Long userId) {
        return Jwts.builder().issuer("travel-backend").subject(userId.toString())
            .issuedAt(Date.from(clock.instant())).expiration(Date.from(clock.instant().plusSeconds(expiresIn)))
            .signWith(key).compact();
    }
    public Long verify(String token) {
        return Long.valueOf(Jwts.parser().verifyWith(key).requireIssuer("travel-backend")
            .clock(() -> Date.from(clock.instant())).build().parseSignedClaims(token).getPayload().getSubject());
    }
}
