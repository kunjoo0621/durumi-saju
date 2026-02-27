/**
 * 프론트엔드 gender 문자열("남성", "남", "male" 등)을
 * 라이브러리가 기대하는 "male" | "female"로 정규화.
 */
export function normalizeGender(raw: string | undefined | null): "male" | "female" {
  if (raw === "남" || raw === "남성" || raw === "male") return "male";
  return "female";
}
