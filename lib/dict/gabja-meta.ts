export interface GabjaMeta {
  slug: string;
  order: number;
  group: 1 | 2 | 3 | 4 | 5 | 6;
}

export const GABJA_META: GabjaMeta[] = [
  // 갑자순 (1~10) — 공망 술·해
  { slug: "gapja", order: 1, group: 1 },
  { slug: "eulchuk", order: 2, group: 1 },
  { slug: "byeongin", order: 3, group: 1 },
  { slug: "jeongmyo", order: 4, group: 1 },
  { slug: "mujin", order: 5, group: 1 },
  { slug: "gisa", order: 6, group: 1 },
  { slug: "gyeongo", order: 7, group: 1 },
  { slug: "sinmi", order: 8, group: 1 },
  { slug: "imsin", order: 9, group: 1 },
  { slug: "gyeyu", order: 10, group: 1 },
  // 갑술순 (11~20) — 공망 신·유
  { slug: "gapsul", order: 11, group: 2 },
  { slug: "eulhae", order: 12, group: 2 },
  { slug: "byeongja", order: 13, group: 2 },
  { slug: "jeongchuk", order: 14, group: 2 },
  { slug: "muin", order: 15, group: 2 },
  { slug: "gimyo", order: 16, group: 2 },
  { slug: "gyeongjin", order: 17, group: 2 },
  { slug: "sinsa", order: 18, group: 2 },
  { slug: "imo", order: 19, group: 2 },
  { slug: "gyemi", order: 20, group: 2 },
  // 갑신순 (21~30) — 공망 오·미
  { slug: "gapsin", order: 21, group: 3 },
  { slug: "eulyu", order: 22, group: 3 },
  { slug: "byeongsul", order: 23, group: 3 },
  { slug: "jeonghae", order: 24, group: 3 },
  { slug: "muja", order: 25, group: 3 },
  { slug: "gichuk", order: 26, group: 3 },
  { slug: "gyeongin", order: 27, group: 3 },
  { slug: "sinmyo", order: 28, group: 3 },
  { slug: "imjin", order: 29, group: 3 },
  { slug: "gyesa", order: 30, group: 3 },
  // 갑오순 (31~40) — 공망 진·사
  { slug: "gapo", order: 31, group: 4 },
  { slug: "eulmi", order: 32, group: 4 },
  { slug: "byeongsin", order: 33, group: 4 },
  { slug: "jeongyu", order: 34, group: 4 },
  { slug: "musul", order: 35, group: 4 },
  { slug: "gihae", order: 36, group: 4 },
  { slug: "gyeongja", order: 37, group: 4 },
  { slug: "sinchuk", order: 38, group: 4 },
  { slug: "imin", order: 39, group: 4 },
  { slug: "gyemyo", order: 40, group: 4 },
  // 갑진순 (41~50) — 공망 인·묘
  { slug: "gapjin", order: 41, group: 5 },
  { slug: "eulsa", order: 42, group: 5 },
  { slug: "byeongo", order: 43, group: 5 },
  { slug: "jeongmi", order: 44, group: 5 },
  { slug: "musin", order: 45, group: 5 },
  { slug: "giyu", order: 46, group: 5 },
  { slug: "gyeongsul", order: 47, group: 5 },
  { slug: "sinhae", order: 48, group: 5 },
  { slug: "imja", order: 49, group: 5 },
  { slug: "gyechuk", order: 50, group: 5 },
  // 갑인순 (51~60) — 공망 자·축
  { slug: "gabin", order: 51, group: 6 },
  { slug: "eulmyo", order: 52, group: 6 },
  { slug: "byeongjin", order: 53, group: 6 },
  { slug: "jeongsa", order: 54, group: 6 },
  { slug: "muo", order: 55, group: 6 },
  { slug: "gimi", order: 56, group: 6 },
  { slug: "gyeongsin", order: 57, group: 6 },
  { slug: "sinyu", order: 58, group: 6 },
  { slug: "imsul", order: 59, group: 6 },
  { slug: "gyehae", order: 60, group: 6 },
];

export interface GabjaGroup {
  id: 1 | 2 | 3 | 4 | 5 | 6;
  name: string;
  gongmang: string;
}

export const GABJA_GROUPS: GabjaGroup[] = [
  { id: 1, name: "갑자순(甲子旬)", gongmang: "술(戌)·해(亥)" },
  { id: 2, name: "갑술순(甲戌旬)", gongmang: "신(申)·유(酉)" },
  { id: 3, name: "갑신순(甲申旬)", gongmang: "오(午)·미(未)" },
  { id: 4, name: "갑오순(甲午旬)", gongmang: "진(辰)·사(巳)" },
  { id: 5, name: "갑진순(甲辰旬)", gongmang: "인(寅)·묘(卯)" },
  { id: 6, name: "갑인순(甲寅旬)", gongmang: "자(子)·축(丑)" },
];
