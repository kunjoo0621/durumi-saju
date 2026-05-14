// 60갑자 납음오행 (納音五行) — 갑자(甲子)부터 계해(癸亥)까지 60간지의 납음명과 오행.
// 세운 풀이에서 "올해 납음: 천하수" 같은 메타 정보 제공용.
// 출처: 자평진전·삼명통회 등 명리 표준.

export type NapumElement = "목" | "화" | "토" | "금" | "수";

export interface NapumEntry {
  korean: string;     // 천하수
  hanja: string;      // 天河水
  element: NapumElement;
}

export const NAPUM_60: Record<string, NapumEntry> = {
  "甲子": { korean: "해중금", hanja: "海中金", element: "금" },
  "乙丑": { korean: "해중금", hanja: "海中金", element: "금" },
  "丙寅": { korean: "노중화", hanja: "爐中火", element: "화" },
  "丁卯": { korean: "노중화", hanja: "爐中火", element: "화" },
  "戊辰": { korean: "대림목", hanja: "大林木", element: "목" },
  "己巳": { korean: "대림목", hanja: "大林木", element: "목" },
  "庚午": { korean: "노방토", hanja: "路傍土", element: "토" },
  "辛未": { korean: "노방토", hanja: "路傍土", element: "토" },
  "壬申": { korean: "검봉금", hanja: "劍鋒金", element: "금" },
  "癸酉": { korean: "검봉금", hanja: "劍鋒金", element: "금" },
  "甲戌": { korean: "산두화", hanja: "山頭火", element: "화" },
  "乙亥": { korean: "산두화", hanja: "山頭火", element: "화" },
  "丙子": { korean: "간하수", hanja: "澗下水", element: "수" },
  "丁丑": { korean: "간하수", hanja: "澗下水", element: "수" },
  "戊寅": { korean: "성두토", hanja: "城頭土", element: "토" },
  "己卯": { korean: "성두토", hanja: "城頭土", element: "토" },
  "庚辰": { korean: "백랍금", hanja: "白蠟金", element: "금" },
  "辛巳": { korean: "백랍금", hanja: "白蠟金", element: "금" },
  "壬午": { korean: "양류목", hanja: "楊柳木", element: "목" },
  "癸未": { korean: "양류목", hanja: "楊柳木", element: "목" },
  "甲申": { korean: "천중수", hanja: "泉中水", element: "수" },
  "乙酉": { korean: "천중수", hanja: "泉中水", element: "수" },
  "丙戌": { korean: "옥상토", hanja: "屋上土", element: "토" },
  "丁亥": { korean: "옥상토", hanja: "屋上土", element: "토" },
  "戊子": { korean: "벽력화", hanja: "霹靂火", element: "화" },
  "己丑": { korean: "벽력화", hanja: "霹靂火", element: "화" },
  "庚寅": { korean: "송백목", hanja: "松柏木", element: "목" },
  "辛卯": { korean: "송백목", hanja: "松柏木", element: "목" },
  "壬辰": { korean: "장류수", hanja: "長流水", element: "수" },
  "癸巳": { korean: "장류수", hanja: "長流水", element: "수" },
  "甲午": { korean: "사중금", hanja: "沙中金", element: "금" },
  "乙未": { korean: "사중금", hanja: "沙中金", element: "금" },
  "丙申": { korean: "산하화", hanja: "山下火", element: "화" },
  "丁酉": { korean: "산하화", hanja: "山下火", element: "화" },
  "戊戌": { korean: "평지목", hanja: "平地木", element: "목" },
  "己亥": { korean: "평지목", hanja: "平地木", element: "목" },
  "庚子": { korean: "벽상토", hanja: "壁上土", element: "토" },
  "辛丑": { korean: "벽상토", hanja: "壁上土", element: "토" },
  "壬寅": { korean: "금박금", hanja: "金箔金", element: "금" },
  "癸卯": { korean: "금박금", hanja: "金箔金", element: "금" },
  "甲辰": { korean: "복등화", hanja: "覆燈火", element: "화" },
  "乙巳": { korean: "복등화", hanja: "覆燈火", element: "화" },
  "丙午": { korean: "천하수", hanja: "天河水", element: "수" },
  "丁未": { korean: "천하수", hanja: "天河水", element: "수" },
  "戊申": { korean: "대역토", hanja: "大驛土", element: "토" },
  "己酉": { korean: "대역토", hanja: "大驛土", element: "토" },
  "庚戌": { korean: "차천금", hanja: "釵釧金", element: "금" },
  "辛亥": { korean: "차천금", hanja: "釵釧金", element: "금" },
  "壬子": { korean: "상자목", hanja: "桑柘木", element: "목" },
  "癸丑": { korean: "상자목", hanja: "桑柘木", element: "목" },
  "甲寅": { korean: "대계수", hanja: "大溪水", element: "수" },
  "乙卯": { korean: "대계수", hanja: "大溪水", element: "수" },
  "丙辰": { korean: "사중토", hanja: "沙中土", element: "토" },
  "丁巳": { korean: "사중토", hanja: "沙中土", element: "토" },
  "戊午": { korean: "천상화", hanja: "天上火", element: "화" },
  "己未": { korean: "천상화", hanja: "天上火", element: "화" },
  "庚申": { korean: "석류목", hanja: "石榴木", element: "목" },
  "辛酉": { korean: "석류목", hanja: "石榴木", element: "목" },
  "壬戌": { korean: "대해수", hanja: "大海水", element: "수" },
  "癸亥": { korean: "대해수", hanja: "大海水", element: "수" },
};

export function getNapum(pillar: string): NapumEntry | null {
  return NAPUM_60[pillar] ?? null;
}
