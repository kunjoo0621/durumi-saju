"use client";

// couple 진입 화면 — app/marriage/MarriageEntryClient.tsx 2-경로 패턴 미러.
//
// ★두 경로가 **둘 다 정식**이다(운영자 지시 2026-09-04).
//   couple 만 보러 온 사람이 반드시 있으므로, 대표사주가 없는 경로를 곁다리로 두면 안 된다.
//   · 대표사주 있음 → 내 건 그대로 쓰고 상대만 입력
//   · 대표사주 없음 → 두 사람 사주를 다 받는다
//
// ★로그인을 여기서 강제하지 않는다(marriage 와 동일). 설명은 누구나 보고,
//   로그인은 사주 입력 제출 시점에만 요구한다.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowsLeftRight, Handshake, CalendarCheck } from "@phosphor-icons/react";

import Header from "@/components/layout/Header";
import { SkeletonBar } from "@/components/loading";
import { COUPLE_COST } from "@/lib/constants/coins";

// couple 이 실제로 짚어주는 것 — 1인 상품이 구조적으로 낼 수 없는 값만 적는다.
// (결혼운과 뭐가 다르냐는 질문에 답이 안 되면 20알을 받을 근거가 없다)
const COUPLE_VALUES = [
  {
    Icon: ArrowsLeftRight,
    title: "같은 상황에서 둘이 어떻게 갈리는지",
    desc: "혼자 보는 사주는 상대를 상상으로 그려. 여긴 상대 사주가 실제로 들어가서, 같은 일이 생겼을 때 둘이 어떻게 다르게 반응하는지를 짚어.",
  },
  {
    Icon: Handshake,
    title: "부딪히는 자리와 붙는 자리",
    desc: "두 사람 여덟 글자를 다 맞대봐. 집안·사회·부부·말년 어느 자리에서 붙고 어디서 부딪히는지 자리별로 나눠서 봐.",
  },
  {
    Icon: CalendarCheck,
    title: "둘 다 열리는 해",
    desc: "내 좋은 때만 보는 게 아니라, 두 사람 흐름이 겹치는 해를 찾아. 이건 혼자 보는 사주로는 못 나오는 값이야.",
  },
] as const;

export default function CoupleEntryClient() {
  const router = useRouter();
  const { status } = useSession();
  const isAuthed = status === "authenticated";

  const [hasPrimary, setHasPrimary] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isAuthed) {
      setHasPrimary(false);
      return;
    }
    let alive = true;
    (async () => {
      try {
        // 대표사주 유무만 확인한다(결혼운 from-primary 재사용 — 원국 계산까지 하지만
        // 여기서는 200/404 여부만 본다).
        const res = await fetch("/api/marriage/from-primary");
        if (alive) setHasPrimary(res.ok);
      } catch {
        if (alive) setHasPrimary(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isAuthed]);

  const start = () => {
    // 대표사주가 있으면 내 건 건너뛰고 상대만, 없으면 내 사주부터.
    router.push(hasPrimary ? "/couple/partner" : "/couple/self");
  };

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[440px] bg-background-primary text-text-primary">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-28 left-1/2 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-primary/[0.12] blur-[100px]" />
      </div>

      <Header showBack sticky onBack={() => router.push("/menu")} />

      <main className="relative px-5 pb-40 pt-6">
        <p className="text-[12px] font-medium text-text-tertiary">둘이서 · 심층 판정</p>
        <h1 className="mt-1 font-aggro text-[26px] leading-[1.32] break-keep">
          우리, 결혼해도 되는 사주일까
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-text-secondary break-keep">
          두 사람 사주를 나란히 세워서 봐. 한 사람만 보는 검사로는 안 나오는 것들이 있거든.
        </p>

        <div className="mt-9 space-y-5">
          {COUPLE_VALUES.map(({ Icon, title, desc }) => (
            <div key={title} className="flex gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <Icon size={22} weight="duotone" className="text-primary" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <h3 className="text-[16px] font-bold leading-snug text-text-primary break-keep">{title}</h3>
                <p className="mt-1 text-[14px] leading-relaxed text-text-secondary break-keep">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-2 rounded-2xl border border-white/5 bg-background-secondary px-5 py-4">
          <p className="text-[13px] leading-relaxed text-text-tertiary break-keep">
            상대 태어난 시간은 몰라도 괜찮아.{" "}
            <span className="font-medium text-text-secondary">모르면 모른다고 표시하고</span>, 그 자리에서
            나오는 얘기는 단정하지 않아.
          </p>
          <p className="text-[13px] leading-relaxed text-text-tertiary break-keep">
            판정은 &ldquo;결혼해라 / 하지 마라&rdquo;가 아니라{" "}
            <span className="font-medium text-text-secondary">어떤 결의 관계인지</span>까지야.
          </p>
        </div>

        {/* 어느 경로로 들어갈지 미리 알려준다 — 두 경로 다 정식이다 */}
        <div className="mt-6">
          {hasPrimary === null && isAuthed ? (
            <SkeletonBar className="h-4 w-48" />
          ) : hasPrimary ? (
            <p className="text-[13px] text-text-tertiary break-keep">
              네 사주는 저번에 넣은 걸 그대로 쓸게. 상대 정보만 받으면 돼.
            </p>
          ) : (
            <p className="text-[13px] text-text-tertiary break-keep">
              두 사람 사주를 차례로 받을게. 네 것부터 넣고, 그다음 상대 정보를 넣으면 돼.
            </p>
          )}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 mx-auto max-w-[440px] bg-gradient-to-t from-background-primary via-background-primary to-transparent px-5 pb-5 pt-8">
        <button
          type="button"
          onClick={start}
          className="w-full rounded-2xl bg-primary py-4 text-[16px] font-bold text-white transition active:scale-[0.99]"
        >
          시작하기
        </button>
        <p className="mt-2.5 text-center text-[12px] text-text-tertiary">
          미리보기까지 무료 · 판정은 {COUPLE_COST}알
        </p>
      </div>
    </div>
  );
}
