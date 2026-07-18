"use client";

// 결혼운 자체입력(self) 플로우 — app/today/input/page.tsx의 SajuInputFlow 재사용 패턴 + 관계상태 스텝.
// 화면 흐름:
//   1) SajuInputFlow(생년월일/지역/성별) — 관계·직업·핵심이슈 질문은 skipQuestions로 제외
//      (서버 normalizeSelfInput이 default로 채우므로 buildInputHash 일치에 문제 없음).
//      제출 시점에 로그인(개인사주와 동일 — SajuInputFlow 내장 LoginForm 모달).
//   2) 관계상태 4분법 질문 — QuestionStepScaffold + OptionCardGroup(개인사주 select 스텝과 픽셀 동일).
//   3) 선택값을 useMarriageStore(persist)에 저장하고 /marriage/teaser로 이동.
//
// selfInput(생년월일 등)은 useInputStore에 저장돼 있고, teaser가 거기서 읽어 start·analyze에
// 동일하게 넘긴다 — 이 페이지는 selfInput을 직접 API로 보내지 않는다.

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import SajuInputFlow from "@/components/saju-input/SajuInputFlow";
import QuestionStepScaffold from "@/components/saju-input/QuestionStepScaffold";
import OptionCardGroup from "@/components/saju-input/OptionCardGroup";
import { useMarriageStore } from "@/store/useMarriageStore";
import type { MaritalStatus } from "@/lib/marriage-facts";

type Phase = "birth" | "status";

const STATUS_OPTIONS: Array<{ value: MaritalStatus; label: string; hint: string }> = [
  { value: "솔로", label: "솔로", hint: "지금은 혼자야" },
  { value: "연애중", label: "연애중", hint: "만나는 사람이 있어" },
  { value: "기혼", label: "기혼", hint: "결혼한 상태야" },
  { value: "다시 혼자", label: "다시 혼자", hint: "이혼·사별 등으로 지금은 혼자야" },
];

export default function MarriageSelfPage() {
  const router = useRouter();
  const maritalStatus = useMarriageStore((s) => s.maritalStatus);
  const setMaritalStatus = useMarriageStore((s) => s.setMaritalStatus);

  const [phase, setPhase] = useState<Phase>("birth");

  // SajuInputFlow 제출 완료(로그인 포함) → 관계상태 질문으로.
  const handleBirthComplete = useCallback(() => {
    setPhase("status");
  }, []);

  const handleStatusProceed = useCallback(() => {
    if (!maritalStatus) return;
    router.push("/marriage/teaser");
  }, [maritalStatus, router]);

  if (phase === "birth") {
    return (
      <SajuInputFlow
        onComplete={handleBirthComplete}
        callbackUrl="/marriage/self"
        backUrl="/marriage"
        trackName="marriage"
        skipQuestions={["relationshipStatus", "employmentStatus", "coreFearAxis"]}
        submitLabel="다음"
      />
    );
  }

  return (
    <div className="h-[100dvh] bg-background-primary flex flex-col overflow-hidden">
      <QuestionStepScaffold
        title="지금 상태를 알려줘"
        onBack={() => setPhase("birth")}
        canProceed={!!maritalStatus}
        onProceed={handleStatusProceed}
        ctaLabel="결혼운 미리보기"
      >
        <p className="text-body-2 text-text-secondary text-center mb-6 -mt-2">
          정답은 없어. 지금 있는 그대로 골라줘.
        </p>
        <OptionCardGroup
          name="지금 관계 상태"
          options={STATUS_OPTIONS}
          selected={maritalStatus}
          onSelect={(value) => setMaritalStatus(value as MaritalStatus)}
        />
      </QuestionStepScaffold>
    </div>
  );
}
