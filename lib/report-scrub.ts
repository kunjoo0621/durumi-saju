/**
 * 심층 리포트(결혼운·재물운·커리어운) 공용 후처리 스크럽.
 *
 * 왜 모았나: 아래 스크럽들이 세 postprocess 파일에 **동일 코드로 3벌 복제**돼 있었다.
 * 한쪽만 고치면 나머지 둘이 뒤처지는 드리프트가 실제로 발생했고(career 만 한자 정규식이
 * 리터럴 표기), 3차 품질 사이클에서 수정할 지점이 전부 이 공용 영역이라 단일 소스로 모은다.
 *
 * 도메인 고유 목록(FORBIDDEN_PREDICTIONS·FORBIDDEN_SHINSAL·재무자문/실행단정·richness)은
 * 각 파일에 그대로 남긴다 — 이 모듈은 도메인 중립 스크럽만 담는다.
 *
 * ★한자 범위는 반드시 \u 이스케이프로 쓴다. 리터럴 표기는 함정이다:
 *   `豈` 는 U+F900(호환 한자)와 U+8C48(통합 한자) 두 형태가 있고, U+8C48 로 잘못 입력되면
 *   범위가 U+8C48–U+FAFF 가 되어 **한글 음절 영역(U+AC00–U+D7A3)을 통째로 삼킨다.**
 *   (2026-07-28 조사 중 실제로 이 함정에 빠져 오경보를 냈다. 기존 파일들은 정상이었다.)
 */

/** CJK 통합/확장A + 호환 한자 */
export const HANJA_RE = /[㐀-鿿豈-﫿]/;
export const HANJA_GLOBAL = /[㐀-鿿豈-﫿]/g;

/** 등급 알파벳 노출(정방향: "S등급", "B등급다운") — teaser 스포일러·서열화 방지 */
export const GRADE_ALPHA =
  /(SS|[SABCD])\s*등급(다운|답게|다워|스러운|의|이|은|을|급)?/g;

/**
 * 본문 한자 제거 — 순수 한글 유지(신살명 한자병기·오타 방지).
 * "홍염살(紅艶殺)의" → "홍염살의", "겁재(劫財, 다투는 기운)" → "겁재(다투는 기운)".
 * 조용히 동작한다(violations 미기록) — minor 스타일이라 재생성 유발할 필요 없음.
 */
export function scrubHanja(s: string): string {
  if (!HANJA_RE.test(s)) return s;
  return s
    .replace(HANJA_GLOBAL, "")
    .replace(/\(\s*[,，、·\s]*\)/g, "")
    .replace(/\(\s*[,，、]\s*/g, "(")
    .replace(/\s+([,.、·)])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * 독음 반복 괄호 collapse — "정관(정관, 바른 규칙)"→"정관(바른 규칙)", "축토(축토)"→"축토".
 * 한자병기 금지 학습으로 모델이 한자 자리에 독음을 반복 기입한 산물.
 * 선행 단어와 괄호 첫 토큰이 완전 동일할 때만 발동 → 정상 풀이 괄호("편재(유동적인 큰돈)")는 무변형.
 */
export function collapseEchoParens(s: string): string {
  return s
    .replace(/([가-힣]{1,6})\s*\(\s*\1\s*[,，·]\s*/g, "$1(")
    .replace(/([가-힣]{1,6})\s*\(\s*\1\s*\)/g, "$1");
}

/**
 * 강도값 누출(소수점+정수) + 상투적 필러 연결어 제거 — 조용히(재생성 불필요).
 * "비겁이 10.5로 강하다"→"비겁이 강하다", "힘도 5 정도로"→"힘도", "비유하자면, 넌 물이야"→"넌 물이야".
 * 필러는 프롬프트로 금지하면 오히려 프라이밍돼 늘어나므로 후처리 결정론 제거가 유일하게 확실하다.
 * "\d 정도/쯤" 패턴은 연도(년)·나이(세)가 사이에 오지 않아 안전(2028년·34세는 미매치).
 */
export function scrubStrayDecimals(s: string): string {
  let out = /\d+\.\d+/.test(s)
    ? s.replace(/\s?\d+\.\d+\s*(으?로|인|이라|짜리|점|씩)?/g, "")
    : s;
  out = out.replace(/\s?\d{1,2}\s*(정도|쯤)(으?로|의|는|야|지)?/g, "");
  out = out.replace(
    /(강도|힘|세력|기운)([은는이가도을를]?)\s*\d{1,2}(?=\s|인|이라|점|$)/g,
    "$1$2"
  );
  out = out.replace(/(^|[\s"'(])비유하자면[,\s]*/g, "$1");
  return out.replace(/\s{2,}/g, " ").replace(/\s+([,.])/g, "$1").trim();
}

/**
 * 그릇 4상한 용어("신왕재왕"·"관다신약" 등) → 중립어 치환(문장 보존).
 * 도메인별 용어 정규식을 받아 팩토리로 만든다(wealth: 재성 계열, career: 관성 계열).
 * ★완전 제거가 아니라 치환인 이유: 제거하면 한국어 조사가 깨진다(1차 사이클 교훈).
 */
export function makeScrubGripTerms(terms: RegExp, violations: string[]) {
  return (s: string): string => {
    const out = s.replace(terms, "이런 구조");
    if (out === s) return s;
    violations.push("그릇용어 노출 치환");
    return out.replace(/\s{2,}/g, " ").trim();
  };
}

/** 등급 알파벳 → 제거(스포일러 방지). 위반 기록 O. */
export function makeScrubGradeAlpha(violations: string[]) {
  return (s: string): string => {
    const out = s.replace(GRADE_ALPHA, "");
    if (out === s) return s;
    violations.push("등급노출 스크럽");
    return out.replace(/\s{2,}/g, " ").replace(/\s+([,.])/g, "$1").trim();
  };
}
