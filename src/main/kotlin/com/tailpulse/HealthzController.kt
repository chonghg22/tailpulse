package com.tailpulse

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

@RestController
class HealthzController {
    /** 배포 스크립트 · 컨테이너 헬스 체크 · 자체 감시(watchdog)는 "status":"UP" 을 보고 살아 있는지 판단한다 */
    @GetMapping("/healthz")
    fun healthz(): Map<String, Any> = mapOf("ok" to true, "status" to "UP")
}
