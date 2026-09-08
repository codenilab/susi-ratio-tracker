# run-scrape.ps1
# susi-ratio-tracker: 경쟁률을 수집해서 아티팩트 DB에 반영하는 로컬 자동화 스크립트.
# Windows 작업 스케줄러가 이 파일을 주기적으로 실행함.
#
# 사전 준비:
#   1) npm install -g @anthropic-ai/claude-code  (이미 설치됨)
#   2) 최초 1회는 사람이 직접 이 스크립트를 실행해서 정상 동작(및 권한 신뢰)을 확인할 것.
#      claude 자체는 desktop app과 로그인을 공유하므로 별도 로그인은 불필요.

$ProjectDir = Split-Path -Parent $PSScriptRoot
$ArtifactUrl = "https://claude.ai/code/artifact/04eb4b27-9897-4267-9d6e-608310092788"
$PublicArtifactUrl = "https://claude.ai/code/artifact/fcab28d2-d213-410f-a162-52a7c99cd2a9"
$LogDir = Join-Path $ProjectDir "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir ("scrape-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".log")

Set-Location $ProjectDir

$prompt = @"
susi-ratio-tracker 정기 갱신 작업입니다. 순서대로 실행하세요.

1) Bash로 `node scraper/fetch-ratio.js` 를 실행하세요.
2) 실행이 끝나면 data/latest.json 이 생성/갱신됩니다. Artifact 도구를 호출하세요:
   - action: "write_db"
   - url: "$ArtifactUrl"
   - db_op: "set"
   - collection: "ratios"
   - doc_id: "latest"
   - file_path: "data/latest.json"
3) Bash로 `node scraper/build-static-page.js` 를 실행하세요 (artifact/public-snapshot.html 생성됨).
4) Artifact 도구를 호출해서 그 정적 페이지를 갱신하세요:
   - action: "publish"
   - file_path: "artifact/public-snapshot.html"
   - url: "$PublicArtifactUrl"
5) 몇 행이 수집됐는지, 실패한 대학이 있는지 한 줄로 요약해서 답하세요.
   코드를 수정하거나 config/targets.json의 대상을 추가/제거하지 마세요.
"@

claude -p $prompt --permission-mode auto --allowedTools "Write Bash Artifact" --output-format text 2>&1 | Tee-Object -FilePath $LogFile

# GitHub Pages 배포: index.html(루트)은 위 3번 단계에서 이미 새로 생성됨.
# 이건 순수 git 작업이라 에이전트를 또 부를 필요 없이 여기서 바로 커밋/푸시한다.
git add -A 2>&1 | Add-Content -Path $LogFile
$commitMsg = "auto: 경쟁률 갱신 " + (Get-Date -Format "yyyy-MM-dd HH:mm")
git commit -m $commitMsg 2>&1 | Add-Content -Path $LogFile
git push origin main 2>&1 | Add-Content -Path $LogFile

# 오래된 로그 정리 (최근 30개만 보관)
Get-ChildItem $LogDir -Filter "scrape-*.log" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 30 | Remove-Item -Force
