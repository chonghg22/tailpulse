package com.tailpulse

import org.springframework.boot.context.properties.ConfigurationProperties
import java.time.ZoneId

@ConfigurationProperties("tailpulse")
data class TailpulseProperties(
    /** 수집기가 보낼 때 쓰는 값(X-Tailpulse-Token 헤더). 비어 있으면 수신을 모두 거부한다 */
    val ingestToken: String = "",
    /** 화면 비밀번호(Basic 인증, 아이디는 아무 값). 비어 있으면 로그인 없이 연다 */
    val viewPassword: String = "",
    val retentionMinutes: Int = 30,
    val maxEventsPerService: Int = 200_000,
    val activeUserSeconds: Int = 300,
    /** 슬랙 웹훅 주소가 한 줄 들어 있는 파일. 비어 있으면 알림을 보내지 않는다 */
    val slackWebhookFile: String = "",
    /** 알림 문구 언어: en · ko. 화면은 브라우저에서 따로 고른다 */
    val lang: String = "en",
    /** 서비스 주소가 이 시간(초) 넘게 응답이 없으면 알린다 */
    val healthDownSeconds: Int = 60,
    /** 수집기 신호가 이 시간(초) 넘게 없으면 알린다(서버가 꺼졌을 수 있다) */
    val agentSilentSeconds: Int = 120,
    /** 최근 1분 서버 오류(5xx)가 이 건수 이상이면서 이 비율(%) 이상이면 알린다 */
    val errorSurgeCount: Int = 10,
    val errorSurgePercent: Int = 20,
    /** 직전 10분에 분당 이 건수 이상 들어오던 서비스가 3분 동안 0건이면 알린다 */
    val silenceMinPerMinute: Int = 20,
    /** 디스크 사용률(%) 경고 · 긴급 기준, 메모리 사용률(%) 기준(10분 넘게 이어질 때) */
    val diskWarnPercent: Int = 85,
    val diskCriticalPercent: Int = 95,
    val memoryWarnPercent: Int = 90,
    /** 1분 집계 파일(하루치 추이)을 두는 폴더. 그 아래 trend/ 에 날짜별 파일이 생긴다 */
    val dataDir: String = "data",
    /** 추이 파일 보관 일수(오늘 포함) */
    val trendKeepDays: Int = 7,
    /** 하루를 나누는 기준 시간대(예: Asia/Seoul, UTC). 비우면 서버(컨테이너)의 시간대 */
    val zone: String = "",
    val services: List<ServiceConfig> = emptyList(),
    /** 수집기 서버 이름(host) → 화면에 보일 이름. 서버가 끊겼을 때 클라우드 콘솔 등에서 바로 찾을 수 있는 이름을 적는다 */
    val hostInfo: Map<String, HostInfo> = emptyMap(),
) {
    fun zoneId(): ZoneId = if (zone.isBlank()) ZoneId.systemDefault() else ZoneId.of(zone)

    data class HostInfo(
        /** 화면에 보일 서버 이름 예: prod-web-1 (클라우드 콘솔의 인스턴스 이름 등) */
        val name: String = "",
        /** 하는 일 예: 쇼핑몰 웹 1번 */
        val role: String = "",
    )

    data class ServiceConfig(
        /** 수집기가 보내는 서비스 이름과 같아야 한다 (예: shop-web) */
        val name: String,
        /** 화면에 보일 이름 (예: 쇼핑몰) */
        val label: String = name,
        /** php · kotlin · web 등 화면 표시용 */
        val kind: String = "",
        /** 생존 확인 주소. 비우면 수집기 신호만으로 판단한다 */
        val healthUrl: String = "",
        /** 화면에서 주소 앞에 붙여 보여 줄 대표 주소 (예: https://shop.example.com). 호출하지는 않는다 */
        val url: String = "",
        /** 수집기가 돌아야 하는 서버 이름. 적어 두면 한 번도 신호가 없을 때도 알린다 */
        val hosts: List<String> = emptyList(),
    )
}
