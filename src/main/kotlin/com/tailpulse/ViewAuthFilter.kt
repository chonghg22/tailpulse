package com.tailpulse

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import java.security.MessageDigest
import java.util.Base64

/**
 * 화면 · 조회 API 는 비밀번호(Basic 인증)로 막는다. 아이디는 아무 값이나 된다.
 * /ingest 는 수집기 토큰으로 따로 확인하므로 여기서는 지나간다.
 */
@Component
class ViewAuthFilter(private val props: TailpulseProperties) : OncePerRequestFilter() {
    override fun shouldNotFilter(request: HttpServletRequest): Boolean = props.viewPassword.isBlank() || request.requestURI == "/ingest" || request.requestURI == "/healthz"

    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        val header = request.getHeader("Authorization")
        val given =
            if (header != null && header.startsWith("Basic ")) {
                runCatching { String(Base64.getDecoder().decode(header.substring(6))).substringAfter(':') }.getOrNull()
            } else {
                null
            }
        if (given != null && MessageDigest.isEqual(given.toByteArray(), props.viewPassword.toByteArray())) {
            chain.doFilter(request, response)
            return
        }
        response.setHeader("WWW-Authenticate", "Basic realm=\"tailpulse\", charset=\"UTF-8\"")
        response.sendError(HttpServletResponse.SC_UNAUTHORIZED)
    }
}
