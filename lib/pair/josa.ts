// 한국어 조사 선택 — 받침 유무로 결정론적으로 고른다.
//
// ★왜 필요한가: 사실 블록이 `${이름}를` 처럼 조사를 박아 두면 AI 가 그대로 따라 쓴다.
//   실측(scripts/couple-report-probe.ts)에서 "지영를 밀어준다", "서연가 준호에게" 가
//   유료 리포트에 그대로 나갔다. 이름은 사용자 입력이라 프롬프트로는 못 막는다.

type JosaKind = "을" | "이" | "은" | "와" | "로";

const PAIRS: Record<JosaKind, [withBatchim: string, withoutBatchim: string]> = {
  을: ["을", "를"],
  이: ["이", "가"],
  은: ["은", "는"],
  와: ["과", "와"],
  로: ["으로", "로"],
};

/** 마지막 글자의 받침 코드. 한글이 아니면 null. */
function finalConsonant(word: string): number | null {
  const last = word.trim().slice(-1);
  if (!last) return null;
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null; // 한글 음절이 아님
  return (code - 0xac00) % 28;
}

/**
 * 이름 뒤에 알맞은 조사를 붙인다.
 * ★한글이 아니면(영문 이름 등) 받침 없음으로 본다 — 어색해도 깨지지는 않는다.
 * ★"로"만 ㄹ 받침(코드 8)이 예외다.
 */
export function withJosa(word: string, kind: JosaKind): string {
  const jong = finalConsonant(word);
  const [withB, withoutB] = PAIRS[kind];
  if (jong === null || jong === 0) return `${word}${withoutB}`;
  if (kind === "로" && jong === 8) return `${word}${withoutB}`; // ㄹ 받침
  return `${word}${withB}`;
}
