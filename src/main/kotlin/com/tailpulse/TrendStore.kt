package com.tailpulse

import jakarta.annotation.PreDestroy
import org.slf4j.LoggerFactory
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Component
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import tools.jackson.databind.ObjectMapper
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardOpenOption
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeParseException
import kotlin.math.max

/** 1분 집계 한 칸(서비스 하나). 요청 한 건이 아니라 건수 · 응답 시간 · 접속자 수만 담는다(주소 · 방문자 해시 없음). */
class MinuteAgg(
    var count: Int = 0, // 정적 파일을 뺀 요청 수
    var staticCount: Int = 0,
    var error: Int = 0, // 5xx
    var clientError: Int = 0, // 4xx
    var sumMs: Long = 0,
    var timed: Int = 0, // 응답 시간이 기록된 요청 수
    var maxMs: Int = 0, // 가장 느린 요청
    var users: Int = 0, // 분이 끝날 때의 접속자 수(최근 active-user-seconds 안에 요청이 있던 방문자)
) {
    /** 같은 분이 두 번 기록되면(재시작 앞뒤로 나뉜 분) 건수는 더하고 최대값은 큰 쪽을 쓴다 */
    fun merge(o: MinuteAgg) {
        count += o.count
        staticCount += o.staticCount
        error += o.error
        clientError += o.clientError
        sumMs += o.sumMs
        timed += o.timed
        maxMs = max(maxMs, o.maxMs)
        users = max(users, o.users)
    }

    fun toJson(): String = "[$count,$staticCount,$error,$clientError,$sumMs,$timed,$maxMs,$users]"

    fun toMap(): Map<String, Any> = mapOf("count" to count, "errors" to error, "users" to users, "sumMs" to sumMs, "timed" to timed, "maxMs" to maxMs)

    companion object {
        fun of(v: List<Long>): MinuteAgg? =
            if (v.size < 8) null else MinuteAgg(v[0].toInt(), v[1].toInt(), v[2].toInt(), v[3].toInt(), v[4], v[5].toInt(), v[6].toInt(), v[7].toInt())
    }
}

/** 분 하나가 닫힐 때 화면으로 보내는 값(합쳐진 뒤의 값) */
data class TrendUpdate(val date: String, val index: Int, val rows: Map<String, Map<String, Any>>)

/**
 * 하루치 추이. 분이 끝나고 조금 뒤(늦게 온 요청까지) 그 1분을 서비스별로 집계해
 * data/trend/trend-YYYY-MM-DD.jsonl 에 한 줄씩 덧붙인다. 앱을 다시 켜면 오늘 파일을 읽어 이어 그린다.
 * 요청 한 건 기록(주소 · 방문자 해시)은 여전히 메모리에만 있고, 파일에는 건수만 남는다.
 */
