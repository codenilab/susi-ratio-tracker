// standalone.js
// susi-ratio-tracker 스크래퍼의 클라우드 예약작업용 단일 파일 버전.
// (config/targets.json, scraper/parsers/*.js 를 한 파일로 합친 것 — 로컬 파일 의존성 없음)
//
// 실행: node standalone.js
// 결과: ./latest.json 에 { generatedAt, rows, errors } 저장 + 콘솔 요약 출력

const fs = require("fs");
const path = require("path");

const TARGETS = [
  { school: "가천대", department: "패션산업학과", url: "https://addon.jinhakapply.com/RatioV1/RatioH/Ratio10190711.html", vendor: "jinhakapply", expectedSiteTitle: "가천대학교", includeTypes: ["학생부우수자 전형","가천바람개비 전형"] },
  { school: "서울여대", department: "패션산업학과", url: "https://addon.jinhakapply.com/RatioV1/RatioH/Ratio10860591.html", vendor: "jinhakapply", expectedSiteTitle: "서울여자대학교", includeTypes: ["학생부종합(바롬인재면접전형)","학생부종합(바롬인재서류전형)","학생부교과(교과우수자전형)"] },
  { school: "충남대", department: "의류학과", url: "https://addon.jinhakapply.com/RatioV1/RatioH/Ratio11400471.html", vendor: "jinhakapply", expectedSiteTitle: "충남대학교", includeTypes: ["일반전형","학생부종합 서류전형","학생부종합 면접전형"] },
  { school: "충북대", department: "의류학과", url: "https://addon.jinhakapply.com/RatioV1/RatioH/Ratio11411051.html", vendor: "jinhakapply", expectedSiteTitle: "충북대학교", includeTypes: ["학생부교과(학생부교과전형)","학생부종합(학생부종합Ⅰ전형)","학생부종합(학생부종합Ⅱ전형)"] },
  { school: "공주대", department: "의류상품학과", url: "https://addon.jinhakapply.com/RatioV1/RatioH/Ratio10281081.html", vendor: "jinhakapply", expectedSiteTitle: "국립공주대학교", includeTypes: ["학생부교과전형 일반전형(정원내)","학생부종합전형 일반전형(정원내)"] },
  { school: "계명대", department: "패션마케팅학과", url: "https://ratio.uwayapply.com/Sl5KOk05SmYlJjomSjdmVGY=", vendor: "uwayapply", expectedSiteTitle: "계명대학교", includeTypes: ["정원내 학생부종합(일반전형)","정원내 학생부교과(일반전형)"] },
  { school: "한경대", department: "의류산업학과", url: "https://addon.jinhakapply.com/RatioV1/RatioH/Ratio30161171.html", vendor: "jinhakapply", expectedSiteTitle: "한경국립대학교", includeTypes: ["학생부교과(일반전형_안성)_정원내","학생부종합(잠재력우수자_안성)_정원내"] },
  { school: "가톨릭대", department: "의류학과", url: "https://addon.jinhakapply.com/RatioV1/RatioH/Ratio10030381.html", vendor: "jinhakapply", expectedSiteTitle: "가톨릭대학교", includeTypes: ["학생부종합(잠재능력우수자면접전형)","학생부종합(잠재능력우수자서류전형)"] },
];

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// ---------- 공통 ----------
function stripTags(s) {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

// ---------- jinhakapply.com 파서 ----------
const jinhakapply = {
  extractSiteTitle(html) {
    const m = html.match(/<title>\s*([\s\S]*?)\s*<\/title>/);
    return m ? m[1].replace(/\s+/g, " ").trim() : "";
  },
  parseRows(html) {
    const rows = [];
    const sectionRegex =
      /<h2>\s*<strong>\s*(.*?)\s*<\/strong>\s*경쟁률 현황\s*<\/h2>([\s\S]*?)(?=<h2>|$)/g;
    let sectionMatch;
    while ((sectionMatch = sectionRegex.exec(html)) !== null) {
      const admissionType = sectionMatch[1].replace(/\s+/g, " ").trim();
      const sectionHtml = sectionMatch[2];
      const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
      let trMatch;
      while ((trMatch = trRegex.exec(sectionHtml)) !== null) {
        const cells = [];
        const tdRegex = /<td([^>]*)>([\s\S]*?)<\/td>/g;
        let m;
        while ((m = tdRegex.exec(trMatch[1])) !== null) {
          cells.push({ isUnit: /class\s*=\s*"unit"/.test(m[1]), text: stripTags(m[2]) });
        }
        const unitCells = cells.filter((c) => c.isUnit);
        if (unitCells.length === 0) continue;
        const 학과 = unitCells[unitCells.length - 1].text;
        const numberCells = cells.filter((c) => !c.isUnit);
        if (numberCells.length < 3) continue;
        const [모집인원, 지원인원, 경쟁률] = numberCells.slice(0, 3).map((c) => c.text);
        rows.push({ 전형: admissionType, 학과, 모집인원, 지원인원, 경쟁률 });
      }
    }
    return rows;
  },
};

// ---------- uwayapply.com 파서 ----------
const uwayapply = {
  extractSiteTitle(html) {
    const m = html.match(/<title>\s*([\s\S]*?)\s*<\/title>/);
    return m ? m[1].replace(/\s+/g, " ").trim() : "";
  },
  parseRows(html, departmentKeyword) {
    const sections = [];
    const sectionRegex =
      /<span id="strTitleId_[^"]*"[^>]*>\s*([^<]*?)\s*경쟁률 현황\s*<\/span>/g;
    let sm;
    while ((sm = sectionRegex.exec(html)) !== null) {
      sections.push({ index: sm.index, name: sm[1].replace(/\s+/g, " ").trim() });
    }
    const admissionTypeAt = (offset) => {
      let name = "";
      for (const s of sections) {
        if (s.index <= offset) name = s.name;
        else break;
      }
      return name;
    };

    const escaped = departmentKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const deptRegex = new RegExp(
      `<td[^>]*>\\s*(${escaped}[^<]*)<\\/td>\\s*` +
        `<td[^>]*>([^<]*)<\\/td>\\s*` +
        `<td[^>]*>([^<]*)<\\/td>\\s*` +
        `<td[^>]*>([\\s\\S]*?)<\\/td>`,
      "g"
    );
    const rows = [];
    let m;
    while ((m = deptRegex.exec(html)) !== null) {
      rows.push({
        전형: admissionTypeAt(m.index),
        학과: stripTags(m[1]),
        모집인원: m[2].trim(),
        지원인원: m[3].trim(),
        경쟁률: stripTags(m[4]),
      });
    }
    return rows;
  },
};

