package com.tailpulse

import org.springframework.stereotype.Component
import java.util.concurrent.ConcurrentHashMap

/** 요청 한 건. 주소는 수집기가 쿼리 문자열을 떼고 번호·토큰 자리를 가린 값이다. */
data class RequestEvent(
    val t: Long, // 끝난 시각 (epoch ms)
    val ms: Int?, // 응답 시간. 로그에 없으면 null
    val status: Int,
    val method: String,
    val path: String,
    val visitor: String?, // 방문자 해시 (IP 원문은 받지 않는다)
    val static: Boolean, // 이미지·js·css 같은 정적 파일
    val host: String, // 보낸 서버 이름
)

/** 수집기가 10초마다 보내는 서버 자원. 값은 사용률(%) */
data class HostSys(
    val at: Long,
    val cpu: Double?,
    val mem: Double?,
    val disk: Map<String, Double>,
    val load1: Double?,
)

/** 1초 단위 집계 */
class SecondBucket {
    var count = 0 // 정적 파일을 뺀 요청 수
    var staticCount = 0
    var error = 0 // 5xx
    var clientError = 0 // 4xx
    var sumMs = 0L
    var msCount = 0
    var maxMs = 0
}

class ServiceState(private val maxEvents: Int) {
    val events = ArrayDeque<RequestEvent>()
    val seconds = HashMap<Long, SecondBucket>()
    val visitors = HashMap<String, Long>() // 방문자 해시 → 마지막으로 본 초
    val agents = HashMap<String, Long>() // 서버 이름 → 마지막 수집기 신호 (epoch ms)
    var total = 0L

    @Synchronized
    fun add(list: List<RequestEvent>) {
        for (e in list) {
            events.addLast(e)
            if (events.size > maxEvents) events.removeFirst()
            val sec = e.t / 1000
            val b = seconds.getOrPut(sec) { SecondBucket() }
            if (e.static) {
                b.staticCount++
            } else {
                b.count++
                if (e.status >= 500) b.error++ else if (e.status >= 400) b.clientError++
                if (e.ms != null) {
                    b.sumMs += e.ms
                    b.msCount++
                    if (e.ms > b.maxMs) b.maxMs = e.ms
                }
                e.visitor?.let { visitors[it] = sec }
            }
            total++
        }
    }

    @Synchronized
    fun heartbeat(host: String, now: Long) {
        agents[host] = now
    }

    @Synchronized
    fun prune(now: Long, retentionMs: Long, activeUserSeconds: Int) {
        val cutoff = now - retentionMs
        while (events.isNotEmpty() && events.first().t < cutoff) events.removeFirst()
        seconds.keys.removeIf { it < cutoff / 1000 }
        val userCutoff = now / 1000 - activeUserSeconds
        visitors.values.removeIf { it < userCutoff }
    }

    @Synchronized
    fun <T> read(block: (ServiceState) -> T): T = block(this)
}

@Component
class EventStore(private val props: TailpulseProperties) {
    private val states = ConcurrentHashMap<String, ServiceState>()

    /** 서버 이름 → 마지막으로 받은 자원 값 */
    val hosts = ConcurrentHashMap<String, HostSys>()

    init {
        props.services.forEach { state(it.name) }
    }

    fun state(service: String): ServiceState = states.getOrPut(service) { ServiceState(props.maxEventsPerService) }

    fun serviceNames(): List<String> {
        val configured = props.services.map { it.name }
        return configured + states.keys.filter { it !in configured }.sorted()
    }

    fun prune(now: Long) {
        states.values.forEach { it.prune(now, props.retentionMinutes * 60_000L, props.activeUserSeconds) }
    }
}
