"use client";

// couple 맛보기 생성 — 2인 입력(/battle/input?for=couple)이 끝나면 여기로 온다.
//
// ★입력 화면을 새로 만들지 않고 배틀 것을 그대로 쓴다(운영자 결정 2026-09-04).
//   BattlePlayerInput 의 필드 집합이 InputPayload 와 사실상 같고("isLeapMonth" 제외)
//   "내 사주 재사용" 토글도 이미 있어서, 새로 만들면 2인 입력 화면이 두 벌이 된다.
//   해시는 서버가 **값**으로 계산하므로 어느 화면이 모았는지는 무관하다.
//
// ★윤달은 배틀 폼이 안 받는다 — 건의함 G11 과 같은 자리다(4개 유료 상품 공통).
//   여기서만 따로 받으면 화면이 또 갈라지므로, G11 을 일괄로 다룰 때 함께 고친다.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { FullScreenLoading } from "@/components/loading";
import { useBattlePlayerA, useBattlePlayerB, useBattleStore } from "@/store/useBattleStore";

export default function CoupleTeaserClient() {
  const router = useRouter();
  const playerA = useBattlePlayerA();
  const playerB = useBattlePlayerB();
  const playerAMode = useBattleStore((s) => s.playerAMode);

  const [error, setError] = useState<string | null>(null);
  // ★한 번만 호출한다. 렌더마다 재호출되면 teaser 가 중복 생성된다
  //   (career/teaser 의 2026-07-29 사고와 같은 자리).
  const firedRef = useRef(false);

  const create = useCallback(async () => {
    try {
      const res = await fetch("/api/couple/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // 배틀의 "내 사주 재사용" = 대표사주 경로, "새로 입력" = 자체입력 경로.
          source: playerAMode === "existing" ? "primary" : "self",
          selfInput: playerAMode === "existing" ? undefined : playerA,
          partner: playerB,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "잠시 후 다시 시도해줘.");
        return;
      }
      router.replace(`/couple/result?id=${encodeURIComponent(json.resultId)}`);
    } catch {
      setError("잠시 후 다시 시도해줘.");
    }
  }, [playerA, playerB, playerAMode, router]);

  useEffect(() => {
    if (firedRef.current) return;
    if (!playerB?.birthYear) {
      // 입력을 건너뛰고 직접 들어온 경우 — 입력부터.
      router.replace("/battle/input?for=couple");
      return;
    }
    firedRef.current = true;
    void create();
  }, [playerB, create, router]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background-primary px-6 text-center">
        <p className="text-[15px] text-text-secondary break-keep">{error}</p>
        <button
          type="button"
          onClick={() => router.push("/battle/input?for=couple")}
          className="mt-6 rounded-2xl bg-background-secondary px-5 py-3 text-[14px] text-text-primary"
        >
          다시 입력하기
        </button>
      </div>
    );
  }

  return <FullScreenLoading />;
}
