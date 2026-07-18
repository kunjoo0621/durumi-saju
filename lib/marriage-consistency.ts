import { computeMarriageGrade } from "./marriage-grade";

export function assertMarriageConsistency(args: {
  grade: string; loveScore: number; facts: { sex: string; spouseStarType?: string }; primaryGender: string;
}): string[] {
  const issues: string[] = [];
  if (args.grade !== computeMarriageGrade(args.loveScore).grade) {
    issues.push(`등급 불일치: 저장 ${args.grade} vs 연애운(${args.loveScore}) 매핑 ${computeMarriageGrade(args.loveScore).grade}`);
  }
  const expectedStar = args.facts.sex === "female" ? "관성" : "재성";
  if (args.facts.spouseStarType && args.facts.spouseStarType !== expectedStar) {
    issues.push(`배우자성 불일치: ${args.facts.sex}인데 ${args.facts.spouseStarType}`);
  }
  const g = /여|female/i.test(args.primaryGender) ? "female" : "male";
  if (args.facts.sex !== g) issues.push(`성별 불일치: facts ${args.facts.sex} vs primary ${g}`);
  return issues;
}
