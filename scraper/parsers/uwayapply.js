// uwayapply.com (ratio.uwayapply.com) 페이지 파서
// jinhakapply와 마크업이 완전히 다름:
//  - <h3><span id="strTitleId_XXXX">전형명 경쟁률 현황</span></h3> 로 섹션 시작
//  - 표 안 각 행은 (단과대학 td: rowspan으로 생략되기도 함) -> 학과명 td -> 모집인원 td -> 지원인원 td -> 경쟁률 td
//  - 인코딩이 EUC-KR인 경우가 많음 (호출 측에서 디코딩 필요)
//
// 행마다 컬럼 수가 rowspan에 따라 달라져서 범용 표 파서 대신,
// "원하는 학과명이 들어있는 td"를 직접 찾아 그 뒤 3개 td(모집/지원/경쟁률)를 잡는 방식으로 파싱한다.

function extractSiteTitle(html) {
  const m = html.match(/<title>\s*([\s\S]*?)\s*<\/title>/);
  return m ? m[1].replace(/\s+/g, " ").trim() : "";
}

function findSections(html) {
  const sections = [];
  // 주의: 페이지 최상단의 "전형별" 요약 제목은
  //   <span id="strTitleId_TypeStat">전형별 경쟁률 현황</h3></span>
  // 처럼 "경쟁률 현황"이 </span> 앞에 </h3>를 끼고 나온다. [\s\S]*? 로 잡으면
  // 이 span이 매칭 실패하고 훨씬 뒤에 있는 진짜 전형명 span까지 통째로 삼켜버리므로,
  // 태그 경계를 넘지 못하게 [^<]* 로 제한한다(제목 텍스트엔 태그가 없음).
  const sectionRegex =
    /<span id="strTitleId_[^"]*"[^>]*>\s*([^<]*?)\s*경쟁률 현황\s*<\/span>/g;
  let m;
  while ((m = sectionRegex.exec(html)) !== null) {
    sections.push({
      index: m.index,
      name: m[1].replace(/\s+/g, " ").trim(),
    });
  }
  return sections;
}

function admissionTypeAt(sections, offset) {
  let name = "";
  for (const s of sections) {
    if (s.index <= offset) name = s.name;
    else break;
  }
  return name;
}

function stripTags(s) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRows(html, departmentKeyword) {
  const sections = findSections(html);
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
      전형: admissionTypeAt(sections, m.index),
      학과: stripTags(m[1]),
      모집인원: m[2].trim(),
      지원인원: m[3].trim(),
      경쟁률: stripTags(m[4]),
    });
  }
  return rows;
}

module.exports = { extractSiteTitle, parseRows };
