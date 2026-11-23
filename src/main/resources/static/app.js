/* tailpulse 화면. 서버가 1초마다 보내는 집계(/api/stream)를 그린다. 외부 라이브러리 없음.
   언어: ?lang=ko|en → 저장된 값(localStorage tailpulse.lang) → 브라우저 언어 순으로 고른다. */
(function () {
  'use strict';

  /* ---------- 문구 (한국어 · 영어) ---------- */
  var I18N = {
    ko: {
      'title': '실시간 접속 현황',
      'tabs.aria': '보기', 'tab.live': '실시간', 'tab.dev': '개발자', 'tab.today': '오늘 추이',
      'sound.title': '서버가 끊기거나 장애가 생기면 소리와 알림으로 알려 줍니다(이 브라우저에서만)',
      'sound.on': '알림 소리 켬', 'sound.off': '알림 소리 끔',
      'conn.connecting': '연결 중', 'conn.on': '실시간 연결됨', 'conn.off': '연결 끊김 · 다시 연결하는 중',
      'status.loading': '상태를 불러오는 중',
      'servers': '서버', 'servers.hint': '수집기가 10초마다 보내는 신호로 본다 · 30초 넘게 없으면 늦음, 2분 넘게 없으면 끊김',
      'servers.empty': '수집기를 단 서버가 아직 없습니다',
      'filters.aria': '서비스 선택', 'tiles.aria': '요약',
      'tile.servers': '서버', 'tile.users': '접속자', 'tile.requests': '요청 수', 'tile.avg': '평균 응답 시간', 'tile.err': '서버 오류율',
      'sub.last5m': '최근 5분', 'sub.last10s': '최근 10초', 'sub.last1m': '최근 1분',
      'svc.title': '서비스', 'svc.hint': '최근 1분 기준 · 줄을 누르면 그 서비스만 본다',
      'th.svcHost': '서비스 · 서버', 'th.state': '상태', 'th.users': '접속자', 'th.last1s': '방금 1초', 'th.last1m': '최근 1분',
      'th.avg': '평균 응답', 'th.err': '서버 오류', 'th.time': '시각', 'th.service': '서비스', 'th.path': '주소', 'th.resp': '응답',
      'th.code': '코드', 'th.count': '요청 수', 'th.max': '최대 응답', 'th.todayReq': '오늘 요청', 'th.ydayUntil': '어제 이 시각까지',
      'th.peakMin': '분당 최대', 'th.peakUsers': '접속자 최대', 'th.slowest': '가장 느린 요청',
      'chart.req': '요청 수', 'chart.req.hint': '최근 10분 · 5초마다 건수(이미지 · js · css 제외)',
      'chart.avg': '평균 응답 시간', 'chart.avg.hint': '최근 10분',
      'chart.users': '접속자 수', 'chart.users.hint': '최근 10분 · 그 시각의 최근 5분 접속자',
      'dots.title': '요청 한 건 한 건', 'dots.hint': '점 하나가 요청 하나, 위에 있을수록 오래 걸린 요청 · 최근 5분 · 점에 마우스를 올리면 주소',
      'dots.empty': '최근 5분 동안 응답 시간이 기록된 요청이 없습니다',
      'feed.title': '방금 들어온 요청', 'feed.hint': '최근 것부터 · 마우스를 올리면 멈춤', 'feed.hintPaused': '멈춤 · 마우스를 빼면 다시 흐름',
      'feed.pause': '멈춤', 'feed.resume': '다시 흐르게',
      'empty.noRequests': '아직 들어온 요청이 없습니다',
      'slow.title': '느린 요청 · 서버 오류', 'slow.hint': '3초 이상 또는 5xx, 최근 10분 · 최근 것부터', 'slow.empty': '최근 10분 동안 없습니다',
      'top.title': '주소별', 'top.hint': '최근 5분 · 제목을 누르면 그 순서로(많이 불린 · 느린 · 오류 많은 주소)',
      'today.title': '오늘 추이', 'today.hint': '00시부터 1분 단위 기록 · 수집 서버를 다시 켜도 이어진다 · 작은 글씨는 그 시각',
      'cmp': '어제 같이 보기', 'cmp.on': '어제 같이 보기 · 점선', 'trend.empty': '아직 오늘 기록이 없습니다',
      'day.count.hint': '1분마다 들어온 건수(이미지 · js · css 제외)', 'day.users.hint': '1분마다 잰 최근 5분 접속자',
      'day.avg.hint': '1분 평균', 'day.max': '가장 느린 요청', 'day.max.hint': '1분마다 가장 오래 걸린 한 건',
      'day.noTimed': '응답 시간이 기록된 요청이 없습니다',
      'dot.ok': '1초 미만', 'dot.slow': '1~3초', 'dot.vslow': '3초 이상', 'dot.err': '서버 오류(5xx) ✕', 'dot.cerr': '요청 오류(4xx)',
      'u.s': '초', 'u.m': '분', 'u.h': '시간',
      'st.waiting': '신호 기다리는 중', 'st.noSignal': '신호 없음', 'st.neverSince': '켜진 뒤 한 번도 안 옴', 'st.ok': '정상',
      'st.late': '신호 늦음', 'st.forSec': '{0}초째', 'st.down': '끊김', 'st.for': '{0}째', 'st.noResp': '응답 없음', 'st.since': '{0}부터',
      'st.noData': '기록 없음', 'st.justStarted': '수집 서버가 방금 켜짐', 'st.nServers': '서버 {0}대', 'st.noServer': '받는 서버 없음',
      'st.allDown': '서버 {0}대 모두 끊김 · 늦음', 'st.someDown': '일부 서버 끊김', 'st.onlyOk': '서버 {0}대 중 {1}대만 정상',
      'imp.ok': '{0} → {1}가 계속 받는 중', 'imp.bad': '{0} → 받을 서버 없음(서비스 중단 가능)',
      'card.lost': '신호 끊김 · {0}', 'card.late': '신호 늦음 · {0}초째', 'card.req': '최근 1분 요청 {0}건', 'card.err': ' · 서버 오류 {0}건',
      'card.mem': '메모리', 'card.disk': '디스크', 'card.noLast': '마지막 신호 없음', 'card.last': '마지막 신호 {0}', 'card.ago': ' ({0}초 전)',
      'is.conn': '모니터링 서버와 연결 끊김',
      'is.connWhy': '지금 보이는 값은 {0} 기준입니다. 연결이 돌아올 때까지 다른 서버 상태는 알 수 없습니다.',
      'is.connHow': '자동으로 다시 연결하는 중 · 계속되면 tailpulse 서버와 인터넷 연결을 확인하세요',
      'is.hostDown': '{0} 서버 신호 끊김', 'is.hostLate': '{0} 서버 신호 늦음', 'is.never': '켜진 뒤 신호가 한 번도 오지 않았습니다',
      'is.last': '마지막 신호 {0}',
      'is.downHow': '서버가 꺼졌거나 네트워크 · 수집기가 멈췄을 수 있습니다. 서버 「{0}」의 상태와 사이트 접속을 확인하세요',
      'is.lateHow': '잠깐 밀린 것일 수 있습니다. 2분을 넘기면 끊김으로 바뀝니다',
      'hd.down': '서버 끊김: {0}', 'hd.crit': '장애 {0}건', 'hd.andWarn': ' · 경고 {0}건', 'hd.warn': '경고 {0}건', 'hd.ok': '모두 정상',
      'hd.sub': '서버 {0}대 중 {1}대 정상 · 서비스 {2}개', 'hd.subLast': ' · 마지막 신호 {0}초 전',
      'lv.critical': '장애', 'lv.warning': '경고', 'lv.for': '{0}부터 · {1}째', 'lv.impact': '영향',
      'tl.up': '대 정상', 'tl.check': '확인 필요 {0}', 'tl.allOk': '모두 정상', 'tl.none': '수집 중인 서버 없음', 'tl.people': '명', 'tl.req': '건',
      'tl.usersSum': '최근 5분 · 서비스별 합', 'tl.reqSub': '최근 1분 · 방금 1초에 {0}건', 'tl.errSub': '최근 1분 {0}건',
      'vs.same': '어제 이 시각보다 비슷', 'vs.more': '어제 이 시각보다 {0}% 많음 ↑', 'vs.less': '어제 이 시각보다 {0}% 적음 ↓',
      'tb.showAll': '눌러서 전체 보기', 'tb.only': '눌러서 {0}만 보기', 'tb.errRate': '{0}건 ({1}%)', 'tb.n': '{0}건',
      'chip.all': '전체', 'tip.code': ' · 코드 {0}', 'fmt.count': '{0}건', 'fmt.users': '{0}명', 'axis.h': '{0}시',
      'peak': '최대 {0} · {1}', 'tip.yday': '어제 {0}', 'tr.today': '오늘 {0}%'
    },
    en: {
      'title': 'Live traffic',
      'tabs.aria': 'Views', 'tab.live': 'Live', 'tab.dev': 'Developer', 'tab.today': 'Today',
      'sound.title': 'Beep and show a notification when a server goes down or a critical issue starts (this browser only)',
      'sound.on': 'Sound on', 'sound.off': 'Sound off',
      'conn.connecting': 'Connecting', 'conn.on': 'Live', 'conn.off': 'Disconnected · reconnecting',
      'status.loading': 'Loading status',
      'servers': 'Servers', 'servers.hint': 'from the heartbeat agents send every 10 s · late after 30 s, down after 2 min',
      'servers.empty': 'No server is running an agent yet',
      'filters.aria': 'Choose service', 'tiles.aria': 'Summary',
      'tile.servers': 'Servers', 'tile.users': 'Visitors', 'tile.requests': 'Requests', 'tile.avg': 'Avg response time', 'tile.err': 'Server error rate',
      'sub.last5m': 'last 5 min', 'sub.last10s': 'last 10 s', 'sub.last1m': 'last 1 min',
      'svc.title': 'Services', 'svc.hint': 'last 1 min · click a row to show only that service',
      'th.svcHost': 'Service · server', 'th.state': 'Status', 'th.users': 'Visitors', 'th.last1s': 'Last 1 s', 'th.last1m': 'Last 1 min',
      'th.avg': 'Avg resp.', 'th.err': 'Server errors', 'th.time': 'Time', 'th.service': 'Service', 'th.path': 'Path', 'th.resp': 'Resp.',
      'th.code': 'Code', 'th.count': 'Requests', 'th.max': 'Max resp.', 'th.todayReq': 'Requests today', 'th.ydayUntil': 'Yesterday by now',
      'th.peakMin': 'Peak / min', 'th.peakUsers': 'Peak visitors', 'th.slowest': 'Slowest request',
      'chart.req': 'Requests', 'chart.req.hint': 'last 10 min · per 5 s (images, js, css excluded)',
      'chart.avg': 'Avg response time', 'chart.avg.hint': 'last 10 min',
      'chart.users': 'Visitors', 'chart.users.hint': 'last 10 min · visitors in the 5 min before each point',
      'dots.title': 'Every request', 'dots.hint': 'one dot per request, higher = slower · last 5 min · hover a dot for its path',
      'dots.empty': 'No requests with a response time in the last 5 min',
      'feed.title': 'Latest requests', 'feed.hint': 'newest first · hover to pause', 'feed.hintPaused': 'paused · move the mouse away to resume',
      'feed.pause': 'Pause', 'feed.resume': 'Resume',
      'empty.noRequests': 'No requests yet',
      'slow.title': 'Slow requests · server errors', 'slow.hint': '3 s or slower, or 5xx · last 10 min · newest first', 'slow.empty': 'None in the last 10 min',
      'top.title': 'By path', 'top.hint': 'last 5 min · click a header to sort (most called, slowest, most errors)',
      'today.title': 'Today', 'today.hint': '1-minute records since midnight · survive collector restarts · small text = when',
      'cmp': 'Compare with yesterday', 'cmp.on': 'Yesterday shown · dashed', 'trend.empty': 'No records today yet',
      'day.count.hint': 'per minute (images, js, css excluded)', 'day.users.hint': 'visitors in the last 5 min, measured every minute',
      'day.avg.hint': '1-minute average', 'day.max': 'Slowest request', 'day.max.hint': 'slowest single request per minute',
      'day.noTimed': 'No requests with a response time',
      'dot.ok': '< 1 s', 'dot.slow': '1–3 s', 'dot.vslow': '≥ 3 s', 'dot.err': 'Server error (5xx) ✕', 'dot.cerr': 'Client error (4xx)',
      'u.s': 's', 'u.m': 'm', 'u.h': 'h',
      'st.waiting': 'Waiting for signal', 'st.noSignal': 'No signal', 'st.neverSince': 'none since start', 'st.ok': 'OK',
      'st.late': 'Late', 'st.forSec': 'for {0}s', 'st.down': 'Down', 'st.for': 'for {0}', 'st.noResp': 'Not responding', 'st.since': 'since {0}',
      'st.noData': 'No data', 'st.justStarted': 'collector just started', 'st.nServers': function (n) { return plural(n, 'server'); },
      'st.noServer': 'No server serving',
      'st.allDown': function (n) { return n == 1 ? 'its only server is down or late' : 'all ' + n + ' servers down or late'; }, 'st.someDown': 'Some servers down', 'st.onlyOk': 'only {1} of {0} servers OK',
      'imp.ok': '{0} → still served by {1}', 'imp.bad': '{0} → no other server (service may be down)',
      'card.lost': 'Signal lost · {0}', 'card.late': 'Signal late · {0}s', 'card.req': function (n) { return plural(n, 'request') + ' in the last minute'; },
      'card.err': function (n) { return ' · ' + plural(n, 'server error'); },
      'card.mem': 'Memory', 'card.disk': 'Disk', 'card.noLast': 'No signal yet', 'card.last': 'Last signal {0}', 'card.ago': ' ({0}s ago)',
      'is.conn': 'Lost connection to the tailpulse server',
      'is.connWhy': 'Values shown are as of {0}. Other servers’ state is unknown until the connection returns.',
      'is.connHow': 'Reconnecting automatically · if it persists, check the tailpulse server and your network',
      'is.hostDown': '{0}: signal lost', 'is.hostLate': '{0}: signal late', 'is.never': 'no signal since the collector started',
      'is.last': 'last signal {0}',
      'is.downHow': 'The server may be off, or the network or agent may have stopped. Check server “{0}” and whether the site opens',
      'is.lateHow': 'Could be a short delay. Turns into “down” after 2 minutes',
      'hd.down': 'Server down: {0}', 'hd.crit': '{0} critical', 'hd.ok': 'All OK',
      'hd.andWarn': function (n) { return ' · ' + plural(n, 'warning'); }, 'hd.warn': function (n) { return plural(n, 'warning'); },
      'hd.sub': function (n, up, svc) { return up + ' of ' + plural(n, 'server') + ' OK · ' + plural(svc, 'service'); }, 'hd.subLast': ' · last signal {0}s ago',
      'lv.critical': 'Critical', 'lv.warning': 'Warning', 'lv.for': 'since {0} · {1}', 'lv.impact': 'Impact',
      'tl.up': ' up', 'tl.check': 'Check {0}', 'tl.allOk': 'All OK', 'tl.none': 'No servers reporting', 'tl.people': '', 'tl.req': '',
      'tl.usersSum': 'last 5 min · sum of services', 'tl.reqSub': 'last 1 min · {0} in the last second', 'tl.errSub': '{0} in the last minute',
      'vs.same': 'about the same as yesterday', 'vs.more': '{0}% more than yesterday ↑', 'vs.less': '{0}% less than yesterday ↓',
      'tb.showAll': 'Click to show all', 'tb.only': 'Click to show only {0}', 'tb.errRate': '{0} ({1}%)', 'tb.n': '{0}',
      'chip.all': 'All', 'tip.code': ' · code {0}', 'fmt.count': '{0}', 'fmt.users': '{0}', 'axis.h': '{0}:00',
      'peak': 'max {0} · {1}', 'tip.yday': 'yesterday {0}', 'tr.today': 'today {0}%'
    }
  };
  /* 영어 단수 · 복수. n 은 숫자이거나 나라별 형식으로 찍은 문자열 */
  function plural(n, word) { return n + ' ' + word + (String(n) === '1' ? '' : 's'); }
  function pickLang() {
    var q = /[?&]lang=(ko|en)\b/.exec(location.search);
    if (q) return q[1];
    var saved = null;
    try { saved = localStorage.getItem('tailpulse.lang'); } catch (e) { /* 저장소 막힘 */ }
    if (saved === 'ko' || saved === 'en') return saved;
    return /^ko\b/i.test(navigator.language || '') ? 'ko' : 'en';
  }
  var lang = pickLang();
  function t(key) {
    var s = I18N[lang][key];
    if (s == null) s = I18N.en[key];
    if (s == null) return key;
    if (typeof s === 'function') return s.apply(null, Array.prototype.slice.call(arguments, 1));
    for (var i = 1; i < arguments.length; i++) s = s.split('{' + (i - 1) + '}').join(String(arguments[i]));
    return s;
  }
  /* 서버가 계산한 문구는 {ko, en} 둘 다 온다 */
  function pick(v) { return v == null ? '' : typeof v === 'string' ? v : (v[lang] || v.en || v.ko || ''); }
  var nf = new Intl.NumberFormat(lang === 'ko' ? 'ko-KR' : 'en-US');

  var SERIES_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9'];
  var C = { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b', muted: '#898781', ink: '#f0efec', ink2: '#c3c2b7', line: '#2c2c2a', surface: '#1a1a19' };
  var DOT_CLASSES = [
    { key: 'ok', color: C.good },
    { key: 'slow', color: C.warning },
    { key: 'vslow', color: C.serious },
    { key: 'err', color: C.critical },
    { key: 'cerr', color: C.muted }
  ];
  function dotLabel(c) { return t('dot.' + DOT_CLASSES[c].key); }
  var DOT_WINDOW = 300; // 점 그래프에 보이는 초
  var LINE_WINDOW = 600; // 선 그래프에 보이는 초
  var KEEP_MS = 600000;

  var services = []; // 서버가 준 요약 (순서 = 색 순서)
  var filter = -1; // -1 = 전체
  var dots = [];
  var hist = []; // 서비스별 [{t(초), tps, avg, users}]
  var top = [];
  var serverOffset = 0; // 서버 시각 - 내 시각
  var hover = {}; // 캔버스 id → 포인터 위치
  var plots = {}; // 캔버스 id → 마지막으로 그린 좌표 정보
  var trend = null; // 오늘 1분 집계 {date, minutes, series: {서비스: {count[], errors[], users[], sumMs[], timed[], maxMs[]}}}
  var TREND_KEYS = ['count', 'errors', 'users', 'sumMs', 'timed', 'maxMs'];
  var yesterday = null; // 어제 1분 집계(같은 모양). 없으면 null
  var compare = false; // 오늘 추이 그래프에 어제를 겹쳐 그린다
  var hostInfo = {}; // 수집기 서버 이름 → {name, role}
  var startedAt = 0; // 수집 서버가 켜진 시각(갓 켜졌을 때는 신호가 아직 없는 게 정상)
  var issues = []; // 서버가 계산한 지금 걸려 있는 문제
  var connected = false;
  var lostAt = 0; // 실시간 연결이 끊긴 시각
  var lastTickAt = 0; // 마지막으로 받은 값의 서버 시각
  var view = location.hash === '#today' ? 'today' : location.hash === '#dev' ? 'dev' : 'live';
  var feedPaused = false, feedHover = false, feedShown = {}; // 개발자 보기: 방금 들어온 요청
  var topSort = 'count'; // 주소별 표 순서
  var sound = false;
  try { sound = localStorage.getItem('tailpulse.sound') === 'on'; } catch (e) { /* 저장소 막힘 */ }
  var announced = {}; // 소리 · 알림을 이미 낸 문제

  var $ = function (id) { return document.getElementById(id); };
  function fmtMs(ms) {
    if (ms == null) return '-';
    return ms >= 1000 ? (ms / 1000).toFixed(ms >= 10000 ? 0 : 1) + t('u.s') : Math.round(ms) + 'ms';
  }
  function fmtTime(x) {
    var d = new Date(x);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
  }
  function now() { return Date.now() + serverOffset; }
  function fmtDur(sec) {
    sec = Math.max(0, Math.round(sec));
    if (sec < 60) return sec + t('u.s');
    if (sec < 3600) return Math.floor(sec / 60) + t('u.m') + (sec < 600 && sec % 60 ? ' ' + (sec % 60) + t('u.s') : '');
    return Math.floor(sec / 3600) + t('u.h') + ' ' + Math.floor(sec % 3600 / 60) + t('u.m');
  }
  function hostName(h) { var x = hostInfo[h]; return x && x.name ? x.name : h; }
  function hostRole(h) { var x = hostInfo[h]; return x && x.role ? x.role : ''; }
  function td(cls, text, label) {
    var c = el('td', cls, text);
    if (label) c.setAttribute('data-label', label);
    return c;
  }
  function color(i) { return SERIES_COLORS[i % SERIES_COLORS.length]; }
  function shown(i) { return filter < 0 || filter === i; }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function fullPath(i, method, path) {
    var base = services[i] && services[i].url ? services[i].url.replace(/\/$/, '') : '';
    return (method ? method + ' ' : '') + base + path;
  }
  function dotClass(d) {
    if (d.s >= 500) return 3;
    if (d.s >= 400) return 4;
    if (d.ms != null && d.ms >= 3000) return 2;
    if (d.ms != null && d.ms >= 1000) return 1;
    return 0;
  }

  /* ---------- 고정 문구 ---------- */
  function applyStaticText() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(function (n) { n.textContent = t(n.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-title]').forEach(function (n) { n.title = t(n.getAttribute('data-i18n-title')); });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (n) { n.setAttribute('aria-label', t(n.getAttribute('data-i18n-aria'))); });
    var lb = $('lang');
    lb.textContent = lang === 'ko' ? 'English' : '한국어';
    lb.setAttribute('lang', lang === 'ko' ? 'en' : 'ko');
    $('cmp').textContent = t(compare ? 'cmp.on' : 'cmp');
    $('feed-pause').textContent = t(feedPaused ? 'feed.resume' : 'feed.pause');
    $('feed-hint').textContent = t(feedHover ? 'feed.hintPaused' : 'feed.hint');
    $('conn-text').textContent = connected ? t('conn.on') : lostAt ? t('conn.off') : t('conn.connecting');
  }
  function setLang(l) {
    lang = l;
    nf = new Intl.NumberFormat(lang === 'ko' ? 'ko-KR' : 'en-US');
    try { localStorage.setItem('tailpulse.lang', l); } catch (e) { /* 저장소 막힘 */ }
    if (/[?&]lang=/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash);
    applyStaticText();
    renderSound();
    renderChips();
    renderLegends();
    rerender();
  }

  /* ---------- 데이터 ---------- */
  function applyServices(list) {
    var changed = list.length !== services.length;
    services = list;
    while (hist.length < services.length) hist.push([]);
    if (changed) { renderChips(); renderLegends(); }
  }
  function loadSnapshot() {
    return fetch('api/snapshot', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (snap) {
      serverOffset = snap.now - Date.now();
      lastTickAt = snap.now;
      startedAt = snap.startedAt || 0;
      hostInfo = snap.hostInfo || {};
      issues = snap.issues || [];
      hist = [];
      applyServices(snap.services);
      snap.series.forEach(function (s, i) {
        var users = s.users || [];
        var u = 0, ui = 0, rows = [];
        for (var k = 0; k < snap.seconds; k++) {
          var sec = snap.fromSec + k;
          while (ui < users.length && users[ui][0] <= sec) { u = users[ui][1]; ui++; }
          rows.push({ t: sec, tps: s.count[k], avg: s.avgMs[k] || null, users: ui > 0 ? u : null });
        }
        hist[i] = rows;
      });
      dots = snap.dots.slice().sort(function (a, b) { return a.t - b.t; });
      top = snap.top || [];
      renderAll();
      return loadTrend();
    });
  }
  function loadTrend() {
    return fetch('api/trend', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (x) {
      var dayChanged = !trend || trend.date !== x.date;
      trend = x;
      renderTrend();
      renderTiles();
      if (dayChanged) loadYesterday();
    });
  }
  function dayBefore(date) {
    var p = date.split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2] - 1)).toISOString().slice(0, 10);
  }
  /* 어제 기록(파일)은 하루에 한 번만 받으면 된다 */
  function loadYesterday() {
    if (!trend) return;
    fetch('api/trend?date=' + dayBefore(trend.date), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (y) {
      yesterday = y && Object.keys(y.series || {}).length ? y : null;
      renderTrend();
      renderTiles();
    }).catch(function () { yesterday = null; });
  }
  /* 1분이 닫힐 때마다 서버가 그 분의 값(재시작 앞뒤를 합친 값)을 보낸다 */
  function applyTrend(list) {
    var reload = false;
    list.forEach(function (u) {
      if (!trend || trend.date !== u.date) { reload = true; return; } // 날짜가 바뀌었다
      Object.keys(u.rows).forEach(function (name) {
        var tr = trend.series[name];
        if (!tr) {
          tr = trend.series[name] = {};
          TREND_KEYS.forEach(function (key) { tr[key] = new Array(trend.minutes).fill(null); });
        }
        TREND_KEYS.forEach(function (key) { tr[key][u.index] = u.rows[name][key]; });
      });
      if (trend.lastIndex == null || u.index > trend.lastIndex) trend.lastIndex = u.index;
    });
    if (reload) loadTrend().catch(function () { /* 다음 분에 다시 */ });
    else renderTrend();
  }
  function onTick(p) {
    serverOffset = p.now - Date.now();
    lastTickAt = p.now;
    if (p.issues) issues = p.issues;
    applyServices(p.services);
    var sec = Math.floor(p.now / 1000) - 1;
    p.services.forEach(function (s, i) {
      var h = hist[i];
      if (h.length && h[h.length - 1].t >= sec) return;
      h.push({ t: sec, tps: s.tps, avg: s.avgMs, users: s.users });
      while (h.length && h[0].t < sec - LINE_WINDOW - 5) h.shift();
    });
    if (p.dots && p.dots.length) Array.prototype.push.apply(dots, p.dots);
    var cut = p.now - KEEP_MS;
    var drop = 0;
    while (drop < dots.length && dots[drop].t < cut) drop++;
    if (drop) dots.splice(0, drop);
    if (dots.length > 40000) dots.splice(0, dots.length - 40000);
    if (p.top) top = p.top;
    renderAll();
    if (p.trend) applyTrend(p.trend);
  }
  /* 실시간 연결은 직접 다시 맺는다. 브라우저 EventSource 는 다시 연결할 때 502 같은 응답을 한 번 받으면 영영 포기해서
     수집 서버를 다시 켤 때(배포 · 설정 반영) 열어 둔 화면이 '연결 끊김'에 멈춰 버린다.
     연결은 살아 있는데 신호만 멈춘 경우(노트북 잠자기 · 와이파이 바뀜)도 STALL_MS 동안 tick 이 없으면 다시 맺는다. */
  var STALL_MS = 20000, RELOAD_AFTER_MS = 3 * 60 * 1000;
  var es = null, retryMs = 2000, retryTimer = 0, lastMsgAt = 0, needSnapshot = false;
  function connect() {
    clearTimeout(retryTimer);
    retryTimer = 0;
    if (es) es.close();
    es = new EventSource('api/stream');
    lastMsgAt = Date.now();
    es.addEventListener('tick', function (e) {
      lastMsgAt = Date.now();
      retryMs = 2000;
      if (!connected) setConn(true);
      if (needSnapshot) { // 끊긴 사이 값을 통째로 다시 받는다
        needSnapshot = false;
        loadSnapshot().catch(function () { needSnapshot = true; });
        return;
      }
      onTick(JSON.parse(e.data));
    });
    es.onerror = dropped;
  }
  function dropped() {
    needSnapshot = true;
    if (connected || !lostAt) setConn(false);
    if (es) { es.close(); es = null; }
    if (!retryTimer) {
      retryTimer = setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, 30000);
    }
  }
  /* 1초마다: 신호가 멈췄는지 보고, 그래도 오래 못 붙으면 서버가 응답할 때 화면을 새로 연다(마지막 안전장치) */
  var reloading = false;
  function watchConn() {
    if (es && Date.now() - lastMsgAt > STALL_MS) dropped();
    if (!connected && lostAt && Date.now() - lostAt > RELOAD_AFTER_MS && !reloading) {
      reloading = true;
      fetch('healthz', { cache: 'no-store' })
        .then(function (r) { if (r.ok) location.reload(); else reloading = false; })
        .catch(function () { reloading = false; }); // 서버가 아직 없으면 새로 열지 않는다(오류 화면에 멈추지 않게)
    }
  }
  function setConn(on) {
    connected = on;
    if (!on && !lostAt) lostAt = Date.now();
    if (on) lostAt = 0;
    $('conn').className = 'conn ' + (on ? 'on' : 'off');
    $('conn-text').textContent = on ? t('conn.on') : t('conn.off');
    renderStatus();
  }

  /* ---------- 위쪽: 서비스 선택 · 요약 · 표 ---------- */
  function renderChips() {
    var box = $('chips');
    box.textContent = '';
    var all = el('button', 'chip', t('chip.all'));
    all.type = 'button';
    all.setAttribute('aria-pressed', String(filter < 0));
    all.onclick = function () { setFilter(-1); };
    box.appendChild(all);
    services.forEach(function (s, i) {
      var b = el('button', 'chip');
      b.type = 'button';
      var sw = el('span', 'swatch');
      sw.style.background = color(i);
      b.appendChild(sw);
      b.appendChild(document.createTextNode(s.label));
      b.setAttribute('aria-pressed', String(filter === i));
      b.onclick = function () { setFilter(filter === i ? -1 : i); };
      box.appendChild(b);
    });
  }
  function setFilter(i) { filter = i; renderChips(); renderLegends(); rerender(); }
  function renderLegends() {
    document.querySelectorAll('[data-legend]').forEach(function (ul) {
      ul.textContent = '';
      var list = services.map(function (s, i) { return { s: s, i: i }; }).filter(function (x) { return shown(x.i); });
      if (list.length < 2) return; // 선이 하나면 제목과 선택 버튼이 이름을 대신한다
      list.forEach(function (x) {
        var li = el('li');
        var m = el('span', 'swatch');
        m.style.background = color(x.i);
        li.appendChild(m);
        li.appendChild(document.createTextNode(x.s.label));
        ul.appendChild(li);
      });
    });
    var dl = $('dot-legend');
    dl.textContent = '';
    DOT_CLASSES.forEach(function (c, k) {
      var li = el('li');
      var m = el('span', 'mark');
      m.style.background = c.color;
      li.appendChild(m);
      li.appendChild(document.createTextNode(dotLabel(k)));
      dl.appendChild(li);
    });
  }
  /* 수집기 신호로 본 서버 상태. 30초까지 정상, 2분까지 늦음(잠깐 밀린 것일 수 있다), 그 뒤로 끊김 */
  var LATE_SEC = 30, DOWN_SEC = 120;
  function justStarted() { return now() - startedAt < DOWN_SEC * 1000; }
  function hostState(a) {
    if (a.ageSec == null) {
      return justStarted() ? { cls: 'idle', ico: '·', text: t('st.waiting'), sub: '' } : { cls: 'down', ico: '!', text: t('st.noSignal'), sub: t('st.neverSince') };
    }
    if (a.ageSec <= LATE_SEC) return { cls: 'up', ico: '✓', text: t('st.ok'), sub: '' };
    if (a.ageSec <= DOWN_SEC) return { cls: 'warn', ico: '!', text: t('st.late'), sub: t('st.forSec', a.ageSec) };
    return { cls: 'down', ico: '!', text: t('st.down'), sub: t('st.for', fmtDur(a.ageSec)) };
  }
  function stateOf(s) {
    if (s.health) {
      return s.health.up
        ? { cls: 'up', ico: '✓', text: t('st.ok'), sub: s.health.ms + 'ms' }
        : { cls: 'down', ico: '!', text: t('st.noResp'), sub: t('st.since', fmtTime(s.health.since)) };
    }
    var hosts = s.agents || [];
    if (!hosts.length) return { cls: 'idle', ico: '·', text: t('st.noData'), sub: '' };
    var states = hosts.map(hostState);
    var ok = states.filter(function (x) { return x.cls === 'up'; }).length;
    var waiting = states.filter(function (x) { return x.cls === 'idle'; }).length;
    if (ok + waiting === hosts.length && waiting) return { cls: 'idle', ico: '·', text: t('st.waiting'), sub: t('st.justStarted') };
    if (ok === hosts.length) return { cls: 'up', ico: '✓', text: t('st.ok'), sub: t('st.nServers', hosts.length) };
    if (ok === 0) return { cls: 'down', ico: '!', text: t('st.noServer'), sub: t('st.allDown', hosts.length) };
    return { cls: 'warn', ico: '!', text: t('st.someDown'), sub: t('st.onlyOk', hosts.length, ok) };
  }

  /* ---------- 서버 단위로 모으기: 한 서버가 여러 서비스를 맡는다(예: api-1 = API + 블로그 + 관리자 API) ---------- */
  function hostModel() {
    var map = {}, order = [];
    services.forEach(function (s, i) {
      (s.agents || []).forEach(function (a) {
        var h = map[a.host];
        if (!h) {
          h = map[a.host] = { host: a.host, name: hostName(a.host), role: hostRole(a.host), svcs: [], ageSec: null, perMin: 0, errors: 0, cpu: null, mem: null, disk: null };
          order.push(h);
        }
        h.svcs.push({ i: i, label: s.label, perMin: a.perMin || 0 });
        if (a.ageSec != null && (h.ageSec == null || a.ageSec < h.ageSec)) h.ageSec = a.ageSec;
        h.perMin += a.perMin || 0;
        h.errors += a.errors || 0;
        if (a.cpu != null) h.cpu = a.cpu;
        if (a.mem != null) h.mem = a.mem;
        if (a.disk != null) h.disk = a.disk;
      });
    });
    order.forEach(function (h) { h.state = hostState(h); });
    return order;
  }
  /* 끊긴 서버가 맡던 서비스를 다른 서버가 계속 받고 있는지 */
  function impact(h, hosts) {
    return h.svcs.map(function (sv) {
      var others = hosts.filter(function (o) {
        return o !== h && o.state.cls === 'up' && o.svcs.some(function (x) { return x.i === sv.i; });
      });
      return others.length
        ? { ok: true, text: t('imp.ok', sv.label, others.map(function (o) { return o.name; }).join(', ')) }
        : { ok: false, text: t('imp.bad', sv.label) };
    });
  }
  function meter(label, v) {
    var m = el('div', 'meter' + (v >= 95 ? ' hot' : v >= 85 ? ' warn' : ''));
    var head = el('span');
    head.appendChild(document.createTextNode(label + ' '));
    head.appendChild(el('b', null, v == null ? '-' : Math.round(v) + '%'));
    m.appendChild(head);
    var bar = el('span', 'bar');
    var fill = el('i');
    fill.style.width = (v == null ? 0 : Math.min(100, v)) + '%';
    bar.appendChild(fill);
    m.appendChild(bar);
    return m;
  }
  function renderServers() {
    var box = $('servers');
    if (view !== 'live') return;
    var hosts = hostModel();
    box.textContent = '';
    $('servers-empty').hidden = hosts.length > 0;
    // 문제 있는 서버를 앞으로
    var rank = { down: 0, warn: 1, idle: 2, up: 3 };
    hosts.slice().sort(function (a, b) { return rank[a.state.cls] - rank[b.state.cls]; }).forEach(function (h) {
      var st = h.state;
      var card = el('article', 'server ' + (st.cls === 'down' ? 'down' : st.cls === 'warn' ? 'late' : st.cls === 'idle' ? 'idle' : 'up'));
      var head = el('div', 'server-top');
      head.appendChild(el('span', 'server-name', h.name));
      var badge = el('span', 'state ' + st.cls);
      badge.appendChild(el('span', 'ico', st.ico));
      badge.appendChild(document.createTextNode(st.text));
      head.appendChild(badge);
      card.appendChild(head);
      var id = el('div', 'server-id');
      if (h.role) id.appendChild(document.createTextNode(h.role + ' · '));
      id.appendChild(el('code', null, h.host));
      card.appendChild(id);
      var sv = el('div', 'server-svcs');
      h.svcs.forEach(function (x) {
        var s = el('span');
        var sw = el('span', 'swatch');
        sw.style.background = color(x.i);
        s.appendChild(sw);
        s.appendChild(document.createTextNode(x.label));
        sv.appendChild(s);
      });
      card.appendChild(sv);
      if (st.cls === 'down' || st.cls === 'warn') {
        card.appendChild(el('div', 'server-big', st.cls === 'down' ? t('card.lost', h.ageSec == null ? t('st.neverSince') : t('st.for', fmtDur(h.ageSec))) : t('card.late', h.ageSec)));
        impact(h, hosts).forEach(function (x) { card.appendChild(el('div', 'server-foot' + (x.ok ? '' : ' bad'), x.text)); });
      } else {
        card.appendChild(el('div', 'server-foot', t('card.req', nf.format(h.perMin)) + (h.errors ? t('card.err', nf.format(h.errors)) : '')));
      }
      var ms = el('div', 'meters');
      ms.appendChild(meter('CPU', st.cls === 'up' ? h.cpu : null));
      ms.appendChild(meter(t('card.mem'), st.cls === 'up' ? h.mem : null));
      ms.appendChild(meter(t('card.disk'), st.cls === 'up' ? h.disk : null));
      card.appendChild(ms);
      card.appendChild(el('div', 'server-foot', h.ageSec == null ? t('card.noLast') : t('card.last', fmtTime(now() - h.ageSec * 1000)) + (h.ageSec <= LATE_SEC ? t('card.ago', h.ageSec) : '')));
      box.appendChild(card);
    });
  }

  /* ---------- 맨 위 상태 줄 · 탭 제목 · 아이콘 · 소리 ---------- */
  function statusItems() {
    var items = [];
    var tn = now();
    if (!connected && lostAt && Date.now() - lostAt > 3000) {
      items.push({ key: 'conn', level: 'critical', what: t('is.conn'), since: (lostAt + serverOffset) / 1000,
        why: t('is.connWhy', lastTickAt ? fmtTime(lastTickAt) : '-'),
        how: t('is.connHow') });
    }
    var hosts = hostModel();
    hosts.forEach(function (h) {
      var st = h.state;
      if (st.cls !== 'down' && st.cls !== 'warn') return;
      var down = st.cls === 'down';
      var last = h.ageSec == null ? null : tn - h.ageSec * 1000;
      items.push({
        key: 'host:' + h.host, level: down ? 'critical' : 'warning', host: h.host,
        what: t(down ? 'is.hostDown' : 'is.hostLate', h.name),
        since: last == null ? null : last / 1000,
        why: (h.role ? h.role + ' · ' : '') + h.host + ' · ' + (last == null ? t('is.never') : t('is.last', fmtTime(last))),
        impact: impact(h, hosts),
        how: down ? t('is.downHow', h.name) : t('is.lateHow')
      });
    });
    issues.forEach(function (x) {
      if (x.key.indexOf('agent:') === 0) return; // 서버 끊김은 위에서 서버 단위로 묶어 보였다
      var title = pick(x.title);
      Object.keys(hostInfo).forEach(function (h) { title = title.split(h + ' ·').join(hostName(h) + ' ·'); });
      items.push({ key: x.key, level: x.level, what: title, since: x.since / 1000, why: pick(x.detail), how: '' });
    });
    var rank = { critical: 0, warning: 1 };
    items.sort(function (a, b) { return rank[a.level] - rank[b.level]; });
    return { items: items, hosts: hosts };
  }
  function renderStatus() {
    var r = statusItems(), items = r.items, hosts = r.hosts;
    var crit = items.filter(function (x) { return x.level === 'critical'; });
    var warn = items.length - crit.length;
    var box = $('status');
    box.className = 'status ' + (crit.length ? 'bad' : warn ? 'warn' : services.length ? 'ok' : 'idle');
    box.querySelector('.status-ico').textContent = crit.length || warn ? '!' : '✓';
    var downHosts = crit.filter(function (x) { return x.host; });
    var title;
    if (downHosts.length) title = t('hd.down', downHosts.map(function (x) { return hostName(x.host); }).join(', '));
    else if (crit.length) title = t('hd.crit', crit.length) + (warn ? t('hd.andWarn', warn) : '');
    else if (warn) title = t('hd.warn', warn);
    else title = services.length ? t('hd.ok') : t('status.loading');
    $('status-title').textContent = title;
    var up = hosts.filter(function (h) { return h.state.cls === 'up'; }).length;
    var freshest = hosts.reduce(function (m, h) { return h.ageSec != null && (m == null || h.ageSec < m) ? h.ageSec : m; }, null);
    $('status-sub').textContent = hosts.length
      ? t('hd.sub', hosts.length, up, services.length) + (freshest != null && connected ? t('hd.subLast', freshest) : '')
      : '';
    var list = $('status-list');
    list.textContent = '';
    var ts = now() / 1000;
    items.forEach(function (x) {
      var li = el('li');
      li.appendChild(el('span', 'lv ' + x.level, t('lv.' + x.level)));
      var what = el('div', 'what', x.what);
      if (x.since) what.appendChild(el('span', 'for', t('lv.for', fmtTime(x.since * 1000), fmtDur(ts - x.since))));
      li.appendChild(what);
      if (x.why) li.appendChild(el('div', 'why', x.why));
      if (x.impact) {
        var im = el('div', 'impact');
        im.appendChild(el('span', 'k', t('lv.impact')));
        x.impact.forEach(function (y) { im.appendChild(el('span', y.ok ? 'ok' : 'bad', y.text)); });
        li.appendChild(im);
      }
      if (x.how) li.appendChild(el('div', 'how', x.how));
      list.appendChild(li);
    });
    // 탭 제목과 아이콘: 다른 탭을 보고 있어도 알 수 있게
    var base = 'tailpulse · ' + t('title');
    document.title = crit.length ? '🔴 ' + title + ' · ' + base : warn ? '🟡 ' + title + ' · ' + base : base;
    setFavicon(crit.length ? C.critical : warn ? C.warning : services.length ? C.good : C.muted);
    announce(crit);
  }
  var faviconColor = '';
  function setFavicon(c) {
    if (c === faviconColor) return;
    faviconColor = c;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="' + c + '"/></svg>';
    $('favicon').href = 'data:image/svg+xml,' + encodeURIComponent(svg);
  }
  /* 새 장애가 생기면 한 번 소리 · 알림(켜 둔 브라우저에서만) */
  var audio = null;
  function beep() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.35, 0.7].forEach(function (at) {
        var o = audio.createOscillator(), g = audio.createGain();
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, audio.currentTime + at);
        g.gain.exponentialRampToValueAtTime(0.25, audio.currentTime + at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + at + 0.25);
        o.connect(g); g.connect(audio.destination);
        o.start(audio.currentTime + at); o.stop(audio.currentTime + at + 0.3);
      });
    } catch (e) { /* 소리를 못 내는 브라우저 */ }
  }
  function announce(crit) {
    var fresh = crit.filter(function (x) { return !announced[x.key]; });
    var keys = {};
    crit.forEach(function (x) { keys[x.key] = true; });
    announced = keys;
    if (!fresh.length || !sound) return;
    beep();
    if (window.Notification && Notification.permission === 'granted') {
      fresh.forEach(function (x) {
        try { new Notification('🔴 ' + x.what, { body: x.why || '', tag: x.key }); } catch (e) { /* 알림 막힘 */ }
      });
    }
  }
  function renderSound() {
    var b = $('sound');
    b.setAttribute('aria-pressed', String(sound));
    b.textContent = sound ? t('sound.on') : t('sound.off');
  }
  function setTile(id, value, unit) {
    var n = $(id);
    n.textContent = value;
    if (unit) n.appendChild(el('small', null, unit));
  }
  function renderTiles() {
    var list = services.filter(function (s, i) { return shown(i); });
    // 서버 단위로 센다. 같은 서버가 여러 서비스에 걸쳐 있으면 한 번만 센다.
    var seen = {}, total = 0, good = 0;
    list.forEach(function (s) {
      (s.agents || []).forEach(function (a) {
        var ok = hostState(a).cls === 'up';
        if (!(a.host in seen)) { seen[a.host] = ok; total++; if (ok) good++; }
        else if (seen[a.host] && !ok) { seen[a.host] = false; good--; }
      });
    });
    var bad = total - good;
    setTile('t-alive', total ? good + ' / ' + total : '-', total ? t('tl.up') : '');
    var sub = $('t-alive-sub');
    sub.textContent = bad ? t('tl.check', Object.keys(seen).filter(function (h) { return !seen[h]; }).map(hostName).join(', ')) : (total ? t('tl.allOk') : t('tl.none'));
    sub.className = 'tile-sub' + (bad ? ' bad' : '');
    var users = 0, tps = 0, perMin = 0, errors = 0;
    list.forEach(function (s) { users += s.users; tps += s.tps; perMin += s.perMin; errors += s.errors; });
    setTile('t-users', nf.format(users), t('tl.people'));
    $('t-users-sub').textContent = list.length > 1 ? t('tl.usersSum') : t('sub.last5m');
    $('t-users-cmp').textContent = vsYesterday('users');
    setTile('t-tps', nf.format(perMin), t('tl.req'));
    $('t-tps-sub').textContent = t('tl.reqSub', nf.format(tps));
    $('t-tps-cmp').textContent = vsYesterday('count');
    var tn = now(), sum = 0, n = 0;
    for (var k = dots.length - 1; k >= 0 && dots[k].t >= tn - 10000; k--) {
      if (shown(dots[k].i) && dots[k].ms != null) { sum += dots[k].ms; n++; }
    }
    $('t-avg').textContent = n ? fmtMs(sum / n) : '-';
    setTile('t-err', perMin ? (errors * 100 / perMin).toFixed(errors ? 1 : 0) : '0', '%');
    $('t-err-sub').textContent = t('tl.errSub', nf.format(errors));
  }
  /* 최근 15분(닫힌 1분들) 평균을 어제 같은 시각과 견준다. 어제 기록이 모자라면 비워 둔다 */
  function vsYesterday(key) {
    if (!trend || !yesterday || trend.lastIndex == null || trend.lastIndex < 0) return '';
    var a = 0, b = 0, n = 0;
    for (var k = Math.max(0, trend.lastIndex - 14); k <= trend.lastIndex; k++) {
      var ta = 0, tb = 0, okA = false, okB = false;
      services.forEach(function (s, i) {
        if (!shown(i)) return;
        var x = trend.series[s.name], y = yesterday.series[s.name];
        if (x && x[key][k] != null) { ta += x[key][k]; okA = true; }
        if (y && y[key] && y[key][k] != null) { tb += y[key][k]; okB = true; }
      });
      if (okA && okB) { a += ta; b += tb; n++; }
    }
    if (n < 10 || b <= 0) return '';
    var d = Math.round((a - b) * 100 / b);
    return d === 0 ? t('vs.same') : t(d > 0 ? 'vs.more' : 'vs.less', Math.abs(d));
  }
  function stateCell(st) {
    var c = el('td', 'state-cell');
    c.setAttribute('data-label', t('th.state'));
    var wrap = el('span', 'state ' + st.cls);
    wrap.appendChild(el('span', 'ico', st.ico));
    wrap.appendChild(document.createTextNode(st.text));
    if (st.sub) wrap.appendChild(el('small', null, st.sub));
    c.appendChild(wrap);
    return c;
  }
  function renderServiceTable() {
    var body = document.querySelector('#svc-table tbody');
    body.textContent = '';
    services.forEach(function (s, i) {
      if (!shown(i)) return;
      var st = stateOf(s);
      var tr = el('tr', 'svc-row' + (filter === i ? ' picked' : '') + (st.cls === 'down' || st.cls === 'warn' || issues.some(function (x) { return x.service === s.name && x.level === 'critical'; }) ? ' alert' : ''));
      tr.title = filter === i ? t('tb.showAll') : t('tb.only', s.label);
      tr.onclick = function () { setFilter(filter === i ? -1 : i); };
      var name = el('td', 'lead');
      var sw = el('span', 'swatch');
      sw.style.background = color(i);
      sw.style.marginRight = '8px';
      name.appendChild(sw);
      name.appendChild(document.createTextNode(s.label));
      if (s.kind) name.appendChild(el('span', 'kind', s.kind));
      if (s.url) name.appendChild(el('span', 'kind', s.url.replace(/^https?:\/\//, '')));
      tr.appendChild(name);
      tr.appendChild(stateCell(st));
      tr.appendChild(td('num', nf.format(s.users), t('th.users')));
      tr.appendChild(td('num', nf.format(s.tps), t('th.last1s')));
      tr.appendChild(td('num', nf.format(s.perMin), t('th.last1m')));
      tr.appendChild(td('num', fmtMs(s.avgMs), t('th.avg')));
      tr.appendChild(td('num', s.errors ? t('tb.errRate', nf.format(s.errors), s.errorRate.toFixed(1)) : '0', t('th.err')));
      body.appendChild(tr);
      (s.agents || []).forEach(function (a) {
        var hs = hostState(a);
        var hr = el('tr', 'host-row' + (hs.cls === 'down' ? ' down' : ''));
        var hn = el('td', 'host-name lead', '└ ' + hostName(a.host));
        if (hostName(a.host) !== a.host) hn.title = a.host;
        hr.appendChild(hn);
        hr.appendChild(stateCell(hs));
        hr.appendChild(td('num empty-cell', ''));
        hr.appendChild(td('num empty-cell', ''));
        hr.appendChild(td('num', nf.format(a.perMin || 0), t('th.last1m')));
        hr.appendChild(td('num', fmtMs(a.avgMs), t('th.avg')));
        hr.appendChild(td('num', a.errors ? t('tb.n', nf.format(a.errors)) : '0', t('th.err')));
        body.appendChild(hr);
      });
    });
  }
  function renderSlow() {
    var body = document.querySelector('#slow-table tbody');
    body.textContent = '';
    var n = 0;
    for (var k = dots.length - 1; k >= 0 && n < 30; k--) {
      var d = dots[k];
      if (!shown(d.i) || !(d.s >= 500 || (d.ms != null && d.ms >= 3000))) continue;
      var tr = el('tr');
      tr.appendChild(td('time', fmtTime(d.t), t('th.time')));
      tr.appendChild(td(null, services[d.i] ? services[d.i].label : '', t('th.service')));
      var p = el('td', 'path', fullPath(d.i, d.m, d.p));
      p.title = fullPath(d.i, d.m, d.p);
      tr.appendChild(p);
      tr.appendChild(td('num', fmtMs(d.ms), t('th.resp')));
      tr.appendChild(td('num', String(d.s), t('th.code')));
      body.appendChild(tr);
      n++;
    }
    $('slow-empty').hidden = n > 0;
  }
  /* 방금 들어온 요청: 최근 것부터 60건. 마우스를 올리거나 멈춤을 누르면 그대로 둔다 */
  function renderFeed() {
    if (feedPaused || feedHover) return;
    var body = document.querySelector('#feed-table tbody');
    body.textContent = '';
    var n = 0, seen = {};
    for (var k = dots.length - 1; k >= 0 && n < 60; k--) {
      var d = dots[k];
      if (!shown(d.i)) continue;
      var id = d.t + ':' + d.i + ':' + d.p + ':' + d.ms;
      var tr = el('tr', feedShown[id] ? '' : 'fresh');
      seen[id] = true;
      tr.appendChild(td('time', fmtTime(d.t), t('th.time')));
      tr.appendChild(td(null, services[d.i] ? services[d.i].label : '', t('th.service')));
      var p = el('td', 'path', fullPath(d.i, d.m, d.p));
      p.title = p.textContent;
      tr.appendChild(p);
      var ms = td('num', fmtMs(d.ms), t('th.resp'));
      var mk = el('span', 'mk');
      mk.style.background = DOT_CLASSES[dotClass(d)].color;
      ms.insertBefore(mk, ms.firstChild);
      tr.appendChild(ms);
      tr.appendChild(td('num', String(d.s), t('th.code')));
      body.appendChild(tr);
      n++;
    }
    feedShown = seen;
    $('feed-empty').hidden = n > 0;
  }
  function renderTop() {
    var body = document.querySelector('#top-table tbody');
    body.textContent = '';
    var rows = top.filter(function (r) { return shown(r.i); }).slice().sort(function (a, b) {
      return (b[topSort] || 0) - (a[topSort] || 0) || b.count - a.count;
    }).slice(0, 15);
    rows.forEach(function (r) {
      var tr = el('tr');
      tr.appendChild(td('lead', services[r.i] ? services[r.i].label : ''));
      var sp = r.path.indexOf(' ');
      var p = el('td', 'path', fullPath(r.i, r.path.slice(0, sp), r.path.slice(sp + 1)));
      p.title = p.textContent;
      tr.appendChild(p);
      tr.appendChild(td('num', nf.format(r.count), t('th.count')));
      tr.appendChild(td('num', fmtMs(r.avgMs), t('th.avg')));
      tr.appendChild(td('num', fmtMs(r.maxMs), t('th.max')));
      tr.appendChild(td('num', r.errors ? nf.format(r.errors) : '0', t('th.err')));
      body.appendChild(tr);
    });
    $('top-empty').hidden = rows.length > 0;
  }

  /* ---------- 캔버스 공통 ---------- */
  function setup(id) {
    var cv = $(id);
    var dpr = window.devicePixelRatio || 1;
    var w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = '11px -apple-system, "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';
    return { ctx: ctx, w: w, h: h };
  }
  function niceMax(v, steps) {
    if (!(v > 0)) return steps[0];
    for (var i = 0; i < steps.length; i++) if (v <= steps[i]) return steps[i];
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    return Math.ceil(v / p) * p;
  }
  function frame(g, max, fmt, t1, windowSec) {
    var ctx = g.ctx, L = 46, R = 10, T = 8, B = 20;
    var pw = g.w - L - R, ph = g.h - T - B;
    ctx.strokeStyle = C.line;
    ctx.fillStyle = C.muted;
    ctx.lineWidth = 1;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    for (var i = 0; i <= 2; i++) {
      var y = Math.round(T + ph - ph * i / 2) + 0.5;
      ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(L + pw, y); ctx.stroke();
      ctx.fillText(fmt(max * i / 2), L - 6, y);
    }
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    var step = windowSec > 300 ? 120 : 60;
    var first = Math.ceil((t1 - windowSec * 1000) / (step * 1000)) * step * 1000;
    for (var x0 = first; x0 <= t1; x0 += step * 1000) {
      var x = L + pw * (1 - (t1 - x0) / (windowSec * 1000));
      if (x < L + 16 || x > L + pw - 16) continue;
      ctx.fillText(fmtTime(x0).slice(0, 5), x, T + ph + 5);
    }
    return { L: L, T: T, pw: pw, ph: ph, t1: t1, windowMs: windowSec * 1000, max: max };
  }

  /* ---------- 요청 점 그래프 ---------- */
  function drawDots() {
    var g = setup('c-dots');
    var t1 = now();
    var t0 = t1 - DOT_WINDOW * 1000;
    var vis = [];
    for (var k = dots.length - 1; k >= 0 && dots[k].t >= t0; k--) {
      if (shown(dots[k].i) && dots[k].ms != null) vis.push(dots[k]);
    }
    // 세로 범위: 대부분의 점이 들어오는 값(98%)을 기준으로 잡고, 넘는 점은 맨 위 줄에 붙인다
    var sorted = vis.map(function (d) { return d.ms; }).sort(function (a, b) { return a - b; });
    var p98 = sorted.length ? sorted[Math.floor(sorted.length * 0.98)] : 0;
    var max = niceMax(Math.max(p98 * 1.15, 1000), [1000, 2000, 3000, 5000, 8000, 10000, 15000, 20000, 30000, 60000]);
    var f = frame(g, max, fmtMs, t1, DOT_WINDOW);
    var ctx = g.ctx;
    var pts = [];
    for (var c = 0; c < DOT_CLASSES.length; c++) {
      // 문제 있는 점이 위에 그려지도록 정상 → 요청 오류 → 느림 → 오류 순서
      var cls = [0, 4, 1, 2, 3][c];
      ctx.fillStyle = DOT_CLASSES[cls].color;
      ctx.strokeStyle = DOT_CLASSES[cls].color;
      ctx.globalAlpha = cls === 0 ? 0.75 : 1;
      for (var j = 0; j < vis.length; j++) {
        var d = vis[j];
        if (dotClass(d) !== cls) continue;
        var x = f.L + f.pw * (1 - (t1 - d.t) / f.windowMs);
        var y = f.T + f.ph - f.ph * Math.min(d.ms, max) / max;
        if (cls === 3) {
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x - 3.5, y - 3.5); ctx.lineTo(x + 3.5, y + 3.5); ctx.moveTo(x + 3.5, y - 3.5); ctx.lineTo(x - 3.5, y + 3.5); ctx.stroke();
        } else {
          var r = cls === 0 ? 1.8 : 2.6;
          ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }
        pts.push({ x: x, y: y, d: d });
      }
    }
    ctx.globalAlpha = 1;
    if (!vis.length) {
      ctx.fillStyle = C.muted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('dots.empty'), f.L + f.pw / 2, f.T + f.ph / 2);
    }
    var hv = hover['c-dots'];
    plots['c-dots'] = { pts: pts };
    if (hv) {
      var best = null, bd = 24 * 24;
      for (var q = 0; q < pts.length; q++) {
        var dx = pts[q].x - hv.x, dy = pts[q].y - hv.y, dd = dx * dx + dy * dy;
        if (dd < bd) { bd = dd; best = pts[q]; }
      }
      if (best) {
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(best.x - 5, best.y - 5, 10, 10);
        showDotTip(best.d, hv);
      } else {
        hideTip();
      }
    }
  }
  function showDotTip(d, hv) {
    var tip = $('tip');
    tip.textContent = '';
    tip.appendChild(el('div', 'tip-title', fmtTime(d.t) + ' · ' + (services[d.i] ? services[d.i].label : '')));
    tip.appendChild(el('div', 'mono', fullPath(d.i, d.m, d.p)));
    var row = el('div', 'row');
    row.appendChild(el('span', 'key', dotLabel(dotClass(d)) + t('tip.code', d.s)));
    row.appendChild(el('b', null, fmtMs(d.ms)));
    tip.appendChild(row);
    placeTip(hv);
  }

  /* ---------- 선 그래프 ---------- */
  function countFmt(v) { return t('fmt.count', nf.format(Math.round(v))); }
  function usersFmt(v) { return t('fmt.users', nf.format(Math.round(v))); }
  var LINES = [
    { id: 'c-tps', key: 'tps', bucket: 5, sum: true, steps: [4, 10, 20, 40, 100, 200, 400, 1000, 2000, 4000], fmt: countFmt },
    { id: 'c-avg', key: 'avg', bucket: 5, steps: [100, 200, 400, 1000, 2000, 4000, 10000, 20000], fmt: fmtMs },
    { id: 'c-users', key: 'users', bucket: 5, steps: [4, 10, 20, 40, 100, 200, 400, 1000, 2000], fmt: usersFmt }
  ];
  function buckets(rows, key, size, tFrom, asSum) {
    var out = [], cur = -1, sum = 0, n = 0;
    function flush() { if (n) out.push([cur * size + size / 2, asSum ? sum : sum / n]); }
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.t < tFrom || r[key] == null) continue;
      var b = Math.floor(r.t / size);
      if (b !== cur) { flush(); cur = b; sum = 0; n = 0; }
      sum += r[key]; n++;
    }
    flush();
    return out;
  }
  function drawLines(def) {
    var g = setup(def.id);
    var t1 = now();
    var tFrom = t1 / 1000 - LINE_WINDOW;
    var series = [];
    var max = 0;
    services.forEach(function (s, i) {
      if (!shown(i)) return;
      var pts = buckets(hist[i] || [], def.key, def.bucket, tFrom, def.sum);
      pts.forEach(function (p) { if (p[1] > max) max = p[1]; });
      series.push({ i: i, label: s.label, pts: pts });
    });
    max = niceMax(max * 1.1, def.steps);
    var f = frame(g, max, def.fmt, t1, LINE_WINDOW);
    var ctx = g.ctx;
    ctx.save();
    ctx.beginPath(); ctx.rect(f.L, f.T - 2, f.pw, f.ph + 4); ctx.clip();
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    series.forEach(function (s) {
      if (!s.pts.length) return;
      ctx.strokeStyle = color(s.i);
      ctx.beginPath();
      s.pts.forEach(function (p, k) {
        var x = f.L + f.pw * (1 - (t1 - p[0] * 1000) / f.windowMs);
        var y = f.T + f.ph - f.ph * Math.min(p[1], max) / max;
        if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.stroke();
    });
    ctx.restore();
    var hv = hover[def.id];
    if (hv && hv.x >= f.L && hv.x <= f.L + f.pw) {
      var th = (t1 - (1 - (hv.x - f.L) / f.pw) * f.windowMs) / 1000;
      var bt = (Math.floor(th / def.bucket) + 0.5) * def.bucket;
      var x = f.L + f.pw * (1 - (t1 - bt * 1000) / f.windowMs);
      ctx.strokeStyle = '#4a4a46';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, f.T); ctx.lineTo(Math.round(x) + 0.5, f.T + f.ph); ctx.stroke();
      var tip = $('tip');
      tip.textContent = '';
      tip.appendChild(el('div', 'tip-title', fmtTime(bt * 1000)));
      series.forEach(function (s) {
        var hit = null;
        s.pts.forEach(function (p) { if (Math.abs(p[0] - bt) < 0.01) hit = p; });
        if (hit) {
          var y = f.T + f.ph - f.ph * Math.min(hit[1], max) / max;
          ctx.fillStyle = color(s.i);
          ctx.strokeStyle = C.surface;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        var row = el('div', 'row');
        var key = el('span', 'key');
        var st = el('span', 'stroke');
        st.style.background = color(s.i);
        key.appendChild(st);
        key.appendChild(document.createTextNode(s.label));
        row.appendChild(key);
        row.appendChild(el('b', null, hit ? def.fmt(hit[1]) : '-'));
        tip.appendChild(row);
      });
      placeTip(hv);
    }
  }

  /* ---------- 오늘 추이 (1분 집계, 서버가 파일에 남겨 재시작해도 이어진다) ---------- */
  var DAY = [
    { id: 'd-count', steps: [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000], fmt: countFmt, empty: 'trend.empty',
      value: function (tr, k) { return tr.count[k]; } },
    { id: 'd-users', steps: [4, 10, 20, 40, 100, 200, 400, 1000, 2000, 5000, 10000], fmt: usersFmt, empty: 'trend.empty',
      value: function (tr, k) { return tr.users[k]; } },
    { id: 'd-avg', steps: [100, 200, 400, 1000, 2000, 4000, 10000, 20000, 60000], fmt: fmtMs, empty: 'day.noTimed',
      value: function (tr, k) { return tr.timed[k] ? tr.sumMs[k] / tr.timed[k] : null; } },
    { id: 'd-max', steps: [1000, 2000, 5000, 10000, 20000, 30000, 60000, 120000, 300000, 600000], fmt: fmtMs, empty: 'day.noTimed',
      value: function (tr, k) { return tr.timed[k] ? tr.maxMs[k] : null; } }
  ];
  // 서버가 정한 하루(설정 zone 의 00시부터)의 몇 번째 분인지로 시각을 쓴다
  function hhmm(k) { return String(Math.floor(k / 60)).padStart(2, '0') + ':' + String(k % 60).padStart(2, '0'); }
  function daySeries(def, src) {
    src = src || trend;
    var n = trend ? trend.minutes : 1440, list = [], peak = null;
    if (src) services.forEach(function (s, i) {
      var tr = src.series[s.name];
      if (!shown(i) || !tr) return;
      var vals = new Array(n);
      for (var k = 0; k < n; k++) {
        var v = tr.count[k] == null || (src !== trend && trend && k > trend.lastIndex + 60) ? null : def.value(tr, k);
        vals[k] = v;
        if (v != null && (peak == null || v > peak.v)) peak = { i: i, k: k, v: v };
      }
      list.push({ i: i, label: s.label, vals: vals });
    });
    return { n: n, list: list, peak: peak };
  }
  function dayFrame(g, max, fmt, n) {
    var ctx = g.ctx, L = 46, R = 10, T = 8, B = 20;
    var pw = g.w - L - R, ph = g.h - T - B;
    ctx.strokeStyle = C.line;
    ctx.fillStyle = C.muted;
    ctx.lineWidth = 1;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    for (var i = 0; i <= 2; i++) {
      var y = Math.round(T + ph - ph * i / 2) + 0.5;
      ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(L + pw, y); ctx.stroke();
      ctx.fillText(fmt(max * i / 2), L - 6, y);
    }
    ctx.textBaseline = 'top';
    for (var h = 0; h <= 24; h += 3) {
      ctx.textAlign = h === 0 ? 'left' : h === 24 ? 'right' : 'center';
      ctx.fillText(t('axis.h', String(h).padStart(2, '0')), L + pw * h * 60 / n, T + ph + 5);
    }
    return { L: L, T: T, pw: pw, ph: ph };
  }
  function drawDay(def) {
    if (view !== 'today') return;
    var g = setup(def.id);
    var d = daySeries(def);
    // 어제(같은 시각 + 1시간까지만): 같은 색 점선, 흐리게
    var y = compare && yesterday ? daySeries(def, yesterday) : null;
    var n = d.n;
    var hi = Math.max(d.peak ? d.peak.v : 0, y && y.peak ? y.peak.v : 0);
    var max = niceMax(hi * 1.1, def.steps);
    var f = dayFrame(g, max, def.fmt, n);
    var ctx = g.ctx;
    function X(k) { return f.L + f.pw * (k + 0.5) / n; }
    function Y(v) { return f.T + f.ph - f.ph * Math.min(v, max) / max; }
    ctx.save();
    ctx.beginPath(); ctx.rect(f.L, f.T - 2, f.pw, f.ph + 4); ctx.clip();
    ctx.lineJoin = 'round';
    if (y) {
      ctx.setLineDash([4, 3]);
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1.2;
      y.list.forEach(function (s) {
        ctx.strokeStyle = color(s.i);
        ctx.beginPath();
        var pen = false;
        for (var k = 0; k < n; k++) {
          var v = s.vals[k];
          if (v == null) { pen = false; continue; }
          if (pen) ctx.lineTo(X(k), Y(v)); else { ctx.moveTo(X(k), Y(v)); pen = true; }
        }
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    ctx.lineWidth = 1.5;
    d.list.forEach(function (s) {
      ctx.strokeStyle = color(s.i);
      ctx.fillStyle = color(s.i);
      ctx.beginPath();
      var pen = false;
      for (var k = 0; k < n; k++) {
        var v = s.vals[k];
        if (v == null) { pen = false; continue; } // 기록이 없는 분(서버가 꺼졌거나 수집 전)은 선을 끊는다
        if (pen) {
          ctx.lineTo(X(k), Y(v));
        } else {
          ctx.moveTo(X(k), Y(v));
          pen = true;
          if (k + 1 >= n || s.vals[k + 1] == null) ctx.fillRect(X(k) - 1.5, Y(v) - 1.5, 3, 3); // 홀로 있는 점
        }
      }
      ctx.stroke();
    });
    ctx.restore();
    if (!d.peak) {
      ctx.fillStyle = C.muted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t(def.empty), f.L + f.pw / 2, f.T + f.ph / 2);
      return;
    }
    // 하루 최대값 한 곳에만 표시를 단다
    var px = X(d.peak.k), py = Y(d.peak.v);
    ctx.fillStyle = color(d.peak.i);
    ctx.strokeStyle = C.surface;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    var label = t('peak', def.fmt(d.peak.v), hhmm(d.peak.k));
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    var tw = ctx.measureText(label).width;
    var tx = Math.min(Math.max(px - tw / 2, f.L + 2), f.L + f.pw - tw - 2);
    ctx.fillText(label, tx, py - 12 < f.T + 6 ? py + 13 : py - 12);
    var hv = hover[def.id];
    if (!hv || hv.x < f.L || hv.x > f.L + f.pw) return;
    var k = Math.max(0, Math.min(n - 1, Math.floor((hv.x - f.L) / f.pw * n)));
    var x = X(k);
    ctx.strokeStyle = '#4a4a46';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, f.T); ctx.lineTo(Math.round(x) + 0.5, f.T + f.ph); ctx.stroke();
    var tip = $('tip');
    tip.textContent = '';
    tip.appendChild(el('div', 'tip-title', hhmm(k)));
    d.list.forEach(function (s) {
      var v = s.vals[k];
      if (v != null) {
        ctx.fillStyle = color(s.i);
        ctx.strokeStyle = C.surface;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, Y(v), 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      var row = el('div', 'row');
      var key = el('span', 'key');
      var st = el('span', 'stroke');
      st.style.background = color(s.i);
      key.appendChild(st);
      key.appendChild(document.createTextNode(s.label));
      row.appendChild(key);
      var val = el('b', null, v == null ? '-' : def.fmt(v));
      if (y) {
        var ys = y.list.filter(function (o) { return o.i === s.i; })[0];
        var yv = ys ? ys.vals[k] : null;
        row.appendChild(el('span', 'key', t('tip.yday', yv == null ? '-' : def.fmt(yv))));
      }
      row.appendChild(val);
      tip.appendChild(row);
    });
    placeTip(hv);
  }
  function peakCell(p, fmt, label) {
    var c = el('td', 'num', p ? fmt(p.v) : '-');
    if (p && p.v > 0) c.appendChild(el('small', 'when', hhmm(p.k)));
    c.setAttribute('data-label', label);
    return c;
  }
  function renderTrendTable() {
    var body = document.querySelector('#trend-table tbody');
    body.textContent = '';
    var rows = 0;
    services.forEach(function (s, i) {
      var tr = trend && trend.series[s.name];
      if (!shown(i) || !tr) return;
      var total = 0, err = 0, sum = 0, timed = 0, pc = null, pu = null, px = null;
      for (var k = 0; k < tr.count.length; k++) {
        if (tr.count[k] == null) continue;
        total += tr.count[k];
        err += tr.errors[k];
        sum += tr.sumMs[k];
        timed += tr.timed[k];
        if (pc == null || tr.count[k] > pc.v) pc = { v: tr.count[k], k: k };
        if (pu == null || tr.users[k] > pu.v) pu = { v: tr.users[k], k: k };
        if (tr.timed[k] && (px == null || tr.maxMs[k] > px.v)) px = { v: tr.maxMs[k], k: k };
      }
      var row = el('tr');
      var name = el('td', 'lead');
      var sw = el('span', 'swatch');
      sw.style.background = color(i);
      sw.style.marginRight = '8px';
      name.appendChild(sw);
      name.appendChild(document.createTextNode(s.label));
      row.appendChild(name);
      row.appendChild(td('num', countFmt(total), t('th.todayReq')));
      // 어제 같은 시각까지 들어온 요청(어제 기록이 있을 때만)
      var ys = yesterday && yesterday.series[s.name], ysum = null;
      if (ys) {
        ysum = 0;
        for (var j = 0; j <= Math.min(trend.lastIndex, ys.count.length - 1); j++) if (ys.count[j] != null) ysum += ys.count[j];
      }
      var yc = td('num', ysum == null ? '-' : countFmt(ysum), t('th.ydayUntil'));
      if (ysum) {
        var dd = Math.round((total - ysum) * 100 / ysum);
        yc.appendChild(el('small', 'when', t('tr.today', (dd > 0 ? '+' : '') + dd)));
      }
      row.appendChild(yc);
      row.appendChild(peakCell(pc, countFmt, t('th.peakMin')));
      row.appendChild(peakCell(pu, usersFmt, t('th.peakUsers')));
      row.appendChild(td('num', timed ? fmtMs(sum / timed) : '-', t('th.avg')));
      row.appendChild(peakCell(px, fmtMs, t('th.slowest')));
      row.appendChild(td('num', err ? countFmt(err) : '0', t('th.err')));
      body.appendChild(row);
      rows++;
    });
    $('trend-empty').hidden = rows > 0;
  }
  function renderTrend() {
    renderTrendTable();
    DAY.forEach(drawDay);
  }

  /* ---------- 툴팁 ---------- */
  function placeTip(hv) {
    var tip = $('tip');
    tip.hidden = false;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var x = hv.cx + 14, y = hv.cy + 14;
    if (x + w > window.innerWidth - 8) x = hv.cx - w - 14;
    if (y + h > window.innerHeight - 8) y = hv.cy - h - 14;
    tip.style.left = Math.max(8, x) + 'px';
    tip.style.top = Math.max(8, y) + 'px';
  }
  function hideTip() { $('tip').hidden = true; }
  function bindHover(id, draw) {
    var cv = $(id);
    cv.addEventListener('pointermove', function (e) {
      var r = cv.getBoundingClientRect();
      hover[id] = { x: e.clientX - r.left, y: e.clientY - r.top, cx: e.clientX, cy: e.clientY };
      draw();
    });
    cv.addEventListener('pointerleave', function () { delete hover[id]; hideTip(); draw(); });
  }

  /* ---------- 전체 ---------- */
  function renderAll() {
    renderStatus();
    // 보이지 않는 보기는 그리지 않는다(돌아올 때 다시 그린다)
    if (view === 'live') {
      renderServers();
      renderTiles();
      renderServiceTable();
      LINES.forEach(drawLines);
    } else if (view === 'dev') {
      renderFeed();
      renderSlow();
      renderTop();
      drawDots();
    }
  }
  // 선택 · 창 크기 · 언어가 바뀔 때는 오늘 추이도 다시 그린다(오늘 추이는 1분마다 바뀌므로 1초마다 그리지 않는다)
  function rerender() { renderAll(); renderTrend(); }
  function clock() { $('clock').textContent = fmtTime(now()); }
  function setView(v) {
    view = v;
    document.body.setAttribute('data-view', v);
    document.querySelectorAll('.tab').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-view') === v)); });
    history.replaceState(null, '', location.pathname + location.search + (v === 'live' ? '' : '#' + v));
    hideTip();
    rerender();
  }
  document.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () { setView(b.getAttribute('data-view')); });
  });
  $('lang').addEventListener('click', function () { setLang(lang === 'ko' ? 'en' : 'ko'); });
  $('sound').addEventListener('click', function () {
    sound = !sound;
    try { localStorage.setItem('tailpulse.sound', sound ? 'on' : 'off'); } catch (e) { /* 저장소 막힘 */ }
    renderSound();
    if (sound) {
      beep(); // 눌렀을 때 한 번 울려 소리가 나는지 확인(브라우저는 사용자가 누른 뒤에만 소리를 허락한다)
      if (window.Notification && Notification.permission === 'default') Notification.requestPermission();
    }
  });
  $('cmp').addEventListener('click', function () {
    compare = !compare;
    $('cmp').setAttribute('aria-pressed', String(compare));
    $('cmp').textContent = t(compare ? 'cmp.on' : 'cmp');
    renderTrend();
  });

  bindHover('c-dots', drawDots);
  LINES.forEach(function (def) { bindHover(def.id, function () { drawLines(def); }); });
  DAY.forEach(function (def) { bindHover(def.id, function () { drawDay(def); }); });
  window.addEventListener('resize', rerender);
  setInterval(function () { clock(); if (view === 'dev' && !hover['c-dots']) drawDots(); }, 250);
  var feedWrap = $('feed-wrap');
  feedWrap.addEventListener('pointerenter', function () { feedHover = true; $('feed-hint').textContent = t('feed.hintPaused'); });
  feedWrap.addEventListener('pointerleave', function () { feedHover = false; $('feed-hint').textContent = t('feed.hint'); renderFeed(); });
  $('feed-pause').addEventListener('click', function () {
    feedPaused = !feedPaused;
    this.setAttribute('aria-pressed', String(feedPaused));
    this.textContent = t(feedPaused ? 'feed.resume' : 'feed.pause');
    renderFeed();
  });
  document.querySelectorAll('th.sort').forEach(function (th) {
    th.addEventListener('click', function () {
      topSort = th.getAttribute('data-sort');
      document.querySelectorAll('th.sort').forEach(function (o) { if (o === th) o.setAttribute('aria-sort', 'descending'); else o.removeAttribute('aria-sort'); });
      renderTop();
    });
  });
  setInterval(function () { watchConn(); if (!connected) renderStatus(); }, 1000); // 연결이 끊겨도 '몇 분째'는 흘러가게
  applyStaticText();
  setView(view);
  renderSound();
  renderLegends();
  loadSnapshot().catch(function () { needSnapshot = true; /* 연결되면 다시 받는다 */ }).then(connect);
})();
