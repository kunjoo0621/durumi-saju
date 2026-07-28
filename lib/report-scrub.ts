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
export const HANJA_RE = /[\u3400-\u9fff\uf900-\ufaff]/;
export const HANJA_GLOBAL = /[\u3400-\u9fff\uf900-\ufaff]/g;

/** 등급 알파벳 노출(정방향: "S등급", "B등급다운") — teaser 스포일러·서열화 방지 */
export const GRADE_ALPHA =
  /(SS|[SABCD])\s*등급(다운|답게|다워|스러운|의|이|은|을|급)?/g;

/**
 * 한자 + (한글 독음) 괄호를 독음으로 풀어낸다 — `申(신금)` → `신금`.
 *
 * 왜 필요: scrubHanja 가 한자만 떼면 `(신금)` 고아 괄호가 남아 유료 본문에
 * "네 배우자 자리는 (신금)이야" 로 출고됐다(2026-07-28 marriage-2 실측 3회).
 * 정상 뜻풀이 괄호(`편재(유동적인 큰돈)`)는 선행이 한글이라 미매치 — 무변형.
 */
export function unwrapHanjaReading(s: string): string {
  return s.replace(
    /[\u3400-\u9fff\uf900-\ufaff]+\s*\(\s*([가-힣][가-힣\s·]{0,8})\s*\)/g,
    "$1"
  );
}

/**
 * 본문 한자 제거 — 순수 한글 유지(신살명 한자병기·오타 방지).
 * "홍염살(紅艶殺)의" → "홍염살의", "겁재(劫財, 다투는 기운)" → "겁재(다투는 기운)".
 * 조용히 동작한다(violations 미기록) — minor 스타일이라 재생성 유발할 필요 없음.
 */
export function scrubHanja(s: string): string {
  if (!HANJA_RE.test(s)) return s;
  // ★독음 괄호 unwrap 을 무차별 제거보다 먼저 — 순서가 바뀌면 고아 괄호가 남는다.
  s = unwrapHanjaReading(s);
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
  // ★비율·구간 문맥 제외: 직전이 숫자/`:`/`~` 면 강도값이 아니다.
  //   "투자 비중을 7:3 정도로" 의 3 을 삼켜 "7: 유지하는 걸" 로 출고된 사고(wealth-2 실측).
  out = out.replace(/\s?(?<![\d:~])\d{1,2}\s*(정도|쯤)(으?로|의|는|야|지)?/g, "");
  out = out.replace(
    /(강도|힘|세력|기운)([은는이가도을를]?)\s*\d{1,2}(?=\s|인|이라|점|$)/g,
    "$1$2"
  );
  out = out.replace(/(^|[\s"'(])비유하자면[,\s]*/g, "$1");
  out = scrubBuzzwords(out);
  return out.replace(/\s{2,}/g, " ").replace(/\s+([,.])/g, "$1").trim();
}

/**
 * 그릇 4상한 용어("신왕재왕"·"관다신약" 등) → 중립어 치환(문장 보존).
 * 도메인별 용어 정규식을 받아 팩토리로 만든다(wealth: 재성 계열, career: 관성 계열).
 * ★완전 제거가 아니라 치환인 이유: 제거하면 한국어 조사가 깨진다(1차 사이클 교훈).
 */
export function makeScrubGripTerms(terms: RegExp, violations: string[]) {
  return (s: string): string => {
    if (!new RegExp(terms.source).test(s)) return s;

    // 1) 명명 프레임("명리학에서는 이걸 재다신약(…)이라고 불러") 문장은 통째로 컷.
    //    이 문장은 '용어 소개' 자체가 목적이라 치환해도 값어치가 0이고, 치환하면
    //    "이런 구조이라고 불러" 라는 비문이 남았다(wealth-4 실측 출고).
    const sentences = s.split(/(?<=[.!?])\s+/);
    const kept = sentences.filter((sent) => {
      const hasTerm = new RegExp(terms.source).test(sent);
      const isNaming =
        /(이?라고|이?라)\s*(불러|부른다|부르|하는데|해)/.test(sent) ||
        /(라고|라)\s*(불려|불린다)/.test(sent);
      return !(hasTerm && isNaming);
    });
    let out = kept.join(" ");

    // 2) 남은 위치는 치환 후 조사 정규화 — 치환어가 모음 종결이라 "이" 계열만 정리하면 충분.
    out = out.replace(terms, "이런 구조");
    out = out.replace(/이런 구조이(라|다|야)/g, "이런 구조$1");

    violations.push("그릇용어 노출 치환");
    return out.replace(/\s{2,}/g, " ").replace(/\s+([,.])/g, "$1").trim();
  };
}

/**
 * 확정 유행어만 소수 정예로 조용히 치환(재생성 불필요).
 * 프롬프트 금지가 이미 있는데 새는 것만 — 목록 비대화는 유지보수 부채라 실측 누출만 등록.
 * 실측: wealth-3 "남들이 5G급으로 성장한다고" (시니어 타깃 부적합).
 */
function scrubBuzzwords(s: string): string {
  return s
    .replace(/5G급으로/g, "빛의 속도로")
    .replace(/5G급이(야|라|다)/g, "빛의 속도$1")
    .replace(/5G급/g, "빛의 속도")
    .replace(/팩트폭격|팩폭/g, "직언");
}

/**
 * 등급 알파벳 노출 역방향("인연의 등급은 B지만") — 정방향 정규식이 못 잡던 구멍.
 * 알파벳만 지우면 "등급은 지만" 비문이 남으므로 **문장 단위 컷**이 맞다(marriage-4 실측 출고).
 * 뒤가 라틴 문자면 오탐(예: "등급은 Silver") 방지로 미매치.
 */
const GRADE_ALPHA_REVERSE = /등급[은는이]?\s*(SS|[SABCD])(?![A-Za-z])/;

/** 등급 알파벳 → 제거(스포일러 방지). 위반 기록 O. */
export function makeScrubGradeAlpha(violations: string[]) {
  return (s: string): string => {
    let out = s;

    // 1) 역방향은 문장 컷
    if (GRADE_ALPHA_REVERSE.test(out)) {
      const kept = out
        .split(/(?<=[.!?])\s+/)
        .filter((sent) => !GRADE_ALPHA_REVERSE.test(sent));
      out = kept.join(" ");
    }

    // 2) 정방향은 기존대로 어구 제거
    out = out.replace(GRADE_ALPHA, "");

    if (out === s) return s;
    violations.push("등급노출 스크럽");
    return out.replace(/\s{2,}/g, " ").replace(/\s+([,.])/g, "$1").trim();
  };
}
