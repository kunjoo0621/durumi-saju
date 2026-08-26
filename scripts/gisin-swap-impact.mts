/**
 * 기신(忌神) 규칙 교체안 — 실사용자 영향 정밀 실측.
 * 현행: gisin = 용신을 극하는 오행
 * 교체안: 신강→{관성:비겁, 식상:인성, 재성:비겁}, 신약→{인성:재성, 비겁:관성}
 * 검증 항목:
 *  1) 교체로 기신이 바뀌는 사람 수·유형 (기대: 신강+관성 칸에서 식상→비겁만)
 *  2) 신강+관성용신 칸 내부: 인성주도 신강 vs 비겁주도 신강 분해 (D-1 근거)
 *  3) 극왕(종격 후보) 인원 (D-2 근거)
 * ★TZ=UTC 필수: TZ=UTC npx tsx scripts/gisin-swap-impact.mts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env: Record<string, string> = {};
for (const l of readFileSync(".env.local", "utf-8").split("\n")) {
  const m = l.match(/^([^#=]+)=["']?(.+?)["']?$/); if (m) env[m[1].trim()] = m[2].trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
async function all<T>(build: (a: number, b: number) => any): Promise<T[]> {
  const P = 1000, out: T[] = [];
  for (let i = 0; ; i += P) {
    const { data, error } = await build(i, i + P - 1); if (error) throw error;
    if (!data?.length) break; out.push(...data); if (data.length < P) break;
  }
  return out;
}

const GEN: Record<string, string> = { 목: "화", 화: "토", 토: "금", 금: "수", 수: "목" };
const CTL: Record<string, string> = { 목: "토", 화: "금", 토: "수", 금: "목", 수: "화" };
const genMe = (e: string) => Object.keys(GEN).find(k => GEN[k] === e)!; // 인성
const ctlMe = (e: string) => Object.keys(CTL).find(k => CTL[k] === e)!; // 관성

async function main() {
  if (new Date().getTimezoneOffset() !== 0) { console.error("TZ=UTC 로 실행하세요"); process.exit(1); }
  const { calculateSaju, enrichSajuData } = await import("../lib/utils/saju");
  const rows = await all<any>((a, b) => sb.from("saju_results")
    .select("birth_date, birth_time, gender, region, calendar_type").range(a, b));
  console.log(`saju_results ${rows.length.toLocaleString()}건 로드`);

  let ok = 0, changed = 0;
  const changeTypes: Record<string, number> = {};
  const cellCount: Record<string, number> = {}; // 강약진영+용신라벨 별 인원
  // 신강+관성용신 칸 내부 분해
  let cellGwan = 0, insungDominant = 0, bigeopDominant = 0, tiedDom = 0, geukwang = 0;
  const strengthLevelsInCell: Record<string, number> = {};

  for (const r of rows) {
    try {
      const d = String(r.birth_date ?? ""); if (d.length < 10) continue;
      const y = +d.slice(0, 4), mo = +d.slice(5, 7), dd = +d.slice(8, 10);
      if (!y || y < 1901 || y > 2030) continue;
      const tm = String(r.birth_time ?? ""); const tu = tm.length < 5;
      const [h, mi] = tu ? [12, 0] : [+tm.slice(0, 2), +tm.slice(3, 5)];
      const P: any = await calculateSaju(y, mo, dd, h, mi, { birthLocation: r.region ?? undefined });
      if (!P) continue;
      const E: any = enrichSajuData(P, { isTimeUnknown: tu });
      const de = E.dayMaster.element as string;
      const dist = E.elementDist as Record<string, number>;
      const level = E.strength.result as string;
      const isStrong = ["극왕", "태강", "신강", "중화신강"].includes(level);
      const yong = E.yongshin.eokbu as string;
      const curGisin = E.yongshin.gisin as string;

      // 용신 라벨 (십성) 판정
      const map: Record<string, string> = {
        [ctlMe(de)]: "관성", [GEN[de]]: "식상", [CTL[de]]: "재성",
        [genMe(de)]: "인성", [de]: "비겁",
      };
      const yongLabel = map[yong] ?? "?";
      ok++;
      cellCount[`${isStrong ? "신강측" : "신약측"}+${yongLabel}`] =
        (cellCount[`${isStrong ? "신강측" : "신약측"}+${yongLabel}`] ?? 0) + 1;

      // 교체안 기신
      let newGisin: string;
      if (isStrong) {
        newGisin = yongLabel === "식상" ? genMe(de) : de; // 관성·재성→비겁, 식상→인성
      } else {
        newGisin = yongLabel === "인성" ? CTL[de] : ctlMe(de); // 인성→재성, 비겁→관성
      }
      if (newGisin !== curGisin) {
        changed++;
        const lbl = (x: string) => map[x] ?? x;
        changeTypes[`${lbl(curGisin)} → ${lbl(newGisin)}`] =
          (changeTypes[`${lbl(curGisin)} → ${lbl(newGisin)}`] ?? 0) + 1;
      }

      // 신강+관성용신 칸 내부 분해
      if (isStrong && yongLabel === "관성") {
        cellGwan++;
        strengthLevelsInCell[level] = (strengthLevelsInCell[level] ?? 0) + 1;
        if (level === "극왕") geukwang++;
        const ins = dist[genMe(de)] ?? 0, big = dist[de] ?? 0;
        if (ins > big) insungDominant++;
        else if (big > ins) bigeopDominant++;
        else tiedDom++;
      }
    } catch { }
  }

  const p = (n: number, base = ok) => `${n.toLocaleString()}명 (${(n / base * 100).toFixed(1)}%)`;
  console.log(`\n계산 성공 ${ok.toLocaleString()}명`);
  console.log(`기신이 바뀌는 사람: ${p(changed)}`);
  console.log(`변화 유형:`);
  Object.entries(changeTypes).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v.toLocaleString()}명`));
  console.log(`\n강약×용신 칸 분포:`);
  Object.entries(cellCount).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${p(v)}`));
  console.log(`\n── 신강+관성용신 칸 내부 (${cellGwan.toLocaleString()}명) ──`);
  console.log(`  8단계 분포: ${JSON.stringify(strengthLevelsInCell)}`);
  console.log(`  극왕(종왕 후보): ${p(geukwang, cellGwan)}`);
  console.log(`  비겁주도(비겁>인성): ${p(bigeopDominant, cellGwan)}`);
  console.log(`  인성주도(인성>비겁): ${p(insungDominant, cellGwan)}`);
  console.log(`  동률(인성=비겁):     ${p(tiedDom, cellGwan)}`);
}
main();
