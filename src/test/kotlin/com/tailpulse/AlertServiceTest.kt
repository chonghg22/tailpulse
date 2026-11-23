package com.tailpulse

import tools.jackson.databind.json.JsonMapper
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AlertServiceTest {
    private fun service(props: TailpulseProperties): Pair<AlertService, EventStore> {
        val store = EventStore(props)
        return AlertService(props, store, HealthProbe(props), JsonMapper()) to store
    }

    @Test
    fun `슬랙 설정이 없어도 걸려 있는 문제를 화면용으로 모은다`() {
        val props = TailpulseProperties(agentSilentSeconds = 0, services = listOf(TailpulseProperties.ServiceConfig(name = "web", label = "웹", hosts = listOf("h1"))))
        val (alerts, store) = service(props)
        store.hosts["h2"] = HostSys(System.currentTimeMillis(), 10.0, 50.0, mapOf("/" to 90.0), null)
        alerts.check()
        alerts.checkHosts()
        val issues = alerts.issues()
        // 장애(수집 끊김)가 경고(디스크)보다 먼저
        assertEquals(listOf("agent:web:h1", "disk-warn:h2:/"), issues.map { it.key })
        assertEquals("critical", issues[0].level)
        assertEquals("web", issues[0].service)
        assertEquals("warning", issues[1].level)
        assertEquals(null, issues[1].service)
        // 화면은 두 언어를 함께 받아 고른다
        assertEquals("웹 · h1 수집 끊김", issues[0].title.ko)
        assertEquals("웹 · h1 agent silent", issues[0].title.en)
        assertEquals("h2 · disk low", issues[1].title.pick("en"))
    }

    @Test
    fun `풀리면 목록에서 빠지고 값이 끊긴 서버의 자원 경고도 지운다`() {
        val props = TailpulseProperties(agentSilentSeconds = 600, services = listOf(TailpulseProperties.ServiceConfig(name = "web", hosts = listOf("h1"))))
        val (alerts, store) = service(props)
        store.hosts["h1"] = HostSys(System.currentTimeMillis(), 10.0, 50.0, mapOf("/" to 97.0), null)
        alerts.checkHosts()
        assertEquals(setOf("disk-critical:h1:/", "disk-warn:h1:/"), alerts.issues().map { it.key }.toSet())
        store.hosts["h1"] = HostSys(System.currentTimeMillis(), 10.0, 50.0, mapOf("/" to 40.0), null)
        alerts.checkHosts()
        assertTrue(alerts.issues().isEmpty())
        store.hosts["h1"] = HostSys(System.currentTimeMillis(), 10.0, 50.0, mapOf("/" to 97.0), null)
        alerts.checkHosts()
        store.hosts["h1"] = HostSys(System.currentTimeMillis() - 300_000, 10.0, 50.0, mapOf("/" to 97.0), null)
        alerts.checkHosts()
        assertTrue(alerts.issues().isEmpty())
    }
}