@Component
class TrendStore(
    private val props: TailpulseProperties,
    private val store: EventStore,
    private val mapper: ObjectMapper,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val zone: ZoneId = props.zoneId()
    private val dir: Path = Path.of(props.dataDir, "trend")

    private class Day(val date: LocalDate, val start: Long, val length: Int) {
        val rows = HashMap<String, Array<MinuteAgg?>>()
        var lastIndex = -1

        fun put(service: String, index: Int, agg: MinuteAgg) {
            if (index !in 0 until length) return
            val arr = rows.getOrPut(service) { arrayOfNulls(length) }
            val cur = arr[index]
            if (cur == null) arr[index] = agg else cur.merge(agg)
            if (index > lastIndex) lastIndex = index
        }
    }

    private var today: Day
    private var startMinute = 0L // 이 앱이 뜬 분(epoch minute)
    private var lastClosed = 0L
    private var stopped = false

    init {
        today = Day(LocalDate.now(zone), 0, 0)
        begin(System.currentTimeMillis())
    }

    /** 앱이 뜰 때 오늘 기록을 읽고 어디서부터 닫을지 정한다(테스트에서는 원하는 시각으로 부른다) */
    @Synchronized
    internal fun begin(nowMs: Long) {
        startMinute = nowMs / 60_000
        // 앱이 꺼져 있던 동안 수집기에 쌓였다가 늦게 들어온 직전 분 요청도 닫는다
        lastClosed = startMinute - 2
        stopped = false
        try {
            Files.createDirectories(dir)
        } catch (e: Exception) {
            log.warn("Cannot create trend directory: {} ({})", dir, e.javaClass.simpleName)
        }
        today = load(dateOf(startMinute))
        cleanup(today.date)
    }

    /** 닫을 때가 된 분을 집계해 파일에 남긴다. LiveService 가 1초마다 부른다 */
    @Synchronized
    fun closeDue(nowMs: Long): List<TrendUpdate> {
        if (stopped) return emptyList()
        val current = nowMs / 60_000
        if (current - lastClosed > MAX_CATCH_UP) lastClosed = current - 2 // 시계가 크게 뛰면 건너뛴다
        val out = ArrayList<TrendUpdate>()
        while (nowMs >= (lastClosed + 2) * 60_000 + CLOSE_DELAY_MS) {
            val m = lastClosed + 1
            record(m, aggregate(m), partial = false)?.let { out.add(it) }
            lastClosed = m
        }
        return out
    }

    /** 끌 때: 닫지 못한 분과 진행 중인 분까지 남긴다. 다시 켜면 나머지와 합쳐진다 */
    @PreDestroy
    fun flush() = flushAt(System.currentTimeMillis())

    @Synchronized
    internal fun flushAt(now: Long) {
        if (stopped) return
        closeDue(now)
        val current = now / 60_000
        var m = lastClosed + 1
        while (m <= current) {
            record(m, aggregate(m), partial = m == current)
            m++
        }
        lastClosed = current
        stopped = true
    }

    /** 화면용: 그날 1분 칸마다 값(없는 칸은 null). date 를 비우면 오늘 */
    @Synchronized
    fun view(date: LocalDate?): Map<String, Any?> {
        val day = if (date == null || date == today.date) today else load(date)
        val names = store.serviceNames()
        val series = LinkedHashMap<String, Map<String, List<Number?>>>()
        (names + day.rows.keys.filter { it !in names }.sorted()).forEach { name ->
            val arr = day.rows[name] ?: return@forEach
            series[name] =
                mapOf(
                    "count" to arr.map { it?.count },
                    "errors" to arr.map { it?.error },
                    "users" to arr.map { it?.users },
                    "sumMs" to arr.map { it?.sumMs },
                    "timed" to arr.map { it?.timed },
                    "maxMs" to arr.map { it?.maxMs },
                )
        }
        return mapOf(
            "date" to day.date.toString(),
            "dayStart" to day.start * 60_000,
            "minutes" to day.length,
            "lastIndex" to day.lastIndex,
            "keepDays" to props.trendKeepDays,
            "series" to series,
        )
    }

    private fun aggregate(minute: Long): Map<String, MinuteAgg?> {
        val fromSec = minute * 60
        val endSec = fromSec + 60
        val startMs = fromSec * 1000
        return store.serviceNames().associateWith { name ->
            store.state(name).read { st ->
                val agg = MinuteAgg()
                for (s in fromSec until endSec) {
                    val b = st.seconds[s] ?: continue
                    agg.count += b.count
                    agg.staticCount += b.staticCount
                    agg.error += b.error
                    agg.clientError += b.clientError
                    agg.sumMs += b.sumMs
                    agg.timed += b.msCount
                    agg.maxMs = max(agg.maxMs, b.maxMs)
                }
                val userCutoff = endSec - props.activeUserSeconds
                agg.users = st.visitors.values.count { it >= userCutoff }
                val collected = st.agents.values.any { it >= startMs } // 그 분에 수집기가 살아 있었다
                // 수집기도 요청도 없던 분은 칸을 비운다(0건과 "모름"을 구분한다)
                if (agg.count + agg.staticCount > 0 || collected) agg else null
            }
        }
    }

    private fun record(minute: Long, aggs: Map<String, MinuteAgg?>, partial: Boolean): TrendUpdate? {
        // 앱이 뜨기 전의 분은 늦게 들어온 요청이 있을 때만 남긴다
        val rows = aggs.filterValues { it != null && (minute >= startMinute || it.count + it.staticCount > 0) }.mapValues { it.value!! }
        if (rows.isEmpty()) return null
        if (partial && rows.values.all { it.count + it.staticCount == 0 }) return null
        val date = dateOf(minute)
        if (date != today.date) {
            today = load(date)
            cleanup(date)
        }
        val index = (minute - today.start).toInt()
        val line = StringBuilder().append("{\"m\":").append(minute).append(",\"s\":{")
        rows.entries.forEachIndexed { k, (name, agg) ->
            if (k > 0) line.append(',')
            line.append('"').append(name).append("\":").append(agg.toJson())
        }
        line.append("}}\n")
        try {
            Files.writeString(file(date), line, StandardOpenOption.CREATE, StandardOpenOption.APPEND)
        } catch (e: Exception) {
            log.warn("Failed to write trend file: {} ({})", file(date), e.javaClass.simpleName)
        }
        rows.forEach { (name, agg) -> today.put(name, index, agg) }
        val merged = rows.keys.associateWith { today.rows[it]?.getOrNull(index)?.toMap() ?: emptyMap() }
        return TrendUpdate(date.toString(), index, merged)
    }

    private fun load(date: LocalDate): Day {
        val start = date.atStartOfDay(zone).toEpochSecond() / 60
        val end = date.plusDays(1).atStartOfDay(zone).toEpochSecond() / 60
        val day = Day(date, start, (end - start).toInt())
        val path = file(date)
        if (!Files.exists(path)) return day
        try {
            Files.readAllLines(path).forEach { line ->
                if (line.isBlank()) return@forEach
                try {
                    val node = mapper.readTree(line)
                    val minute = node.get("m").asLong()
                    node.get("s").properties().forEach { (name, v) ->
                        val values = (0 until v.size()).map { v.get(it).asLong() }
                        MinuteAgg.of(values)?.let { day.put(name, (minute - start).toInt(), it) }
                    }
                } catch (e: Exception) {
                    // 끄는 순간 반쯤 쓰인 줄 등은 건너뛴다
                }
            }
        } catch (e: Exception) {
            log.warn("Cannot read trend file: {} ({})", path, e.javaClass.simpleName)
        }
        return day
    }

    private fun cleanup(today: LocalDate) {
        val oldest = today.minusDays(props.trendKeepDays.toLong() - 1)
        try {
            Files.list(dir).use { files ->
                files.forEach { f ->
                    val m = FILE.matchEntire(f.fileName.toString()) ?: return@forEach
                    val d = runCatching { LocalDate.parse(m.groupValues[1]) }.getOrNull() ?: return@forEach
                    if (d.isBefore(oldest)) Files.deleteIfExists(f)
                }
            }
        } catch (e: Exception) {
            log.warn("Failed to clean up old trend files ({})", e.javaClass.simpleName)
        }
    }

    private fun file(date: LocalDate): Path = dir.resolve("trend-$date.jsonl")

    private fun dateOf(minute: Long): LocalDate = Instant.ofEpochSecond(minute * 60).atZone(zone).toLocalDate()

    companion object {
        /** 분이 끝나고 이만큼 기다렸다 닫는다(수집기가 0.5초~몇 초 늦게 보낸다) */
        const val CLOSE_DELAY_MS = 10_000L
        private const val MAX_CATCH_UP = 180L
        private val FILE = Regex("trend-(\\d{4}-\\d{2}-\\d{2})\\.jsonl")
    }
}

@RestController
class TrendController(private val trend: TrendStore) {
    @GetMapping("/api/trend")
    fun get(@RequestParam(required = false) date: String?): ResponseEntity<Map<String, Any?>> {
        val day =
            if (date.isNullOrBlank()) {
                null
            } else {
                try {
                    LocalDate.parse(date)
                } catch (e: DateTimeParseException) {
                    return ResponseEntity.badRequest().body(mapOf("error" to "date must be YYYY-MM-DD"))
                }
            }
        return ResponseEntity.ok(trend.view(day))
    }
}
