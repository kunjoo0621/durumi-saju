"use client";

// 허브 서비스 진입 액션 — app/menu/page.tsx의 handleSajuClick 로직을 그대로 이식.
// 비로그인 동작은 기존 게스트 플로우 보존(saju→/start 등 — 강제 로그인 유도 안 함, 로그인 넛지는 스티키 CTA가 담당).
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useBattleStore } from "@/store/useBattleStore";
import { usePetCompatStore } from "@/store/usePetCompatStore";
import type { HubServiceId } from "./services";

export function useServiceActions() {
  const router = useRouter();
  const { data: session } = useSession();
  const resetBattle = useBattleStore((s) => s.reset);
  const resetPet = usePetCompatStore((s) => s.reset);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState(false);

  const loggedIn = !!session?.user;

  // 사주: 로그인 시 기존 결과 유무로 분기 (menu handleSajuClick 동일)
  const runSaju = useCallback(async () => {
    if (!loggedIn) {
      router.push("/start");
      return;
    }
    if (checking) return;
    setChecking(true);
    setCheckError(false);
    try {
      const res = await fetch("/api/results");
      if (!res.ok) throw new Error();
      const data = await res.json();
      const results = Array.isArray(data.results) ? data.results : [];
      router.push(results.length > 0 ? "/my/results" : "/start");
    } catch {
      setChecking(false);
      setCheckError(true);
    }
  }, [loggedIn, checking, router]);

  const run = useCallback(
    (id: HubServiceId) => {
      switch (id) {
        case "saju":
          void runSaju();
          return;
        case "battle":
          resetBattle();
          router.push("/battle/input");
          return;
        case "pet":
          resetPet();
          router.push("/pet/input");
          return;
        case "today":
          router.push("/today");
          return;
        case "yearly":
          router.push("/yearly");
          return;
      }
    },
    [runSaju, resetBattle, resetPet, router],
  );

  return { run, runSaju, checking, checkError, loggedIn };
}
