export type Grade = "S" | "A" | "B" | "C" | "D";

export const GRADE_COLORS: Record<Grade, { main: string; bg: string; glow: string; text: string }> = {
  S: { main: "#FF3B2F", bg: "#331713",  glow: "rgba(255,59,47,0.2)",  text: "#FF6B63" },
  A: { main: "#F840F0", bg: "#301530",  glow: "rgba(248,64,240,0.2)", text: "#FA70F3" },
  B: { main: "#F09000", bg: "#2E2010",  glow: "rgba(240,144,0,0.2)",  text: "#FFB040" },
  C: { main: "#A0BCC8", bg: "#1C2528",  glow: "rgba(160,188,200,0.2)",text: "#B8D0DA" },
  D: { main: "#B87A40", bg: "#261E14",  glow: "rgba(184,122,64,0.2)", text: "#D0A070" },
};

export const GRADE_BADGES: Record<Grade, string> = {
  S: "/badges/rank-s.svg",
  A: "/badges/rank-a.svg",
  B: "/badges/rank-b.svg",
  C: "/badges/rank-c.svg",
  D: "/badges/rank-d.svg",
};

export function getGradeColor(grade: string) {
  const key = grade?.trim().toUpperCase().charAt(0) as Grade;
  return GRADE_COLORS[key] || GRADE_COLORS.D;
}

export function getGradeBadge(grade: string) {
  const key = grade?.trim().toUpperCase().charAt(0) as Grade;
  return GRADE_BADGES[key] || GRADE_BADGES.D;
}
