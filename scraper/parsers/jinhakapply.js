// jinhakapply.com (addon.jinhakapply.com/RatioV1/...) 페이지 파서
// 구조: <h2><strong>전형명</strong> 경쟁률 현황</h2> 섹션 안에 표가 있고,
//       각 행은 class="unit" td(들)로 학과명(+단과대학명)을 표시하고 이어서
//       모집인원/지원인원/경쟁률 td가 온다.
//
// 학교마다 td 속성(rowspan 등), <tr>의 onmouseover 등 부가 속성이 붙는 경우가 있어서
// 고정 패턴 대신 각 <tr> 안의 <td>들을 개별로 뜯어서 조립하는 방식으로 파싱한다.

function extractSiteTitle(html) {
  const m = html.match(/<title>\s*([\s\S]*?)\s*<\/title>/);
  return m ? m[1].replace(/\s+/g, " ").trim() : "";
}

function stripTags(s) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTrCells(trContent) {
  const cells = [];
  const tdRegex = /<td([^>]*)>([\s\S]*?)<\/td>/g;
  let m;
  while ((m = tdRegex.exec(trContent)) !== null) {
    cells.push({
      isUnit: /class\s*=\s*"unit"/.test(m[1]),
      text: stripTags(m[2]),
    });
  }
  return cells;
}

function parseRows(html) {
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
      const cells = parseTrCells(trMatch[1]);
      const unitCells = cells.filter((c) => c.isUnit);
      if (unitCells.length === 0) continue; // 헤더행/총계행 등은 건너뜀

      // 단과대학+학과 두 칸이 같이 나오는 학교는 마지막 unit 칸이 실제 학과명
      const 학과 = unitCells[unitCells.length - 1].text;
      const numberCells = cells.filter((c) => !c.isUnit);
      if (numberCells.length < 3) continue;

      const [모집인원, 지원인원, 경쟁률] = numberCells.slice(0, 3).map((c) => c.text);
      rows.push({ 전형: admissionType, 학과, 모집인원, 지원인원, 경쟁률 });
    }
  }
  return rows;
}

module.exports = { extractSiteTitle, parseRows };
