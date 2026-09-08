// scraper/fetch-ratio.js
// config/targets.json에 등록된 대학들의 경쟁률 페이지를 가져와서,
// 원하는 학과만 "전형 | 대학 | 학과 | 모집인원 | 지원인원 | 경쟁률" 한 줄짜리 로우로 평탄화한다.
//
// 사용법: node scraper/fetch-ratio.js
// 결과는 data/latest.json에 저장되고, 콘솔에도 요약을 출력한다.

const fs = require("fs");
const path = require("path");

const jinhakapply = require("./parsers/jinhakapply");
const uwayapply = require("./parsers/uwayapply");

const TARGETS_PATH = path.join(__dirname, "..", "config", "targets.json");
const OUTPUT_PATH = path.join(__dirname, "..", "data", "latest.json");

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function fetchHtml(url, vendor) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  if (vendor === "uwayapply") {
    // 이 사이트는 EUC-KR 인코딩을 쓴다. 잘못 디코딩하면 한글이 깨져서
    // 학교명/학과명 매칭이 통째로 실패하니 반드시 바이트 단위로 받아 디코딩한다.
    const buf = await res.arrayBuffer();
    return new TextDecoder("euc-kr").decode(buf);
  }
  return await res.text();
}

function getParser(vendor) {
  if (vendor === "jinhakapply") return jinhakapply;
  if (vendor === "uwayapply") return uwayapply;
  throw new Error(`알 수 없는 vendor: ${vendor}`);
}

async function fetchTarget(target) {
  const parser = getParser(target.vendor);
  const html = await fetchHtml(target.url, target.vendor);

  // 실수 방지: 가장 먼저 페이지 상단 학교명이 기대한 학교와 일치하는지 확인한다.
  // (URL 번호를 잘못 등록했거나, 사이트 구조가 바뀐 경우를 여기서 걸러낸다)
  const siteTitle = parser.extractSiteTitle(html);
  if (!siteTitle.includes(target.expectedSiteTitle)) {
    throw new Error(
      `학교명 불일치! 기대: "${target.expectedSiteTitle}", 실제 페이지 제목: "${siteTitle}" ` +
        `(URL이 맞는지 확인 필요: ${target.url})`
    );
  }

  let rawRows =
    target.vendor === "uwayapply"
      ? parser.parseRows(html, target.department)
      : parser
          .parseRows(html)
          .filter((r) => r.학과.includes(target.department));

  // 특정 전형만 보고 싶을 때: targets.json에 includeTypes를 지정하면 그 목록에
  // "있는" 전형만 남긴다(정확히 일치). 지정 안 하면(undefined) 전부 보여준다.
  if (Array.isArray(target.includeTypes)) {
    rawRows = rawRows.filter((r) => target.includeTypes.includes(r.전형));
  }

  const collectedAt = new Date().toISOString();
  return rawRows.map((r) => ({
    전형: r.전형,
    대학: target.school,
    학과: r.학과,
    모집인원: r.모집인원,
    지원인원: r.지원인원,
    경쟁률: r.경쟁률,
    수집시각: collectedAt,
  }));
}

async function main() {
  const targets = JSON.parse(fs.readFileSync(TARGETS_PATH, "utf-8"));
  const allRows = [];
  const errors = [];

  for (const target of targets) {
    process.stdout.write(`[${target.school}] ${target.department} 조회 중... `);
    try {
      const rows = await fetchTarget(target);
      allRows.push(...rows);
      console.log(`${rows.length}건`);
    } catch (e) {
      console.log(`실패 - ${e.message}`);
      errors.push({ school: target.school, department: target.department, error: e.message });
    }
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify({ generatedAt: new Date().toISOString(), rows: allRows, errors }, null, 2),
    "utf-8"
  );

  console.log(`\n총 ${allRows.length}행 저장됨 -> ${OUTPUT_PATH}`);
  if (errors.length > 0) {
    console.log(`\n⚠ 실패한 대상 ${errors.length}건:`);
    for (const e of errors) console.log(`  - ${e.school} ${e.department}: ${e.error}`);
  }

  console.log("\n--- 미리보기 ---");
  console.table(allRows);
}

main().catch((e) => {
  console.error("실행 실패:", e);
  process.exit(1);
});
