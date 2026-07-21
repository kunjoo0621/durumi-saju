"use client";

// 커리어운 자체입력(self) 플로우 — app/wealth/self/page.tsx 미러(관심사 → 상황 4분법 치환).
// 화면 흐름:
//   1) SajuInputFlow(생년월일/지역/성별) — 관계·직업·핵심이슈 질문은 skipQuestions로 제외
//      (서버 normalizeSelfInput이 default로 채우므로 buildInputHash 일치에 문제 없음).
//      제출 시점에 로그인(개인사주와 동일 — SajuInputFlow 내장 LoginForm 모달).
//   2) 상황 4분법 질문 — QuestionStepScaffold + OptionCardGroup(개인사주 select 스텝과 픽셀 동일).
//   3) 선택값을 useCareerStore(persist)에 저장하고 /career/teaser로 이동.
//
// selfInput(생년월일 등)은 useInputStore에 저장돼 있고, teaser가 거기서 읽어 start·analyze에
// 동일하게 넘긴다 — 이 페이지는 selfInput을 직접 API로 보내지 않는다.

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import SajuInputFlow from "@/components/saju-input/SajuInputFlow";
import QuestionStepScaffold from "@/components/saju-input/QuestionStepScaffold";
import OptionCardGroup from "@/components/saju-input/OptionCardGroup";
import { useCareerStore } from "@/store/useCareerStore";
import type { CareerSituation } from "@/lib/career-facts";

type Phase = "birth" | "situation";

// ★ value는 app/api/career/{start,analyze}/route.ts의 ALLOWED_SITUATION과 정확히 일치해야 한다
//   (화이트리스트 검증에서 400 방지).
const SITUATION_OPTIONS: Array<{ value: CareerSituation; label: string; hint: string }> = [
  { value: "진로 탐색", label: "어떤 일이 맞을까", hint: "내 결에 맞는 길을 찾고 싶어" },
  { value: "현직 성장", label: "지금 여기서 잘 될까", hint: "지금 자리에서 더 크고 싶어" },
  { value: "이직 고민", label: "옮겨야 하나", hint: "움직일지 말지 고민이야" },
  { value: "독립·사업", label: "내 사업 해도 될까", hint: "내 판을 짜고 싶어" },
];

export default function CareerSelfPage() {
  const router = useRouter();
  const situation = useCareerStore((s) => s.situation);
  const setSituation = useCareerStore((s) => s.setSituation);

  const [phase, setPhase] = useState<Phase>("birth");

  // SajuInputFlow 제출 완료(로그인 포함) → 상황 질문으로.
  const handleBirthComplete = useCallback(() => {
    setPhase("situation");
  }, []);

  const handleSituationProceed = useCallback(() => {
    if (!situation) return;
    router.push("/career/teaser");
  }, [situation, router]);

  if (phase === "birth") {
    return (
      <SajuInputFlow
        onComplete={handleBirthComplete}
        callbackUrl="/career/self"
        backUrl="/career"
        trackName="career"
        skipQuestions={["relationshipStatus", "employmentStatus", "coreFearAxis"]}
        submitLabel="다음"
      />
    );
  }

  return (
    <div className="h-[100dvh] bg-background-primary flex flex-col overflow-hidden">
      <QuestionStepScaffold
        title="일, 어떻게 풀고 싶어?"
        onBack={() => setPhase("birth")}
        canProceed={!!situation}
        onProceed={handleSituationProceed}
        ctaLabel="커리어운 미리보기"
      >
        <p className="text-body-2 text-text-secondary text-center mb-6 -mt-2">
          정답은 없어. 지금 가장 궁금한 걸 골라줘.
        </p>
        <OptionCardGroup
          name="지금 커리어 고민"
          options={SITUATION_OPTIONS}
          selected={situation}
          onSelect={(value) => setSituation(value as CareerSituation)}
        />
      </QuestionStepScaffold>
    </div>
  );
}
