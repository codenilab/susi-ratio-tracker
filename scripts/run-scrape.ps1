# run-scrape.ps1
# susi-ratio-tracker: 경쟁률을 수집해서 GitHub Pages(index.html)에 반영하는 로컬 자동화 스크립트.
# Windows 작업 스케줄러가 이 파일을 10분마다 실행함.
#
# 설계: 여기 있는 작업(사이트 수집, 정적 페이지 생성, git commit/push)은 전부
# 결정적인 스크립트/명령이라 Claude(LLM) 호출이 필요 없다. 그래서 claude -p를
# 쓰지 않고 node/git을 직접 실행한다 — 토큰 소비 0, 매 10분 실행 비용도 없음.
#
# 주의(2026-09-08부터): 로컬 CLI 세션에서 Artifact 도구 자체가 사라진 상태라
# claude.ai 아티팩트 두 링크(실시간 DB 대시보드, 공유 스냅샷)는 이 스크립트로
# 더 이상 자동 갱신되지 않는다. 그게 필요하면 Claude Code 채팅 세션에서 직접
# "새로고침 해줘"라고 요청할 것 — 그 세션에는 Artifact 도구가 정상적으로 있다.
# 도구가 로컬에 다시 나타나면 이 스크립트에 2/4단계(write_db, publish)를 다시
# 추가할 수 있다 (git 히스토리에 이전 버전 있음).

$ProjectDir = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $ProjectDir "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir ("scrape-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".log")

Set-Location $ProjectDir

function Log($msg) {
    $msg | Tee-Object -FilePath $LogFile -Append
}

Log "=== susi-ratio-tracker 갱신 시작 $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ==="

# 1) 사이트에서 경쟁률 수집 -> data/latest.json
node scraper/fetch-ratio.js 2>&1 | Tee-Object -FilePath $LogFile -Append

# 2) 정적 페이지 생성 -> artifact/public-snapshot.html, index.html(GitHub Pages용)
node scraper/build-static-page.js 2>&1 | Tee-Object -FilePath $LogFile -Append

# 3) GitHub Pages 배포: git add/commit/push
#    주의: PowerShell 5.1이 git 같은 외부 프로세스에 인자를 넘길 때 한글을 시스템
#    코드페이지(CP949)로 넘겨서 커밋 메시지가 깨진다. UTF-8(BOM 없이) 파일로 써서
#    `git commit -F`로 넘기면 이 문제를 피할 수 있다.
git add -A 2>&1 | Add-Content -Path $LogFile
$commitMsgFile = Join-Path $env:TEMP "susi-ratio-commit-msg.txt"
$commitMsg = "auto: 경쟁률 갱신 " + (Get-Date -Format "yyyy-MM-dd HH:mm")
[System.IO.File]::WriteAllText($commitMsgFile, $commitMsg, (New-Object System.Text.UTF8Encoding $false))
git commit -F $commitMsgFile 2>&1 | Add-Content -Path $LogFile
Remove-Item $commitMsgFile -ErrorAction SilentlyContinue
git push origin main 2>&1 | Add-Content -Path $LogFile

Log "=== 완료 $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ==="

# 오래된 로그 정리 (최근 30개만 보관)
Get-ChildItem $LogDir -Filter "scrape-*.log" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 30 | Remove-Item -Force
