package com.tailpulse

import kotlin.test.Test
import kotlin.test.assertEquals

class EventStoreTest {
    private fun event(t: Long, ms: Int? = 100, status: Int = 200, visitor: String? = "a", static: Boolean = false) =
        RequestEvent(t, ms, status, "GET", "/x", visitor, static, "h1")

    @Test
    fun `초 단위로 요청 수와 오류와 응답 시간을 모은다`() {
        val state = ServiceState(maxEvents = 100)
        state.add(listOf(event(10_100, ms = 100), event(10_900, ms = 300, status = 500), event(10_950, status = 404), event(11_000)))
        val b = state.seconds.getValue(10)
        assertEquals(3, b.count)
        assertEquals(1, b.error)
        assertEquals(1, b.clientError)
        assertEquals(500, b.sumMs)
        assertEquals(1, state.seconds.getValue(11).count)
    }

    @Test
    fun `정적 파일은 요청 수와 접속자에 넣지 않는다`() {
        val state = ServiceState(maxEvents = 100)
        state.add(listOf(event(5_000, visitor = "img", static = true), event(5_100, visitor = "page")))
        assertEquals(1, state.seconds.getValue(5).count)
        assertEquals(1, state.seconds.getValue(5).staticCount)
        assertEquals(setOf("page"), state.visitors.keys)
    }

    @Test
    fun `보관 한도와 기간을 넘으면 오래된 것부터 버린다`() {
        val state = ServiceState(maxEvents = 3)
        state.add((1..5).map { event(it * 1000L, visitor = "v$it") })
        assertEquals(3, state.events.size)
        assertEquals(3_000, state.events.first().t)
        state.prune(now = 400_000, retentionMs = 60_000, activeUserSeconds = 300)
        assertEquals(0, state.events.size)
        assertEquals(0, state.seconds.size)
        assertEquals(0, state.visitors.size)
    }
}
