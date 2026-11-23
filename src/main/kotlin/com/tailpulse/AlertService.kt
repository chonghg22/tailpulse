package com.tailpulse

import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RestController
import tools.jackson.databind.ObjectMapper
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.file.Files
import java.nio.file.Path
import java.time.Duration
import java.time.Instant
import java.time.format.DateTimeFormatter

/** 한국어 · 영어 문구 한 쌍. 화면은 둘 다 받아 고른 언어로, 슬랙은 설정 lang 으로 보인다 */
data class Text(val ko: String, val en: String) {
    fun pick(lang: String): String = if (lang == "ko") ko else en

    operator fun plus(o: Text) = Text(ko + o.ko, en + o.en)

    fun toMap(): Map<String, String> = mapOf("ko" to ko, "en" to en)
}

/**
 * 슬랙 알림. 서비스 주소 응답 없음(health-url), 수집기 신호 끊김, 서버 오류 급증, 요청 끊김, 디스크 · 메모리를 본다.
 * 같은 일로 한 번만 보내고, 풀리면 복구를 한 번 보낸다.
 * 슬랙 설정이 없어도 지금 걸려 있는 문제(issues)는 계산해 화면 맨 위 상태 줄에 보인다.
 */
@Service
class AlertService(
    private val props: TailpulseProperties,
    private val store: EventStore,
    private val health: HealthProbe,
    private val mapper: ObjectMapper,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build()
    private val startedAt = System.currentTimeMillis()
    private val open = HashMap<String, Long>() // 알린 장애 → 시작 시각
    private val memoryHighSince = HashMap<String, Long>()
    private val active = java.util.concurrent.ConcurrentHashMap<String, Issue>() // 지금 걸려 있는 문제(화면용)
    private val format = DateTimeFormatter.ofPattern("MM-dd HH:mm").withZone(props.zoneId())

    /** 화면 상태 줄에 보일 문제. level: critical(장애) · warning(경고). service 는 서비스 이름(서버 자원 문제면 null) */
    data class Issue(val key: String, val level: String, val title: Text, val detail: Text, val since: Long, val service: String?)

    /** 장애 먼저, 같은 등급이면 먼저 생긴 것부터 */
    fun issues(): List<Issue> = active.values.sortedWith(compareBy<Issue>({ if (it.level == "critical") 0 else 1 }, { it.since }))

    @Scheduled(fixedDelay = 10_000, initialDelay = 20_000)
    fun check() {
        val now = System.currentTimeMillis()
        props.services.forEach { svc ->
            health.get(svc.name)?.let { h ->
                val down = !h.up && now - h.since >= props.healthDownSeconds * 1000L
                val code = h.status?.let { Text(" (응답 코드 $it)", " (HTTP $it)") } ?: Text(" (연결 실패)", " (connection failed)")
                update(
                    key = "health:${svc.name}",
                    failing = down,
                    since = h.since,
                    title = Text("${svc.label} · 사이트 응답 없음", "${svc.label} · site not responding"),
                    detail =
                        Text(
                            "${svc.healthUrl} 접속이 ${props.healthDownSeconds}초 넘게 실패했습니다",
                            "${svc.healthUrl} has been failing for more than ${props.healthDownSeconds}s",
                        ) + code + Text(".", "."),
                    recovered = !down && h.up,
                    service = svc.name,
                )
            }
            checkTraffic(svc, now)
            val seen = store.state(svc.name).read { HashMap(it.agents) }
            (svc.hosts + seen.keys).distinct().forEach { host ->
                val last = seen[host]
                // 한 번도 신호가 없던 서버는 앱이 뜬 시각부터 센다
                val since = last ?: startedAt
                val silent = now - since >= props.agentSilentSeconds * 1000L
                update(
                    key = "agent:${svc.name}:$host",
                    failing = silent,
                    since = since,
                    title = Text("${svc.label} · $host 수집 끊김", "${svc.label} · $host agent silent"),
                    detail =
                        Text(
                            "$host 서버의 수집기 신호가 ${props.agentSilentSeconds}초 넘게 없습니다. 서버가 꺼졌거나 네트워크 · 수집기가 멈췄을 수 있습니다.",
                            "No heartbeat from the agent on $host for more than ${props.agentSilentSeconds}s. The server may be down, or the network or agent may have stopped.",
                        ),
                    recovered = !silent && last != null,
                    service = svc.name,
                )
            }
        }
    }

    /** 요청 흐름으로 보는 이상: 서버 오류 급증, 들어오던 요청이 끊김 */
    private fun checkTraffic(svc: TailpulseProperties.ServiceConfig, now: Long) {
        val sec = now / 1000
        val counts =
            store.state(svc.name).read { st ->
                var count60 = 0
                var error60 = 0
                var recent = 0 // 최근 3분
                var before = 0 // 그 앞 10분
                for (i in 1..780) {
                    val b = st.seconds[sec - i] ?: continue
                    if (i <= 60) {
                        count60 += b.count
                        error60 += b.error
                    }
                    if (i <= 180) recent += b.count + b.staticCount else before += b.count + b.staticCount
                }
                intArrayOf(count60, error60, recent, before)
            }
        val rate = if (counts[0] > 0) counts[1] * 100 / counts[0] else 0
        val surge = counts[1] >= props.errorSurgeCount && rate >= props.errorSurgePercent
        update(
            key = "errors:${svc.name}",
            failing = surge,
            since = now,
            title = Text("${svc.label} · 서버 오류 급증", "${svc.label} · server error spike"),
            detail =
                Text(
                    "최근 1분 요청 ${counts[0]}건 가운데 서버 오류(5xx)가 ${counts[1]}건(${rate}%)입니다.",
                    "${counts[1]} of ${counts[0]} requests in the last minute were server errors (5xx, $rate%).",
                ),
            recovered = !surge && rate < props.errorSurgePercent / 2,
            service = svc.name,
        )
        val silent = counts[2] == 0 && counts[3] >= props.silenceMinPerMinute * 10
        update(
            key = "silence:${svc.name}",
            failing = silent,
            since = now - 180_000,
            title = Text("${svc.label} · 요청 끊김", "${svc.label} · traffic stopped"),
            detail =
                Text(
                    "직전 10분 동안 ${counts[3]}건 들어오던 요청이 3분째 0건입니다. 서버는 켜져 있어도 사이트가 열리지 않을 수 있습니다.",
                    "${counts[3]} requests arrived in the 10 minutes before, but none for the last 3 minutes. The site may be unreachable even though the server is up.",
                ),
            recovered = counts[2] > 0,
            service = svc.name,
        )
    }

    /** 서버 자원: 디스크 · 메모리 */
    @Scheduled(fixedDelay = 30_000, initialDelay = 30_000)
    fun checkHosts() {
        val now = System.currentTimeMillis()
        store.hosts.forEach { (host, sys) ->
            if (now - sys.at > 120_000) { // 값이 끊긴 서버는 수집 끊김 알림이 맡는다(화면에는 오래된 자원 경고를 남기지 않는다)
                active.keys.removeIf { it == "memory:$host" || ((it.startsWith("disk-critical:") || it.startsWith("disk-warn:")) && it.startsWith("${it.substringBefore(':')}:$host:")) }
                return@forEach
            }
            sys.disk.forEach { (mount, used) ->
                val text = Text("$host 서버의 $mount 사용률이 ${used.toInt()}%입니다.", "$mount on $host is ${used.toInt()}% full.")
                update(
                    "disk-critical:$host:$mount", used >= props.diskCriticalPercent, now,
                    Text("$host · 디스크 긴급", "$host · disk critical"), text + Text(" 곧 가득 찹니다.", " It will be full soon."),
                    used < props.diskCriticalPercent - 2,
                )
                update("disk-warn:$host:$mount", used >= props.diskWarnPercent, now, Text("$host · 디스크 부족", "$host · disk low"), text, used < props.diskWarnPercent - 2, warning = true)
            }
            val mem = sys.mem ?: return@forEach
            if (mem >= props.memoryWarnPercent) memoryHighSince.putIfAbsent(host, now) else memoryHighSince.remove(host)
            val since = memoryHighSince[host]
            update(
                "memory:$host", since != null && now - since >= 600_000, since ?: now,
                Text("$host · 메모리 부족", "$host · memory high"),
                Text(
                    "$host 서버의 메모리 사용률이 10분 넘게 ${props.memoryWarnPercent}% 이상입니다(지금 ${mem.toInt()}%).",
                    "Memory on $host has been at or above ${props.memoryWarnPercent}% for more than 10 minutes (now ${mem.toInt()}%).",
                ),
                since == null, warning = true,
            )
        }
    }

    @Synchronized
    private fun update(key: String, failing: Boolean, since: Long, title: Text, detail: Text, recovered: Boolean, warning: Boolean = false, service: String? = null) {
        // 화면: 걸려 있는 동안만 보인다(처음 생긴 시각은 그대로 둔다)
        if (failing) {
            active[key] = Issue(key, if (warning) "warning" else "critical", title, detail, active[key]?.since ?: since, service)
        } else {
            active.remove(key)
        }
        if (props.slackWebhookFile.isBlank()) return
        val lang = props.lang
        val opened = open[key]
        if (failing && opened == null) {
            val head = if (warning) Text("⚠️ 경고 · ", "⚠️ Warning · ") else Text("🚨 장애 · ", "🚨 Critical · ")
            val body = detail + Text("\n발생 ${clock(since)}", "\nSince ${clock(since)}")
            if (send(if (warning) "warning" else "danger", (head + title).pick(lang), body.pick(lang))) open[key] = since
        } else if (recovered && opened != null) {
            val body = Text("발생 ${clock(opened)} → 복구 ${clock(System.currentTimeMillis())}", "Started ${clock(opened)} → recovered ${clock(System.currentTimeMillis())}")
            if (send("good", (Text("✅ 복구 · ", "✅ Recovered · ") + title).pick(lang), body.pick(lang))) open.remove(key)
        }
    }

    fun sendTest(): Boolean =
        send(
            "warning",
            Text("[테스트] tailpulse 알림 연결 확인", "[Test] tailpulse alert check").pick(props.lang),
            Text("tailpulse 가 슬랙으로 알림을 보낼 수 있습니다. 조치할 것은 없습니다.", "tailpulse can send alerts to this Slack channel. No action needed.").pick(props.lang),
        )

    private fun send(color: String, title: String, text: String): Boolean {
        return try {
            val url = Files.readString(Path.of(props.slackWebhookFile)).trim()
            val body =
                mapper.writeValueAsString(
                    mapOf(
                        "username" to "tailpulse",
                        "icon_emoji" to ":satellite:",
                        "attachments" to listOf(mapOf("color" to color, "title" to title, "text" to text, "fallback" to title)),
                    ),
                )
            val req =
                HttpRequest
                    .newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build()
            val status = client.send(req, HttpResponse.BodyHandlers.discarding()).statusCode()
            if (status != 200) log.warn("Slack alert failed: HTTP {} ({})", status, title)
            status == 200
        } catch (e: Exception) {
            // 웹훅 주소가 로그에 남지 않게 예외 종류만 적는다
            log.warn("Slack alert failed: {} ({})", e.javaClass.simpleName, title)
            false
        }
    }

    private fun clock(ms: Long): String = format.format(Instant.ofEpochMilli(ms))
}

@RestController
class AlertController(private val alerts: AlertService) {
    /** 슬랙 연결 확인용. 화면 비밀번호로 막혀 있다. */
    @PostMapping("/api/alert-test")
    fun test(): Map<String, Boolean> = mapOf("sent" to alerts.sendTest())
}
