"use client";

// 재물운 자체입력(self) 플로우 — app/marriage/self/page.tsx 미러(관계상태 → 관심사 치환).
// 화면 흐름:
//   1) SajuInputFlow(생년월일/지역/성별) — 관계·직업·핵심이슈 질문은 skipQuestions로 제외
//      (서버 normalizeSelfInput이 default로 채우므로 buildInputHash 일치에 문제 없음).
//      제출 시점에 로그인(개인사주와 동일 — SajuInputFlow 내장 LoginForm 모달).
//   2) 관심사 4분법 질문 — QuestionStepScaffold + OptionCardGroup(개인사주 select 스텝과 픽셀 동일).
//   3) 선택값을 useWealthStore(persist)에 저장하고 /wealth/teaser로 이동.
//
// selfInput(생년월일 등)은 useInputStore에 저장돼 있고, teaser가 거기서 읽어 start·analyze에
// 동일하게 넘긴다 — 이 페이지는 selfInput을 직접 API로 보내지 않는다.

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import SajuInputFlow from "@/components/saju-input/SajuInputFlow";
import QuestionStepScaffold from "@/components/saju-input/QuestionStepScaffold";
import OptionCardGroup from "@/components/saju-input/OptionCardGroup";
import { useWealthStore } from "@/store/useWealthStore";
import type { WealthInterest } from "@/lib/wealth-facts";

type Phase = "birth" | "interest";

// ★ value는 app/api/wealth/{start,analyze}/route.ts의 ALLOWED_INTEREST와 정확히 일치해야 한다
//   (화이트리스트 검증에서 400 방지).
const INTEREST_OPTIONS: Array<{ value: WealthInterest; label: string; hint: string }> = [
  { value: "목돈·노후 준비", label: "목돈·노후 준비", hint: "안정적으로 모으고 지키고 싶어" },
  { value: "투자로 불리기", label: "투자로 불리기", hint: "굴려서 키우고 싶어" },
  { value: "사업·수입 키우기", label: "사업·수입 키우기", hint: "버는 규모를 키우고 싶어" },
  { value: "지출·빚 관리", label: "지출·빚 관리", hint: "새는 돈을 잡고 싶어" },
];

export default function WealthSelfPage() {
  const router = useRouter();
  const interest = useWealthStore((s) => s.interest);
  const setInterest = useWealthStore((s) => s.setInterest);

  const [phase, setPhase] = useState<Phase>("birth");

  // SajuInputFlow 제출 완료(로그인 포함) → 관심사 질문으로.
  const handleBirthComplete = useCallback(() => {
    setPhase("interest");
  }, []);

  const handleInterestProceed = useCallback(() => {
    if (!interest) return;
    router.push("/wealth/teaser");
  }, [interest, router]);

  if (phase === "birth") {
    return (
      <SajuInputFlow
        onComplete={handleBirthComplete}
        callbackUrl="/wealth/self"
        backUrl="/wealth"
        trackName="wealth"
        skipQuestions={["relationshipStatus", "employmentStatus", "coreFearAxis"]}
        submitLabel="다음"
      />
    );
  }

  return (
    <div className="h-[100dvh] bg-background-primary flex flex-col overflow-hidden">
      <QuestionStepScaffold
        title="돈, 어떻게 벌고 싶어?"
        onBack={() => setPhase("birth")}
        canProceed={!!interest}
        onProceed={handleInterestProceed}
        ctaLabel="재물운 미리보기"
      >
        <p className="text-body-2 text-text-secondary text-center mb-6 -mt-2">
          정답은 없어. 지금 가장 궁금한 걸 골라줘.
        </p>
        <OptionCardGroup
          name="지금 재물 관심사"
          options={INTEREST_OPTIONS}
          selected={interest}
          onSelect={(value) => setInterest(value as WealthInterest)}
        />
      </QuestionStepScaffold>
    </div>
  );
}
