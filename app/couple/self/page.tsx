"use client";

// couple 자체입력(A) — 대표사주가 없는 사람의 정식 경로.
// ★결혼운 self(app/marriage/self/page.tsx)와 같이 공용 SajuInputFlow 를 그대로 쓴다.
//   A 를 이 흐름으로 받아야 서버의 normalizeSelfInput·buildInputHash 와 정규화가 일치한다.
//   다른 폼으로 받으면 같은 사람인데 해시가 갈라져 중복 차감이 난다.
//
// 관계·직업·핵심이슈 질문은 skipQuestions 로 제외한다 — couple 판정에 쓰이지 않고,
// 서버가 default 로 채우므로 해시 일치에 문제가 없다(marriage self 와 동일 판단).

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import SajuInputFlow from "@/components/saju-input/SajuInputFlow";

export default function CoupleSelfPage() {
  const router = useRouter();
  const handleComplete = useCallback(() => {
    router.push("/couple/partner");
  }, [router]);

  return (
    <SajuInputFlow
      onComplete={handleComplete}
      callbackUrl="/couple/self"
      backUrl="/couple"
      trackName="couple"
      skipQuestions={["relationshipStatus", "employmentStatus", "coreFearAxis"]}
      submitLabel="다음 — 상대 정보"
    />
  );
}
