"use client";

// 🚨 DEV ONLY — 재물운·결혼운 풍부화 결과 화면 검증 (prod 404).
// scripts/enrich-quality-test.mts가 생성한 실제 5명 결과(lib/mockEnrichPreview.json)를
// 진짜 결과 컴포넌트(WealthResultBody/MarriageResultBody)에 그대로 먹여 렌더한다.
import { useState } from "react";
import { useRouter, notFound } from "next/navigation";
import { WealthResultBody } from "@/app/wealth/result/WealthResultClient";
import { MarriageResultBody } from "@/app/marriage/result/MarriageResultClient";
import PREVIEW from "@/lib/mockEnrichPreview.json";

export default function DevEnrichResultUiPage() {
  const router = useRouter();
  const [p, setP] = useState(0);
  const [svc, setSvc] = useState<"wealth" | "marriage">("wealth");

  if (process.env.NODE_ENV === "production") notFound();

  const people = PREVIEW as any[];
  const person = people[p];
  const api = svc === "wealth" ? person?.apiWealth : person?.apiMarriage;

  return (
    <div className="min-h-screen bg-background-primary">
      {/* dev 스위처 (실제 화면 위에 얹는 컨트롤 바 — prod엔 없음) */}
      <div
        style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(15,15,17,.92)", backdropFilter: "blur(8px)" }}
        className="border-b border-white/10 px-4 py-3"
      >
        <div className="text-[11px] text-text-tertiary mb-2">DEV · 결과표 미리보기 (실제 컴포넌트 · mock 5명)</div>
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {people.map((x, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setP(i)}
              className={`shrink-0 rounded-xl px-3 py-2 text-[12.5px] font-semibold transition ${
                i === p ? "bg-white/15 text-text-primary" : "bg-white/[0.05] text-text-secondary"
              }`}
            >
              {x.sub}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          {(["wealth", "marriage"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSvc(k)}
              className={`flex-1 rounded-xl py-2 text-[13px] font-bold transition ${
                svc === k ? "bg-white/15 text-text-primary" : "bg-white/[0.05] text-text-secondary"
              }`}
            >
              {k === "wealth" ? "재물운" : "결혼운"}
            </button>
          ))}
        </div>
      </div>

      {api ? (
        svc === "wealth" ? (
          <WealthResultBody data={api as any} result={api.result} router={router} />
        ) : (
          <MarriageResultBody data={api as any} result={api.result} router={router} />
        )
      ) : (
        <div className="px-6 py-16 text-center text-text-secondary">데이터 없음</div>
      )}
    </div>
  );
}
