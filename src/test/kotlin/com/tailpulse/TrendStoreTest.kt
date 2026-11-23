package com.tailpulse

import tools.jackson.databind.json.JsonMapper
import java.nio.file.Files
import java.nio.file.Path
import java.time.LocalDate
import java.time.ZoneId
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class TrendStoreTest {
    private val seoul = ZoneId.of("Asia/Seoul")
    // 앱은 켜질 때 실제 오늘 날짜로 오래된 기록을 지우므로 테스트 기준일도 오늘로 둔다(고정 날짜면 날이 지나 남길 파일까지 지워진다)
    private val day = LocalDate.now(seoul)
    private val t0 = day.atTime(10, 0).atZone(seoul).toInstant().toEpochMilli() // 10:00:00
    private val index = 600 // 10:00 은 하루의 600번째 분

    private fun props(dir: Path, keepDays: Int = 7) = TailpulseProperties(dataDir = dir.toString(), trendKeepDays = keepDays, zone = "Asia/Seoul", services = listOf(TailpulseProperties.ServiceConfig("a")))

    private fun event(t: Long, ms: Int? = 100, status: Int = 200, visitor: String? = "v1", static: Boolean = false) = RequestEvent(t, ms, status, "GET", "/x", visitor, static, "h1")

    private fun newStore(dir: Path, startMs: Long, keepDays: Int = 7): Pair<EventStore, TrendStore> {
        val p = props(dir, keepDays)
        val events = EventStore(p)
        val trend = TrendStore(p, events, JsonMapper())
        trend.begin(startMs)
        return events to trend
    }

    @Suppress("UNCHECKED_CAST")
    private fun series(trend: TrendStore, key: String): List<Number?> = ((trend.view(day)["series"] as Map<String, Map<String, List<Number?>>>)["a"] ?: emptyMap())[key] ?: emptyList()

    @Test
    fun `분이 끝나고 10초 뒤 1분 집계를 파일에 남기고 다시 켜면 읽어 온다`() {
        val dir = Files.createTempDirectory("trend")
        val (events, trend) = newStore(dir, t0)
        val st = events.state("a")
        st.heartbeat("h1", t0 + 1_000)
        st.add(listOf(event(t0 + 1_000, ms = 100), event(t0 + 2_000, ms = 300, status = 500, visitor = "v2"), event(t0 + 3_000, static = true)))
        assertTrue(trend.closeDue(t0 + 65_000).isEmpty(), "10초가 지나기 전에는 닫지 않는다")
        val updates = trend.closeDue(t0 + 70_000)
        assertEquals(1, updates.size)
        assertEquals(index, updates[0].index)
        val row = updates[0].rows.getValue("a")
        assertEquals(2, row["count"], "정적 파일은 빼고 센다")
        assertEquals(1, row["errors"])
        assertEquals(2, row["users"])
        assertEquals(400L, row["sumMs"])
        assertEquals(2, row["timed"])
        assertEquals(300, row["maxMs"])
        assertEquals(1, Files.readAllLines(dir.resolve("trend/trend-$day.jsonl")).size)

        val (_, again) = newStore(dir, t0 + 120_000)
        assertEquals(2, series(again, "count")[index])
        assertEquals(300, series(again, "maxMs")[index])
        assertNull(series(again, "count")[index - 1], "기록이 없던 분은 비어 있다")
    }

    @Test
    fun `재시작 앞뒤로 나뉜 분은 건수를 더하고 최대값은 큰 쪽을 쓴다`() {
        val dir = Files.createTempDirectory("trend")
        val (eventsA, a) = newStore(dir, t0)
        eventsA.state("a").heartbeat("h1", t0 + 1_000)
        eventsA.state("a").add(listOf(event(t0 + 1_000, ms = 900), event(t0 + 2_000, ms = 100, visitor = "v2")))
        a.flushAt(t0 + 30_000) // 10:00:30 에 끈다: 진행 중인 분을 반쯤 남긴다
        assertEquals(1, Files.readAllLines(dir.resolve("trend/trend-$day.jsonl")).size)
        assertTrue(a.closeDue(t0 + 70_000).isEmpty(), "끈 뒤에는 더 쓰지 않는다")

        val (eventsB, b) = newStore(dir, t0 + 40_000) // 10:00:40 에 다시 켜짐
        eventsB.state("a").heartbeat("h1", t0 + 45_000)
        eventsB.state("a").add(listOf(event(t0 + 45_000, ms = 200, visitor = "v9")))
        val updates = b.closeDue(t0 + 70_000)
        val row = updates.last().rows.getValue("a")
        assertEquals(3, row["count"])
        assertEquals(1200L, row["sumMs"])
        assertEquals(900, row["maxMs"])
        assertEquals(2, row["users"], "접속자는 큰 쪽(재시작 전 2명, 뒤 1명)")

        val (_, c) = newStore(dir, t0 + 120_000)
        assertEquals(3, series(c, "count")[index])
    }

    @Test
    fun `앱이 뜨기 전의 분은 늦게 들어온 요청이 있을 때만 남긴다`() {
        val dir = Files.createTempDirectory("trend")
        val (events, trend) = newStore(dir, t0 + 5_000) // 10:00:05 에 켜짐
        events.state("a").heartbeat("h1", t0 + 6_000)
        assertTrue(trend.closeDue(t0 + 10_000).isEmpty(), "09:59 는 요청이 없어 남기지 않는다")
        events.state("a").add(listOf(event(t0 + 7_000)))
        val updates = trend.closeDue(t0 + 70_000)
        assertEquals(listOf(index), updates.map { it.index })
    }

    @Test
    fun `반쯤 쓰인 줄은 건너뛰고 보관 기간이 지난 파일은 지운다`() {
        val dir = Files.createTempDirectory("trend")
        Files.createDirectories(dir.resolve("trend"))
        val minute = t0 / 60_000
        Files.writeString(dir.resolve("trend/trend-$day.jsonl"), "{\"m\":$minute,\"s\":{\"a\":[4,0,0,0,0,0,0,1]}}\n{\"m\":${minute + 1},\"s\":{\"a\":[1,")
        val old = dir.resolve("trend/trend-${day.minusDays(7)}.jsonl")
        val kept = dir.resolve("trend/trend-${day.minusDays(6)}.jsonl")
        Files.writeString(old, "")
        Files.writeString(kept, "")
        val (_, trend) = newStore(dir, t0 + 120_000, keepDays = 7)
        assertEquals(4, series(trend, "count")[index])
        assertNull(series(trend, "count")[index + 1])
        assertFalse(Files.exists(old), "8일 전 파일은 지운다")
        assertTrue(Files.exists(kept), "7일째 파일은 남긴다")
    }

    @Test
    fun `수집기도 요청도 없던 분은 0건이 아니라 빈칸이다`() {
        val dir = Files.createTempDirectory("trend")
        val (events, trend) = newStore(dir, t0 - 120_000)
        assertTrue(trend.closeDue(t0 + 70_000).none { it.rows.containsKey("a") })
        events.state("a").heartbeat("h1", t0 + 75_000) // 10:01 에 수집기가 붙음, 요청은 0건
        val updates = trend.closeDue(t0 + 130_000)
        assertEquals(0, updates.single().rows.getValue("a")["count"])
    }
}
