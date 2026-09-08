# susi-ratio-tracker

패션·의류 계열 8개 대학의 수시 학과별 경쟁률을 자동으로 모아 보여주는 프로젝트.

## 구성

- `config/targets.json` — 감시 대상 (대학/학과/URL/벤더). 대상 추가·삭제는 이 파일만 고치면 됨.
- `scraper/parsers/jinhakapply.js`, `scraper/parsers/uwayapply.js` — 사이트별 HTML 파서.
- `scraper/fetch-ratio.js` — 로컬 실행용 진입점. `config/targets.json`을 읽어 `data/latest.json`에 저장.
- `scraper/standalone.js` — 위 3개 파일을 하나로 합친 버전. **Claude 예약 클라우드 에이전트(routine) 전용** — 로컬 파일 의존성이 없어야 클라우드에서 그대로 실행 가능하기 때문에 별도로 유지함. `config/targets.json`을 바꾸면 이 파일의 `TARGETS`도 손으로 맞춰줘야 함.
- `artifact/index.html` — 결과를 보여주는 웹페이지(Claude 아티팩트). `db` 캡ability로 `ratios/latest` 문서를 실시간 구독.

## 실행

```bash
node scraper/fetch-ratio.js
```

## 데이터 형식 (한 줄 = 전형 × 학과 조합)

```json
{ "전형": "학생부교과(일반전형)", "대학": "가천대", "학과": "패션산업학과", "모집인원": "12", "지원인원": "28", "경쟁률": "2.33 : 1", "수집시각": "..." }
```

## 자동 갱신

Claude 예약 클라우드 에이전트(routine)가 매시 13분에 `scraper/standalone.js`와 동일한 코드를 실행해서
[아티팩트 페이지](https://claude.ai/code/artifact/04eb4b27-9897-4267-9d6e-608310092788)의 DB(`ratios/latest`)를 갱신함.
routine id: `trig_0159cGUbguBiuCud7kkqy84v` (관리: https://claude.ai/code/routines)

급하게 최신값이 필요하면 Claude에게 "새로고침 해줘"라고 요청하면 즉시 재수집함.
