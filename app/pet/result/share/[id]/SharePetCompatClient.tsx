"use client";

// 펫 궁합 share 페이지 — 본 결과(PetResultBody)와 동일한 몰입형 스토리 스크롤 재사용.
// variant="share" 로 하단 CTA만 "나도 우리 아이 궁합 보기" 단일 버튼으로 바뀐다.
// 비로그인도 접근 가능.

import { PetResultBody } from "@/app/pet/result/PetResultClient";
import type { PetResultData } from "@/lib/mockPetResult";

export default function SharePetCompatClient({ data }: { data: PetResultData }) {
  return <PetResultBody data={data} variant="share" />;
}
