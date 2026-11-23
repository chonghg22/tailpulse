package com.tailpulse

import org.springframework.context.event.ContextClosedEvent
import org.springframework.context.event.EventListener
import org.springframework.http.MediaType
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import java.util.concurrent.CopyOnWriteArrayList

/** 1초마다 집계해 열려 있는 화면에 밀어 준다. */
@Service
class LiveService(
    private val props: TailpulseProperties,
    private val store: EventStore,
    private val health: HealthProbe,
    private val trend: TrendStore,
    private val alerts: AlertService,
) {
    private val emitters = CopyOnWriteArrayList<SseEmitter>()
    private val lastTotal = HashMap<String, Long>()
    private val userHistory = HashMap<String, ArrayDeque<LongArray>>() // 서비스 → [초, 접속자 수]
    private var tick = 0L
    private val startedAt = System.currentTimeMillis()

    fun subscribe(): SseEmitter {
        val emitter = SseEmitter(0L)
        emitters.add(emitter)
        emitter.onCompletion { emitters.remove(emitter) }
        emitter.onTimeout { emitters.remove(emitter) }
        emitter.onError { emitters.remove(emitter) }
        return emitter
    }

    /**
     * 끌 때 열린 실시간 연결부터 닫는다. 그대로 두면 정상 종료가 이 연결이 끝나기를 기다리다가
     * systemd 에 강제 종료돼 하루치 추이의 마지막 분이 저장되지 않는다. 화면은 알아서 다시 연결한다.
     */
    @EventListener(ContextClosedEvent::class)
    fun closeStreams() {
        emitters.forEach { runCatching { it.complete() } }
        emitters.clear()
    }

    @Scheduled(fixedRate = 1000)
    fun broadcast() {
        val now = System.currentTimeMillis()
        tick++
        // 하루치 추이: 끝난 1분을 파일에 남긴다(화면이 열려 있지 않아도)
        val closed = trend.closeDue(now)
        if (tick % 10 == 0L) store.prune(now)
        val names = store.serviceNames()
        val dots = ArrayList<Map<String, Any?>>()
        val services =
            names.mapIndexed { index, name ->
                val state = store.state(name)
                val summary = summarize(name, state, now)
                // 지난 틱 뒤에 들어온 요청만 점으로 보낸다
                state.read { st ->
                    val fresh = (st.total - (lastTotal[name] ?: st.total)).coerceIn(0, MAX_DOTS_PER_TICK.toLong()).toInt()
                    lastTotal[name] = st.total
                    if (fresh > 0) st.events.takeLast(fresh).filter { !it.static }.forEach { dots.add(dot(it, index)) }
                }
                if (tick % 5 == 0L) {
                    val h = userHistory.getOrPut(name) { ArrayDeque() }
                    h.addLast(longArrayOf(now / 1000, (summary["users"] as Int).toLong()))
                    while (h.size > props.retentionMinutes * 12) h.removeFirst()
                }
                summary
            }
        if (emitters.isEmpty()) return
        val payload = HashMap<String, Any?>()
        payload["now"] = now
        payload["services"] = services
        payload["dots"] = dots
        payload["issues"] = issues()
        if (tick % 5 == 0L) payload["top"] = topPaths(names, now)
        if (closed.isNotEmpty()) payload["trend"] = closed
        for (emitter in emitters) {
            try {
                emitter.send(SseEmitter.event().name("tick").data(payload, MediaType.APPLICATION_JSON))
            } catch (e: Exception) {
                emitters.remove(emitter)
            }
        }
    }

    /** 화면을 처음 열 때 한 번 받는 최근 기록 */
    fun snapshot(): Map<String, Any?> {
        val now = System.currentTimeMillis()
        val names = store.serviceNames()
        val fromSec = now / 1000 - SNAPSHOT_SECONDS
        val dots = ArrayList<Map<String, Any?>>()
        val series =
            names.mapIndexed { index, name ->
                store.state(name).read { st ->
                    st.events
                        .asSequence()
                        .filter { !it.static && it.t >= fromSec * 1000 }
                        .toList()
                        .takeLast(MAX_SNAPSHOT_DOTS / names.size.coerceAtLeast(1))
                        .forEach { dots.add(dot(it, index)) }
                    val count = IntArray(SNAPSHOT_SECONDS)
                    val error = IntArray(SNAPSHOT_SECONDS)
                    val avg = IntArray(SNAPSHOT_SECONDS)
                    for (i in 0 until SNAPSHOT_SECONDS) {
                        val b = st.seconds[fromSec + i] ?: continue
                        count[i] = b.count
                        error[i] = b.error
                        avg[i] = if (b.msCount > 0) (b.sumMs / b.msCount).toInt() else 0
                    }
                    mapOf<String, Any?>(
                        "count" to count,
                        "error" to error,
                        "avgMs" to avg,
                        "users" to (userHistory[name]?.filter { it[0] >= fromSec }?.map { listOf(it[0], it[1]) } ?: emptyList()),
                    )
                }
            }
        return mapOf(
            "now" to now,
            "startedAt" to startedAt,
            "hostInfo" to props.hostInfo,
            "fromSec" to fromSec,
            "seconds" to SNAPSHOT_SECONDS,
            "activeUserSeconds" to props.activeUserSeconds,
            "services" to names.map { summarize(it, store.state(it), now) },
            "series" to series,
            "dots" to dots,
            "top" to topPaths(names, now),
            "issues" to issues(),
        )
    }

    private fun issues(): List<Map<String, Any?>> =
        alerts.issues().map { mapOf("key" to it.key, "level" to it.level, "title" to it.title.toMap(), "detail" to it.detail.toMap(), "since" to it.since, "service" to it.service) }

    private fun summarize(name: String, state: ServiceState, now: Long): Map<String, Any?> {
        val config = props.services.firstOrNull { it.name == name }
        val sec = now / 1000
        return state.read { st ->
            // 방금 끝난 1초(진행 중인 초는 아직 덜 찼다)
            val tps = st.seconds[sec - 1]?.count ?: 0
            var count60 = 0
            var error60 = 0
            var client60 = 0
            var static60 = 0
            var sum10 = 0L
            var n10 = 0
            for (i in 1..60) {
                val b = st.seconds[sec - i] ?: continue
                count60 += b.count
                error60 += b.error
                client60 += b.clientError
                static60 += b.staticCount
                if (i <= 10) {
                    sum10 += b.sumMs
                    n10 += b.msCount
                }
            }
            val userCutoff = sec - props.activeUserSeconds
            val h = health.get(name)
            val agentSeen = st.agents.values.maxOrNull()
            // 서버별 최근 1분: 뒤에서부터 1분치만 훑는다
            val perHost = HashMap<String, IntArray>() // [요청, 5xx, 응답시간 합, 응답시간 건수]
            val from = now - 60_000
            var k = st.events.size - 1
            while (k >= 0) {
                val e = st.events[k]
                if (e.t < from - 5_000) break
                if (e.t >= from && !e.static) {
                    val a = perHost.getOrPut(e.host) { IntArray(4) }
                    a[0]++
                    if (e.status >= 500) a[1]++
                    if (e.ms != null) {
                        a[2] += e.ms
                        a[3]++
                    }
                }
                k--
            }
            mapOf(
                "name" to name,
                "label" to (config?.label ?: name),
                "kind" to (config?.kind ?: ""),
                "url" to (config?.url ?: ""),
                "tps" to tps,
                "perMin" to count60,
                "staticPerMin" to static60,
                "avgMs" to if (n10 > 0) (sum10 / n10).toInt() else null,
                "errorRate" to if (count60 > 0) error60 * 100.0 / count60 else 0.0,
                "errors" to error60,
                "clientErrors" to client60,
                "users" to st.visitors.values.count { it >= userCutoff },
                "health" to h?.let { mapOf("up" to it.up, "status" to it.status, "ms" to it.ms, "since" to it.since, "checkedAt" to it.checkedAt) },
                "agents" to
                    (st.agents.keys + (config?.hosts ?: emptyList())).distinct().sorted().map { host ->
                        val a = perHost[host]
                        val sys = store.hosts[host]?.takeIf { now - it.at < 60_000 }
                        mapOf(
                            "host" to host,
                            "ageSec" to st.agents[host]?.let { (now - it) / 1000 },
                            "perMin" to (a?.get(0) ?: 0),
                            "errors" to (a?.get(1) ?: 0),
                            "avgMs" to a?.takeIf { it[3] > 0 }?.let { it[2] / it[3] },
                            "cpu" to sys?.cpu,
                            "mem" to sys?.mem,
                            "disk" to sys?.disk?.values?.maxOrNull(),
                        )
                    },
                "agentAgeSec" to agentSeen?.let { (now - it) / 1000 },
            )
        }
    }

    private fun topPaths(names: List<String>, now: Long): List<Map<String, Any?>> {
        val from = now - 300_000
        val rows = ArrayList<Map<String, Any?>>()
        names.forEachIndexed { index, name ->
            store.state(name).read { st ->
                st.events
                    .asSequence()
                    .filter { !it.static && it.t >= from }
                    .groupBy { it.method + " " + it.path }
                    .forEach { (key, list) ->
                        val timed = list.mapNotNull { it.ms }
                        rows.add(
                            mapOf(
                                "i" to index,
                                "path" to key,
                                "count" to list.size,
                                "avgMs" to if (timed.isNotEmpty()) timed.average().toInt() else null,
                                "maxMs" to timed.maxOrNull(),
                                "errors" to list.count { it.status >= 500 },
                            ),
                        )
                    }
            }
        }
        return rows.sortedByDescending { it["count"] as Int }.take(TOP_PATHS)
    }

    private fun dot(e: RequestEvent, index: Int): Map<String, Any?> = mapOf("t" to e.t, "ms" to e.ms, "s" to e.status, "i" to index, "p" to e.path, "m" to e.method)

    companion object {
        private const val SNAPSHOT_SECONDS = 600
        private const val MAX_SNAPSHOT_DOTS = 20_000
        private const val MAX_DOTS_PER_TICK = 1500

        // 화면이 요청 수 · 느린 순 · 오류 순으로 다시 줄 세운다(그래서 많이 불린 주소 12개보다 넉넉히)
        private const val TOP_PATHS = 60
    }
}

@RestController
class LiveController(private val live: LiveService) {
    @GetMapping("/api/stream", produces = [MediaType.TEXT_EVENT_STREAM_VALUE])
    fun stream(): SseEmitter = live.subscribe()

    @GetMapping("/api/snapshot")
    fun snapshot(): Map<String, Any?> = live.snapshot()
}
