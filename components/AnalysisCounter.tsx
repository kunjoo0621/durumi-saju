"use client";
import { useEffect, useState } from "react";

// 랜딩 CTA 위 사회적 증거 카운터. 실제 누적 분석(개인·배틀·올해·오늘) + 마케팅 베이스를
// /api/stats/analyses 에서 받아 표시. 들어올 때 0→값 카운트업.
export default function AnalysisCounter() {
  const [target, setTarget] = useState<number | null>(null);
  const [disp, setDisp] = useState(0);

  useEffect(() => {
    fetch("/api/stats/analyses")
      .then((r) => r.json())
      .then((d) => { if (typeof d.count === "number") setTarget(d.count); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (target == null) return;
    const start = performance.now();
    const dur = 1100;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min((t - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisp(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  if (target == null) return null;

  return (
    <p className="mb-2.5 text-center text-[13px] text-[rgb(var(--c-text-sub))]">
      <span aria-hidden>🔮 </span>
      지금까지 <b className="font-bold text-white">{disp.toLocaleString()}명</b>이 사주를 봤어요
    </p>
  );
}
