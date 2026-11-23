package com.tailpulse

import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import java.util.concurrent.ConcurrentHashMap

data class HealthState(
    val up: Boolean,
    val status: Int?, // 받은 상태 코드. 연결 실패면 null
    val ms: Long,
    val checkedAt: Long,
    val since: Long, // 지금 상태(up/down)가 시작된 시각
)

/** 서비스 주소에 10초마다 직접 접속해 살아 있는지 본다. 5xx · 연결 실패 · 5초 초과면 죽은 것으로 본다. */
@Component
class HealthProbe(private val props: TailpulseProperties) {
    private val client: HttpClient =
        HttpClient
            .newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build()
    private val states = ConcurrentHashMap<String, HealthState>()

    companion object {
        const val PROBE_MARK = "tailpulse_probe=1"
    }

    fun get(service: String): HealthState? = states[service]

    @Scheduled(fixedDelay = 10_000, initialDelay = 1_000)
    fun probeAll() {
        props.services.filter { it.healthUrl.isNotBlank() }.forEach { svc ->
            val started = System.currentTimeMillis()
            val status =
                try {
                    val req =
                        HttpRequest
                            // 표식을 붙여 보낸다. 수집기는 이 표식이 있는 요청을 접속량에 넣지 않는다
                            .newBuilder(URI.create(svc.healthUrl + (if ('?' in svc.healthUrl) "&" else "?") + PROBE_MARK))
                            .timeout(Duration.ofSeconds(5))
                            .header("User-Agent", "tailpulse")
                            .GET()
                            .build()
                    client.send(req, HttpResponse.BodyHandlers.discarding()).statusCode()
                } catch (e: Exception) {
                    null
                }
            val now = System.currentTimeMillis()
            val up = status != null && status < 500
            val prev = states[svc.name]
            states[svc.name] = HealthState(up, status, now - started, now, if (prev != null && prev.up == up) prev.since else now)
        }
    }
}
