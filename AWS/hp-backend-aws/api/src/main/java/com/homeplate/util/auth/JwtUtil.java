package com.homeplate.util.auth;

import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Date;

@Slf4j
@Component
public class JwtUtil {
    private final Key key;
    private final long accessTokenExt;
    private final long refreshTokenExt;

    public JwtUtil(@Value("${jwt.secret}") String key,
                   @Value("${jwt.accessTokenExt}") long accessTokenExt,
                   @Value("${jwt.refreshTokenExt}") long refreshTokenExt) {

        byte[] keyByte = Decoders.BASE64.decode(key);
        this.key = Keys.hmacShaKeyFor(keyByte);
        this.accessTokenExt = accessTokenExt;
        this.refreshTokenExt = refreshTokenExt;
    }

    public String createAccessToken(Long userId, String email) {
        return createToken(userId, email, accessTokenExt);
    }

    public String createRefreshToken(Long userId, String email) {
        return createToken(userId, email, refreshTokenExt);
    }

    public String createToken(Long userId, String email, long ext) {
        return Jwts.builder()
                .setSubject(email)
                .claim("userId", userId)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + ext))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public String getEmail(String token) {
        return parseClaims(token).getSubject();
    }

    private Claims parseClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    public boolean validateToken(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (SecurityException | MalformedJwtException e) {
            log.error("Invalid JWT signature");
        } catch (ExpiredJwtException e) {
            log.error("Expired JWT token");
        } catch (UnsupportedJwtException e) {
            log.error("Unsupported JWT token");
        } catch (IllegalArgumentException e) {
            log.error("JWT claims is empty");
        }
        return false;
    }
}
