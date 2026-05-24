/**
 * 프론트엔드 gender 문자열("남성", "남", "male" 등)을
 * 라이브러리가 기대하는 "male" | "female"로 정규화.
 *
 * 명리학에서 성별은 대운 방향(陽男陰女 順行 / 陰男陽女 逆行)과 일부 신살(홍염살 등)에
 * 영향 — 잘못 분류되면 대운 방향이 정통과 반대로 산출됨. 변형 입력을 모두 명시.
 *
 * 알 수 없는 값은 console.warn + male 디폴트 (이전 female 디폴트는 음남이 양녀로 둔갑하는
 * 더 큰 왜곡을 유발하므로 male 디폴트가 안전. 단 production UI는 "남성"/"여성" 강제).
 */
const MALE_TOKENS = new Set(["남", "남자", "남성", "male", "m", "남아", "사내"]);
const FEMALE_TOKENS = new Set(["여", "여자", "여성", "female", "f", "여아", "girl"]);

export function normalizeGender(raw: string | undefined | null): "male" | "female" {
  const normalized = (raw ?? "").trim().toLowerCase();
  if (MALE_TOKENS.has(normalized)) return "male";
  if (FEMALE_TOKENS.has(normalized)) return "female";
  if (normalized) {
    console.warn(`[normalizeGender] unknown value: "${raw}" — defaulting to "male"`);
  }
  return "male";
}
