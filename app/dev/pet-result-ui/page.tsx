// 🚨 DEV ONLY — 펫 결과 화면 리디자인 검증 (prod 404). mock 데이터로 본체 렌더.
import { notFound } from "next/navigation";
import { PetResultBody } from "@/app/pet/result/PetResultClient";
import { MOCK_PET_DOG_A, MOCK_PET_CAT_B } from "@/lib/mockPetResult";
import type { PetResultData } from "@/lib/mockPetResult";

// tier3(추정)·tier4(가족 된 날 기준) spec 칩 파싱 검증용 케이스
const MOCK_PET_TIER3: PetResultData = {
  ...MOCK_PET_CAT_B,
  id: "mock-tier3",
  full_result: {
    ...MOCK_PET_CAT_B.full_result,
    manual: { ...MOCK_PET_CAT_B.full_result.manual, spec: "약 5세, 코숏, 巳(뱀)띠 火 기운 (추정)" },
  },
  pet: { ...MOCK_PET_CAT_B.pet, birth_tier: 3 },
};

const MOCK_PET_TIER4: PetResultData = {
  ...MOCK_PET_CAT_B,
  id: "mock-tier4",
  full_result: {
    ...MOCK_PET_CAT_B.full_result,
    manual: { ...MOCK_PET_CAT_B.full_result.manual, spec: "나이 미상, 믹스, (띠 미상, 가족 된 날 기준)" },
    petVerdictTitle: "",
  },
  pet: { ...MOCK_PET_CAT_B.pet, birth_tier: 4 },
};

export default async function DevPetResultUiPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const cases: Array<{ key: string; label: string; data: PetResultData; variant?: "own" | "share" }> = [
    { key: "own-dog", label: "개 · A등급 · 일러스트 O · own", data: MOCK_PET_DOG_A },
    { key: "own-cat", label: "고양이 · B등급 · 일러스트 X · own", data: MOCK_PET_CAT_B },
    { key: "share", label: "개 · A등급 · SHARE (CTA 1개)", data: MOCK_PET_DOG_A, variant: "share" },
    { key: "tier3", label: "tier3 · spec '(추정)' 칩 검증", data: MOCK_PET_TIER3 },
    { key: "tier4", label: "tier4 · spec '(띠 미상, 가족 된 날 기준)' 칩 검증", data: MOCK_PET_TIER4 },
  ];

  // ?case=<key> 이면 fixed footer 겹침 없이 단일 케이스만 렌더 (스크린샷 검증용)
  const { case: only } = await searchParams;
  const shown = only ? cases.filter((c) => c.key === only) : cases;

  return (
    <div className="min-h-screen bg-background-primary">
      {shown.map((c) => (
        <div key={`${c.key}`}>
          <div className="max-w-[640px] mx-auto px-5 pt-6 text-caption text-text-tertiary">▼ {c.label}</div>
          <PetResultBody data={c.data} variant={c.variant} />
        </div>
      ))}
    </div>
  );
}
