# susi-ratio-tracker

패션·의류 계열 8개 대학의 수시 학과별 경쟁률을 자동으로 모아 보여주는 프로젝트.

## 구성

- `config/targets.json` — 감시 대상 (대학/학과/URL/벤더/남길 전형). 대상 추가·삭제·필터링은 이 파일만 고치면 됨.
- `scraper/parsers/jinhakapply.js`, `scraper/parsers/uwayapply.js` — 사이트별 HTML 파서.
- `scraper/fetch-ratio.js` — 로컬 실행용 진입점. `config/targets.json`을 읽어 `data/latest.json`에 저장.
- `scraper/build-static-page.js` — `data/latest.json` + `artifact/public-template.html` → `index.html`(GitHub Pages용) / `artifact/public-snapshot.html`(Claude 아티팩트 보조용) 생성.
- `scraper/standalone.js` — 위 파일들을 하나로 합친 버전. Claude 클라우드 예약작업용으로 만들었으나, **클라우드 실행 환경의 네트워크 정책이 대상 사이트 접속을 막아서 현재는 쓰지 않음** (아래 참고).
- `artifact/index.html` — 실시간 DB 구독 웹페이지(Claude 아티팩트, `db` 캐퍼빌리티). 로그인한 소유자/조직 구성원만 접근 가능.
- `index.html`(repo 루트) — GitHub Pages로 서빙되는 정적 페이지. **로그인 없이 아무나 볼 수 있는 진짜 공유용 링크.**

## 실행

```bash
node scraper/fetch-ratio.js
node scraper/build-static-page.js
```

## 데이터 형식 (한 줄 = 전형 × 학과 조합)

```json
{ "전형": "학생부교과(일반전형)", "대학": "가천대", "학과": "패션산업학과", "모집인원": "12", "지원인원": "28", "경쟁률": "2.33 : 1", "수집시각": "..." }
```

## 자동 갱신

**Windows 작업 스케줄러**(`SusiRatioTracker`, 10분 주기)가 `scripts/run-scrape.ps1`을 실행함:

1. `node scraper/fetch-ratio.js` — 8개 대학 경쟁률 수집 → `data/latest.json`
2. Claude CLI(`claude -p ... --permission-mode auto`)로 Artifact DB(`ratios/latest`) 갱신 + `artifact/public-snapshot.html` 재배포
3. `scraper/build-static-page.js`로 `index.html`(repo 루트) 재생성
4. `git add / commit / push` → GitHub Pages가 자동으로 다시 배포 (몇 분 내 반영)

### 왜 클라우드 예약작업(routine) 대신 로컬인가

처음엔 Claude 클라우드 예약 에이전트(routine)로 시도했으나, 그 실행 환경의 아웃바운드 네트워크 정책이
`addon.jinhakapply.com`, `ratio.uwayapply.com` 접속을 전면 차단해서(`no rule or allowlist entry allows host`)
매번 실패했다. 반면 로컬 PC는 이 제약이 없어서, **로컬 작업 스케줄러 + 로컬에 설치한 Claude Code CLI**로 전환했다.

### 왜 GitHub Pages도 같이 쓰는가

Claude 아티팩트를 로그인 없는 사람(클로드 계정 없는 가족 등)에게 공유하면, 공유 시점에 **버전이 고정(pin)**되어
이후 재배포해도 자동으로 갱신되지 않는다. 그래서 "로그인 없이 보되 계속 최신으로 갱신"이 필요한 대상에게는
GitHub Pages(https://codenilab.github.io/susi-ratio-tracker/) 링크를 사용한다.

### 급할 때

Claude에게 "새로고침 해줘"라고 요청하면 그 자리에서 즉시 재수집 + 재배포함.
