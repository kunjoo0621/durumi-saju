import { computeWealthGrade } from "./wealth-grade";

// 결혼운 assertMarriageConsistency와 동일한 역할의 재물운 버전. 재물운에는 성별/배우자성
// 개념이 없으므로 그 축은 없고, 대신 재성 유형↔재성 목록·재다신약↔jaeGrip 상호배타를 검증.
export function assertWealthConsistency(args: {
  grade: string;
  wealthScore: number;
  facts: {
    jaeseongType: "정재우세" | "편재우세" | "재성혼재" | "무재";
    jaeseong: unknown[];
    jaedaShinyak: boolean;
    jaeGrip: "신왕재왕" | "신왕재쇠" | "재다신약" | "신약재소";
  };
}): string[] {
  const issues: string[] = [];

  if (args.grade !== computeWealthGrade(args.wealthScore).grade) {
    issues.push(
      `등급 불일치: 저장 ${args.grade} vs 재물운(${args.wealthScore}) 매핑 ${computeWealthGrade(args.wealthScore).grade}`,
    );
  }

  const { jaeseongType, jaeseong } = args.facts;
  const jaeseongEmpty = jaeseong.length === 0;
  if (jaeseongType === "무재" && !jaeseongEmpty) {
    issues.push(`재성 유형 불일치: 무재인데 jaeseong ${jaeseong.length}건 존재`);
  }
  if (jaeseongType !== "무재" && jaeseongEmpty) {
    issues.push(`재성 유형 불일치: ${jaeseongType}인데 jaeseong 비어있음`);
  }

  if (args.facts.jaedaShinyak !== (args.facts.jaeGrip === "재다신약")) {
    issues.push(
      `재다신약 불일치: jaedaShinyak ${args.facts.jaedaShinyak} vs jaeGrip ${args.facts.jaeGrip}`,
    );
  }

  return issues;
}
