// 🚨 DEV ONLY — 펫 결과 화면 리디자인 검증 (prod 404). mock 데이터로 본체 렌더.
import { notFound } from "next/navigation";
import { PetResultBody } from "@/app/pet/result/PetResultClient";
import { MOCK_PET_DOG_A, MOCK_PET_CAT_B } from "@/lib/mockPetResult";

export default function DevPetResultUiPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const cases = [
    { label: "개 · A등급 · 일러스트 O", data: MOCK_PET_DOG_A },
    { label: "고양이 · B등급 · 일러스트 X", data: MOCK_PET_CAT_B },
  ];

  return (
    <div className="min-h-screen bg-background-primary">
      {cases.map((c) => (
        <div key={c.data.id}>
          <div className="max-w-[640px] mx-auto px-5 pt-6 text-caption text-text-tertiary">▼ {c.label}</div>
          <PetResultBody data={c.data} />
        </div>
      ))}
    </div>
  );
}
