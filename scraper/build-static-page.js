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
// 두 군데에 씀:
//  1) artifact/public-snapshot.html - Claude 아티팩트용 (공유 링크는 핀 고정 이슈가 있어 보조용)
//  2) index.html (repo 루트)        - GitHub Pages가 서빙하는 실제 파일. 이게 딸에게 보내는 진짜 링크.
const OUTPUT_PATHS = [
  path.join(ROOT, "artifact", "public-snapshot.html"),
  path.join(ROOT, "index.html"),
];

const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
const template = fs.readFileSync(TEMPLATE_PATH, "utf-8");

// </script> 시퀀스가 데이터 안에 섞여 있어도 파싱이 깨지지 않도록 이스케이프한다.
const dataJson = JSON.stringify({ generatedAt: data.generatedAt, rows: data.rows }).replace(
  /<\/script/gi,
  "<\\/script"
);

const output = template.replace("__DATA_JSON__", dataJson);
for (const outPath of OUTPUT_PATHS) {
  fs.writeFileSync(outPath, output, "utf-8");
  console.log(`정적 페이지 생성됨 -> ${outPath} (${data.rows.length}행, ${data.generatedAt} 기준)`);
}
