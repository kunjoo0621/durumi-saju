// 🚨 DEV ONLY — 신살 scoring 수정 전후 분포 재검증용 (LLM/일러스트 없음, 빠름)
// NODE_ENV=production이면 404.
// owner+pet → signals → 점수 2벌(수정본 / 버그본=신살플래그 강제 false) 반환.

import { NextRequest, NextResponse } from "next/server";
import { calculateSaju, enrichSajuData } from "@/lib/utils/saju";
import { calculatePetEnrichedSaju, extractPetCompatSignals } from "@/lib/pet-compat-saju";
import { computePetCompatScores } from "@/lib/pet-compat-scoring";
import type { PetInput, OwnerInput } from "@/lib/pet-compat";

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  try {
    const { owner, pet } = (await request.json()) as { owner: OwnerInput; pet: PetInput };

    const ownerSajuData = await calculateSaju(
      Number(owner.birthYear), Number(owner.birthMonth), Number(owner.birthDay),
      owner.unknownBirthTime ? undefined : Number(owner.birthHour ?? 12),
      owner.unknownBirthTime ? undefined : Number(owner.birthMinute ?? 0),
      { birthLocation: owner.birthLocation },
    );
    if (!ownerSajuData) return NextResponse.json({ error: "owner calc fail" }, { status: 500 });
    const ownerEnriched = enrichSajuData(ownerSajuData, { isTimeUnknown: Boolean(owner.unknownBirthTime) });

    const petCalc = await calculatePetEnrichedSaju(pet);
    const signals = extractPetCompatSignals(ownerEnriched, petCalc.enriched, pet);

    const fixed = computePetCompatScores(signals);
    // 버그본 재현: 신살 플래그 3종 강제 false
    const buggySignals = { ...signals, petHasDohwa: false, petHasYeokma: false, petHasCheonEulGwiin: false };
    const buggy = computePetCompatScores(buggySignals);

    return NextResponse.json({
      reliability: petCalc.reliability,
      hasDohwa: signals.petHasDohwa,
      hasYeokma: signals.petHasYeokma,
      hasCheonEul: signals.petHasCheonEulGwiin,
      fixed: { composite: fixed.composite, grade: fixed.grade, ruler: fixed.ruler, lover: fixed.lover },
      buggy: { composite: buggy.composite, grade: buggy.grade, ruler: buggy.ruler, lover: buggy.lover },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unexpected" }, { status: 500 });
  }
}
