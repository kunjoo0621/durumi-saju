// findRelationships 직접 import는 외부 패키지 체인 때문에 어려움.
// 대신 같은 로직을 inline으로 재현 (saju-enrichment.ts의 findRelationships 그대로)

const HYUNG: [string[], string][] = [
  [["寅", "巳", "申"], "무은지형(無恩之刑)"],
  [["丑", "戌", "未"], "지세지형(持勢之刑)"],
  [["子", "卯"], "무례지형(無禮之刑)"],
  [["辰", "辰"], "자형(自刑)"],
  [["午", "午"], "자형(自刑)"],
  [["酉", "酉"], "자형(自刑)"],
  [["亥", "亥"], "자형(自刑)"],
];

// 현재 코드 (버그 있음)
function findHyung_BUGGY(branches: string[]): string[] {
  const branchSet = new Set(branches);
  const result: string[] = [];
  for (const [group, name] of HYUNG) {
    if (group.length <= 2) {
      if (group.every((x) => branchSet.has(x))) {
        result.push(`${group.join("")} ${name}`);
      }
    } else {
      const matches = group.filter((x) => branchSet.has(x));
      if (matches.length >= 2) {
        result.push(`${matches.join("")} ${name}`);
      }
    }
  }
  return result;
}

// 수정 후 (정확)
function findHyung_FIXED(branches: string[]): string[] {
  const branchSet = new Set(branches);
  const counts = branches.reduce<Record<string, number>>((acc, b) => {
    acc[b] = (acc[b] ?? 0) + 1;
    return acc;
  }, {});
  const result: string[] = [];
  for (const [group, name] of HYUNG) {
    // 자형: 같은 글자 두 번 — count 기준
    if (group.length === 2 && group[0] === group[1]) {
      if ((counts[group[0]] ?? 0) >= 2) {
        result.push(`${group.join("")} ${name}`);
      }
      continue;
    }
    // 일반 형: 모두 다른 글자
    if (group.length <= 2) {
      if (group.every((x) => branchSet.has(x))) {
        result.push(`${group.join("")} ${name}`);
      }
    } else {
      const matches = group.filter((x) => branchSet.has(x));
      if (matches.length >= 2) {
        result.push(`${matches.join("")} ${name}`);
      }
    }
  }
  return result;
}

// 1995-06-21 16:30 KST → 만세력 표준:
// 년주 을해(乙亥) — 1995년 을해년
// 월주 임오(壬午) — 망종(6/6) 후 = 오월, 을해년 오월 천간 = 임
// 일주 계미(癸未) — 1995-06-21 일진 (사용자 확인)
// 시주 경신(庚申) — 16:30 = 신시(申時), 계일의 신시 천간 = 경

const branches = ["亥", "午", "未", "申"]; // 년·월·일·시 지지

console.log("=== 1995-06-21 16:30 신건주 사주 ===");
console.log("년주: 을해(乙亥)");
console.log("월주: 임오(壬午)");
console.log("일주: 계미(癸未)");
console.log("시주: 경신(庚申)");
console.log("지지:", branches.join(", "));
console.log();

console.log("=== 지지 분포 ===");
const counts = branches.reduce<Record<string, number>>((acc, b) => {
  acc[b] = (acc[b] ?? 0) + 1;
  return acc;
}, {});
console.log(counts);
console.log();

console.log("=== 현재 코드 (버그) — 형(刑) 판정 ===");
const buggy = findHyung_BUGGY(branches);
buggy.forEach((h) => console.log(`  - ${h}`));
if (buggy.length === 0) console.log("  (없음)");
console.log();

console.log("=== 수정 후 — 형(刑) 판정 ===");
const fixed = findHyung_FIXED(branches);
fixed.forEach((h) => console.log(`  - ${h}`));
if (fixed.length === 0) console.log("  (없음)");
console.log();

console.log("=== 차이 ===");
const removed = buggy.filter((h) => !fixed.includes(h));
const added = fixed.filter((h) => !buggy.includes(h));
if (removed.length === 0 && added.length === 0) {
  console.log("  변화 없음");
} else {
  removed.forEach((h) => console.log(`  - 제거됨(잘못 잡혔던 것): ${h}`));
  added.forEach((h) => console.log(`  + 추가됨: ${h}`));
}
