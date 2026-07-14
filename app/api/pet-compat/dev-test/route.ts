// 🚨 DEV ONLY — 인증 우회 테스트 엔드포인트
// NODE_ENV=production이면 404. 운영에 노출되지 않음.
// 펫 궁합 풀 파이프라인 (사주 계산 + 신호 추출 + 점수 + LLM) 실행해서 결과 반환.
// 일러스트는 스킵 (Storage 버킷 필요).

import { NextRequest, NextResponse } from "next/server";
import { calculateSaju, enrichSajuData, formatEnrichedSajuText } from "@/lib/utils/saju";
import { calculatePetEnrichedSaju, extractPetCompatSignals, buildPetSajuText } from "@/lib/pet-compat-saju";
import { computePetCompatScores } from "@/lib/pet-compat-scoring";
import { runPetCompatAnalysis } from "@/lib/pet-compat";
import type { PetInput, OwnerInput } from "@/lib/pet-compat";

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const body = await request.json() as { owner: OwnerInput; pet: PetInput };
    const { owner, pet } = body;

    // 1. 보호자 사주
    const ownerSajuData = await calculateSaju(
      Number(owner.birthYear), Number(owner.birthMonth), Number(owner.birthDay),
      owner.unknownBirthTime ? undefined : Number(owner.birthHour || 12),
      owner.unknownBirthTime ? undefined : Number(owner.birthMinute || 0),
      { birthLocation: owner.birthLocation },
    );
    if (!ownerSajuData) {
      return NextResponse.json({ error: "보호자 사주 계산 실패" }, { status: 500 });
    }
    const ownerEnriched = enrichSajuData(ownerSajuData, { isTimeUnknown: Boolean(owner.unknownBirthTime) });
    const ownerSajuText = formatEnrichedSajuText(ownerEnriched);

    // 2. 펫 사주
    const petCalc = await calculatePetEnrichedSaju(pet);
    const petSajuText = buildPetSajuText(pet, petCalc.enriched, petCalc.reliability, petCalc.note);

    // 3. 신호 + 점수
    const signals = extractPetCompatSignals(ownerEnriched, petCalc.enriched, pet);
    const scores = computePetCompatScores(signals);

    // 4. LLM
    const startedAt = Date.now();
    const llmResult = await runPetCompatAnalysis({
      owner, pet, ownerSajuText, petSajuText, precomputedScores: scores, signals,
    });
    const elapsedMs = Date.now() - startedAt;

    if (!llmResult.ok) {
      return NextResponse.json({ error: llmResult.error }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      elapsedMs,
      ownerSummary: {
        dayPillar: ownerEnriched.pillars.day,
        dayMaster: ownerEnriched.dayMaster.korean,
        strength: ownerEnriched.strength?.result,
        tenStars: ownerEnriched.tenStars,
      },
      petSummary: petCalc.enriched ? {
        reliability: petCalc.reliability,
        yearPillar: petCalc.enriched.pillars.year,
        dayPillar: petCalc.enriched.pillars.day,
        dayMaster: petCalc.enriched.dayMaster.korean,
        strength: petCalc.enriched.strength?.result,
        tenStars: petCalc.enriched.tenStars,
      } : { reliability: petCalc.reliability, note: petCalc.note },
      signals,
      scores,
      result: llmResult.result,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unexpected" }, { status: 500 });
  }
}
