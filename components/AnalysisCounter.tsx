"use client";
import { useEffect, useState } from "react";

// 랜딩 CTA 위 사회적 증거 카운터. 실제 누적 분석(개인·배틀·올해·오늘)을 500단위로
// 내림한 마일스톤(예: "2,000+")을 /api/stats/analyses 에서 받아 표시. 진입 시 0→값 카운트업.
// 실제가 다음 500을 넘으면 서버가 자동으로 다음 마일스톤을 내려준다.
export default function AnalysisCounter() {
  const [milestone, setMilestone] = useState<number | null>(null);
  const [disp, setDisp] = useState(0);

  useEffect(() => {
    fetch("/api/stats/analyses")
      .then((r) => r.json())
      .then((d) => { if (typeof d.milestone === "number") setMilestone(d.milestone); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (milestone == null) return;
    const start = performance.now();
    const dur = 1100;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min((t - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisp(Math.round(milestone * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [milestone]);

  if (milestone == null) return null;

  return (
    <p className="mb-2.5 text-center text-[13px] text-[rgb(var(--c-text-sub))]">
      <span aria-hidden>🔮 </span>
      지금까지 <b className="font-bold text-white">{disp.toLocaleString()}명+</b>이 사주를 봤어요
    </p>
  );
}
