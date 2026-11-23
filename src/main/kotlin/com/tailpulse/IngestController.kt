package com.tailpulse

import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RestController
import java.security.MessageDigest

/** 수집기가 보내는 한 묶음. events 가 비어 있으면 "수집기 살아 있음" 신호로만 쓴다. */
data class IngestBatch(
    val service: String = "",
    val host: String = "",
    val events: List<IngestEvent> = emptyList(),
    val sys: IngestSys? = null,
)

data class IngestSys(
    val cpu: Double? = null,
    val mem: Double? = null,
    val disk: Map<String, Double> = emptyMap(),
    val load1: Double? = null,
)

data class IngestEvent(
    val t: Long = 0, // epoch ms
    val ms: Int? = null,
    val s: Int = 0, // 상태 코드
    val m: String = "", // 메서드
    val p: String = "", // 주소 (쿼리 문자열 없음)
    val v: String? = null, // 방문자 해시
    val x: Boolean = false, // 정적 파일
)

@RestController
class IngestController(
    private val props: TailpulseProperties,
    private val store: EventStore,
) {
    @PostMapping("/ingest")
    fun ingest(
        @RequestHeader("X-Tailpulse-Token", required = false) token: String?,
        @RequestBody batch: IngestBatch,
    ): ResponseEntity<Map<String, Any>> {
        if (props.ingestToken.isBlank() || token == null || !sameText(token, props.ingestToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("ok" to false))
        }
        if (!NAME.matches(batch.service) || !NAME.matches(batch.host)) {
            return ResponseEntity.badRequest().body(mapOf("ok" to false, "error" to "service and host must be 1-40 chars of a-z 0-9 - _"))
        }
        if (batch.events.size > MAX_BATCH) {
            return ResponseEntity.badRequest().body(mapOf("ok" to false, "error" to "at most $MAX_BATCH events per batch"))
        }
        if (batch.service !in store.serviceNames() && store.serviceNames().size >= MAX_SERVICES) {
            return ResponseEntity.badRequest().body(mapOf("ok" to false, "error" to "too many services (max $MAX_SERVICES)"))
        }
        val now = System.currentTimeMillis()
        val state = store.state(batch.service)
        state.heartbeat(batch.host, now)
        batch.sys?.let { sys ->
            store.hosts[batch.host] =
                HostSys(
                    at = now,
                    cpu = sys.cpu?.coerceIn(0.0, 100.0),
                    mem = sys.mem?.coerceIn(0.0, 100.0),
                    disk = sys.disk.entries.take(8).associate { it.key.take(60) to it.value.coerceIn(0.0, 100.0) },
                    load1 = sys.load1,
                )
        }
        val events =
            batch.events.mapNotNull { e ->
                if (e.s !in 100..599) return@mapNotNull null
                RequestEvent(
                    // 서버 시계가 어긋나 있어도 화면이 깨지지 않게 받은 시각 근처로만 받는다
                    t = if (e.t in (now - 120_000)..(now + 5_000)) e.t else now,
                    ms = e.ms?.coerceIn(0, 600_000),
                    status = e.s,
                    method = e.m.take(8),
                    path = e.p.substringBefore('?').take(160),
                    visitor = e.v?.take(24),
                    static = e.x,
                    host = batch.host,
                )
            }
        state.add(events)
        return ResponseEntity.ok(mapOf("ok" to true, "accepted" to events.size))
    }

    private fun sameText(a: String, b: String): Boolean = MessageDigest.isEqual(a.toByteArray(), b.toByteArray())

    companion object {
        private val NAME = Regex("[a-z0-9_-]{1,40}")
        private const val MAX_BATCH = 2000
        private const val MAX_SERVICES = 30
    }
}
