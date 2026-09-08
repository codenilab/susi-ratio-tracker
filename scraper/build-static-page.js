// build-static-page.js
// data/latest.json 의 데이터를 artifact/public-template.html 에 박아넣어서
// 로그인 없이 링크로 볼 수 있는 정적 스냅샷 페이지(artifact/public-snapshot.html)를 만든다.
//
// 사용법: node scraper/build-static-page.js

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data", "latest.json");
const TEMPLATE_PATH = path.join(ROOT, "artifact", "public-template.html");
const SNAPSHOT_PATH = path.join(ROOT, "artifact", "public-snapshot.html");
const PAGES_PATH = path.join(ROOT, "index.html");

const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
const template = fs.readFileSync(TEMPLATE_PATH, "utf-8");

// </script> 시퀀스가 데이터 안에 섞여 있어도 파싱이 깨지지 않도록 이스케이프한다.
const dataJson = JSON.stringify({ generatedAt: data.generatedAt, rows: data.rows }).replace(
  /<\/script/gi,
  "<\\/script"
);

const fragment = template.replace("__DATA_JSON__", dataJson);

// artifact/public-snapshot.html - Claude 아티팩트용 (공유 링크는 핀 고정 이슈가 있어 보조용).
// 이건 Artifact publish가 <!doctype>/<head>(뷰포트 메타 포함)/<body>를 자동으로 씌워주므로
// 조각(fragment) 그대로 저장한다 — 여기서 직접 씌우면 이중으로 감싸져서 깨진다.
fs.writeFileSync(SNAPSHOT_PATH, fragment, "utf-8");
console.log(`정적 페이지 생성됨 -> ${SNAPSHOT_PATH} (${data.rows.length}행, ${data.generatedAt} 기준)`);

// index.html (repo 루트) - GitHub Pages가 파일 그대로 서빙한다(자동으로 감싸주는 게 없음).
// 뷰포트 메타 태그가 없으면 모바일 브라우저가 데스크톱 폭(~980px)으로 렌더링한 뒤
// 축소해서 보여줘서 글씨가 작아지고, 확대해도 한 줄이 화면 밖으로 넘어간다.
// 그래서 이쪽만 완전한 문서로 직접 감싸준다.
const fullDocument =
  "<!DOCTYPE html>\n" +
  '<html lang="ko">\n' +
  "<head>\n" +
  '<meta charset="UTF-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
  "</head>\n" +
  "<body>\n" +
  fragment +
  "\n</body>\n</html>\n";
fs.writeFileSync(PAGES_PATH, fullDocument, "utf-8");
console.log(`정적 페이지 생성됨 -> ${PAGES_PATH} (${data.rows.length}행, ${data.generatedAt} 기준)`);