function getParser(vendor) {
  if (vendor === "jinhakapply") return jinhakapply;
  if (vendor === "uwayapply") return uwayapply;
  throw new Error(`알 수 없는 vendor: ${vendor}`);
}

async function fetchHtml(url, vendor) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (vendor === "uwayapply") {
    const buf = await res.arrayBuffer();
    return new TextDecoder("euc-kr").decode(buf);
  }
  return await res.text();
}

async function fetchTarget(target) {
  const parser = getParser(target.vendor);
  const html = await fetchHtml(target.url, target.vendor);

  const siteTitle = parser.extractSiteTitle(html);
  if (!siteTitle.includes(target.expectedSiteTitle)) {
    throw new Error(
      `학교명 불일치! 기대: "${target.expectedSiteTitle}", 실제: "${siteTitle}" (${target.url})`
    );
  }

  let rawRows =
    target.vendor === "uwayapply"
      ? parser.parseRows(html, target.department)
      : parser.parseRows(html).filter((r) => r.학과.includes(target.department));

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
    원본URL: target.url,
  }));
}

async function main() {
  const allRows = [];
  const errors = [];

  for (const target of TARGETS) {
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

  const output = { generatedAt: new Date().toISOString(), rows: allRows, errors };
  const outPath = path.join(__dirname, "latest.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");

  console.log(`\n총 ${allRows.length}행 저장됨 -> ${outPath}`);
  if (errors.length > 0) {
    console.log(`\n⚠ 실패 ${errors.length}건:`);
    for (const e of errors) console.log(`  - ${e.school} ${e.department}: ${e.error}`);
  }
}

main().catch((e) => {
  console.error("실행 실패:", e);
  process.exit(1);
});
