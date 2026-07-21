import { computeCareerGrade } from "./career-grade";

// 재물운 assertWealthConsistency의 커리어 버전. 관성 유형↔관성 목록·관다신약↔careerGrip·
// 상관견관↔관성부재 상호배타를 검증한다(3-layer 정합 — facts/grade/prompt가 따로 놀지 않게).
// analyze에서 Gemini 호출 전 실행하고, 이슈가 있으면 환불 후 500(잘못된 유료 리포트 방지).
export function assertCareerConsistency(args: {
  grade: string;
  careerScore: number;
  facts: {
    gwanseongType: "정관우세" | "편관우세" | "관살혼잡" | "무관";
    gwanseong: unknown[];
    gwandaSinyak: boolean;
    careerGrip: "신왕관왕" | "신왕관쇠" | "관다신약" | "신약관소";
    sanggwanGyeongwan: boolean;
    gwanseongAbsent: boolean;
  };
}): string[] {
  const issues: string[] = [];

  if (args.grade !== computeCareerGrade(args.careerScore).grade) {
    issues.push(
      `등급 불일치: 저장 ${args.grade} vs 직장운(${args.careerScore}) 매핑 ${computeCareerGrade(args.careerScore).grade}`,
    );
  }

  const { gwanseongType, gwanseong } = args.facts;
  const gwanseongEmpty = gwanseong.length === 0;
  if (gwanseongType === "무관" && !gwanseongEmpty) {
    issues.push(`관성 유형 불일치: 무관인데 gwanseong ${gwanseong.length}건 존재`);
  }
  if (gwanseongType !== "무관" && gwanseongEmpty) {
    issues.push(`관성 유형 불일치: ${gwanseongType}인데 gwanseong 비어있음`);
  }

  if (args.facts.gwandaSinyak !== (args.facts.careerGrip === "관다신약")) {
    issues.push(
      `관다신약 불일치: gwandaSinyak ${args.facts.gwandaSinyak} vs careerGrip ${args.facts.careerGrip}`,
    );
  }

  // 상관견관은 관성이 존재해야만 성립(관성 없으면 극할 대상이 없음) — career-facts 런타임 가드와
  // 동일 불변식을 저장 후 3-layer에서 한 번 더 확인.
  if (args.facts.sanggwanGyeongwan && args.facts.gwanseongAbsent) {
    issues.push("상관견관 불일치: 무관(관성 없음)인데 상관견관 발화");
  }

  return issues;
}
