"use client";

// 반려동물 궁합 입력 폼 (배틀 input 패턴 — emerald 테마)
// v0.5: 필수(이름/종/생일4티어) + 옵션(품종/성별/중성화/털색)
// 보호자 사주: "기존 재사용" / "새로 입력" 분기

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/layout/Header";
import { ButtonSpinner } from "@/components/loading";
import Modal from "@/components/Modal";
import LoginForm from "@/components/LoginForm";
import {
  usePetCompatStore,
  usePetCompatActions,
  usePetCompatStep,
  usePetCompatPet,
  usePetCompatOwner,
  hasPetCompatHydrated,
} from "@/store/usePetCompatStore";

// ────────────────────────────────────────────────────────
// 상수
// ────────────────────────────────────────────────────────

const LOCATIONS = [
  "서울", "경기", "인천", "강원", "충북", "충남",
  "대전", "세종", "전북", "전남", "광주", "경북",
  "경남", "대구", "울산", "부산", "제주", "해외",
] as const;

const DOG_BREEDS = [
  "푸들", "말티즈", "시츄", "포메라니안", "치와와",
  "요크셔테리어", "말티푸", "비숑프리제", "골든리트리버", "리트리버",
  "시바이누", "진돗개", "비글", "닥스훈트", "페키니즈",
  "스피츠", "슈나우저", "허스키", "보더콜리", "사모예드",
  "믹스견", "기타",
] as const;

const CAT_BREEDS = [
  "코숏", "페르시안", "러시안블루", "스코티시폴드", "먼치킨",
  "메인쿤", "브리티시숏헤어", "노르웨이숲", "샴", "아메리칸숏헤어",
  "벵골", "랙돌", "터키시앙고라", "믹스묘", "기타",
] as const;

const COAT_COLORS = [
  { value: "white", label: "흰색", element: "金", color: "#F5F5F5" },
  { value: "black", label: "검정", element: "水", color: "#2A2A2A" },
  { value: "red", label: "빨강·주황", element: "火", color: "#E07854" },
  { value: "yellow", label: "노랑·황색·갈색", element: "土", color: "#D4A857" },
  { value: "gray", label: "회색·청회색", element: "木", color: "#9CA3AF" },
  { value: "mixed", label: "믹스", element: "혼합", color: "#888" },
  { value: "other", label: "기타", element: "—", color: "#444" },
] as const;

type StepId =
  | "selectMode"
  | "ownerName" | "ownerBirth" | "ownerLocation" | "ownerGender"
  | "petBasic" | "petSpecies" | "petBirth" | "petOptional" | "confirm";

const STEPS_NEW: StepId[] = [
  "selectMode", "ownerName", "ownerBirth", "ownerLocation", "ownerGender",
  "petBasic", "petSpecies", "petBirth", "petOptional", "confirm",
];

const STEPS_EXISTING: StepId[] = [
  "selectMode", "petBasic", "petSpecies", "petBirth", "petOptional", "confirm",
];

// ────────────────────────────────────────────────────────
// 메인
// ────────────────────────────────────────────────────────

export default function PetInputPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const owner = usePetCompatOwner();
  const pet = usePetCompatPet();
  const step = usePetCompatStep();
  const ownerMode = usePetCompatStore((s) => s.ownerMode);
  const actions = usePetCompatActions();

  const [hydrated, setHydrated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loadingMySaju, setLoadingMySaju] = useState(false);
  const [mySajuError, setMySajuError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [birthDateDisplay, setBirthDateDisplay] = useState("");
  const [birthTimeDisplay, setBirthTimeDisplay] = useState("");
  const [petBirthDateDisplay, setPetBirthDateDisplay] = useState("");
  const [petAdoptionDateDisplay, setPetAdoptionDateDisplay] = useState("");

  // hydration
  useEffect(() => {
    if (hasPetCompatHydrated()) setHydrated(true);
    const unsub = usePetCompatStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  // 비로그인 체크
  useEffect(() => {
    if (status === "unauthenticated") {
      setShowLoginModal(true);
    }
  }, [status]);

  const steps: StepId[] = ownerMode === "new" ? STEPS_NEW : STEPS_EXISTING;
  const currentStepId = steps[step] ?? "selectMode";
  const totalSteps = steps.length;
  const isLastStep = step === totalSteps - 1;

  // ────────────────────────────────────────────────────────
  // 핸들러
  // ────────────────────────────────────────────────────────

  const handleLoadMySaju = async () => {
    setLoadingMySaju(true);
    setMySajuError("");
    try {
      const res = await fetch("/api/battle/my-saju");
      if (!res.ok) {
        if (res.status === 401) {
          setShowLoginModal(true);
          return;
        }
        throw new Error("못 불러왔어");
      }
      const data = await res.json();
      if (!data.result) {
        setMySajuError("저장된 사주가 없어. '새로 입력하기'로 진행해줘.");
        return;
      }
      const r = data.result;
      actions.setOwner({
        name: r.name || "",
        birthYear: String(r.birthYear || ""),
        birthMonth: String(r.birthMonth || ""),
        birthDay: String(r.birthDay || ""),
        calendarType: r.calendarType || "solar",
        birthHour: String(r.birthHour || ""),
        birthMinute: String(r.birthMinute || ""),
        birthLocation: r.birthLocation || "",
        gender: r.gender || "",
        unknownBirthTime: r.unknownBirthTime || false,
      });
      actions.setOwnerMode("existing");
      actions.setStep(1);
    } catch {
      setMySajuError("사주를 못 불러왔어.");
    } finally {
      setLoadingMySaju(false);
    }
  };

  const handleNext = () => {
    if (isLastStep) {
      handleSubmit();
    } else {
      actions.setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step === 0) router.push("/menu");
    else actions.setStep(step - 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    // /checkout?type=pet으로 이동 — 거기서 prepayment_sessions 발급
    router.push("/checkout?type=pet");
  };

  // ────────────────────────────────────────────────────────
  // 검증 (canProceed)
  // ────────────────────────────────────────────────────────

  const canProceed = (): boolean => {
    switch (currentStepId) {
      case "selectMode":
        return ownerMode === "new" || ownerMode === "existing";
      case "ownerName":
        return owner.name.trim().length > 0;
      case "ownerBirth":
        if (!owner.birthYear || !owner.birthMonth || !owner.birthDay) return false;
        if (!owner.unknownBirthTime && (!owner.birthHour || !owner.birthMinute)) return false;
        return true;
      case "ownerLocation":
        return owner.birthLocation.length > 0;
      case "ownerGender":
        return owner.gender === "male" || owner.gender === "female";
      case "petBasic":
        return pet.name.trim().length > 0;
      case "petSpecies":
        return pet.species === "dog" || pet.species === "cat";
      case "petBirth":
        if (pet.birthTier === 0) return false;
        if (pet.birthTier === 1) return !!pet.birthDate && !!pet.birthTime;
        if (pet.birthTier === 2) return !!pet.birthDate;
        if (pet.birthTier === 3) return !!pet.birthYearEstimated;
        if (pet.birthTier === 4) return !!pet.adoptionDate;
        return false;
      case "petOptional":
        return true; // 모두 옵션
      case "confirm":
        return true;
      default:
        return false;
    }
  };

  // ────────────────────────────────────────────────────────
  // 입력 헬퍼
  // ────────────────────────────────────────────────────────

  const handleOwnerBirthDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    let formatted = value;
    if (value.length <= 4) formatted = value;
    else if (value.length <= 6) formatted = `${value.slice(0, 4)} / ${value.slice(4)}`;
    else formatted = `${value.slice(0, 4)} / ${value.slice(4, 6)} / ${value.slice(6, 8)}`;
    setBirthDateDisplay(formatted);
    actions.setOwner({
      birthYear: value.slice(0, 4),
      birthMonth: value.slice(4, 6),
      birthDay: value.slice(6, 8),
    });
  };

  const handleOwnerBirthTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    let formatted = value;
    if (value.length <= 2) formatted = value;
    else formatted = `${value.slice(0, 2)} : ${value.slice(2, 4)}`;
    setBirthTimeDisplay(formatted);
    actions.setOwner({
      birthHour: value.slice(0, 2),
      birthMinute: value.slice(2, 4),
    });
  };

  const handlePetBirthDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    let formatted = value;
    if (value.length <= 4) formatted = value;
    else if (value.length <= 6) formatted = `${value.slice(0, 4)} / ${value.slice(4)}`;
    else formatted = `${value.slice(0, 4)} / ${value.slice(4, 6)} / ${value.slice(6, 8)}`;
    setPetBirthDateDisplay(formatted);

    if (value.length >= 8) {
      const y = value.slice(0, 4);
      const m = value.slice(4, 6);
      const d = value.slice(6, 8);
      actions.setPet({ birthDate: `${y}-${m}-${d}` });
    } else {
      actions.setPet({ birthDate: "" });
    }
  };

  const handlePetAdoptionDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    let formatted = value;
    if (value.length <= 4) formatted = value;
    else if (value.length <= 6) formatted = `${value.slice(0, 4)} / ${value.slice(4)}`;
    else formatted = `${value.slice(0, 4)} / ${value.slice(4, 6)} / ${value.slice(6, 8)}`;
    setPetAdoptionDateDisplay(formatted);

    if (value.length >= 8) {
      const y = value.slice(0, 4);
      const m = value.slice(4, 6);
      const d = value.slice(6, 8);
      actions.setPet({ adoptionDate: `${y}-${m}-${d}` });
    } else {
      actions.setPet({ adoptionDate: "" });
    }
  };

  // ────────────────────────────────────────────────────────
  // step 렌더링
  // ────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (currentStepId) {
      case "selectMode":
        return (
          <div>
            <h2 className="text-title-2 text-text-primary text-center font-aggro mb-2">
              먼저 네 사주부터 확인할게
            </h2>
            <p className="text-center text-[14px] text-zinc-400 mb-8">
              반려동물과의 궁합은 네 사주에서 시작돼
            </p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleLoadMySaju}
                disabled={loadingMySaju}
                className="w-full p-5 rounded-2xl border border-zinc-700 bg-[#141414] text-left hover:bg-[#1A1A1A] transition-colors disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[16px] font-bold text-white">기존 사주 결과 가져오기</div>
                    <div className="text-[13px] text-zinc-400 mt-1">사주 분석 한 번 했으면 바로 시작</div>
                  </div>
                  {loadingMySaju && <ButtonSpinner message="" />}
                </div>
              </button>
              <button
                type="button"
                onClick={() => { actions.setOwnerMode("new"); actions.setStep(1); }}
                className="w-full p-5 rounded-2xl border border-zinc-800 bg-[#0F0F0F] text-left hover:bg-[#161616] transition-colors"
              >
                <div className="text-[16px] font-bold text-white">새로 입력하기</div>
                <div className="text-[13px] text-zinc-400 mt-1">처음이면 사주 정보부터 알려줘</div>
              </button>
              {mySajuError && (
                <p className="text-[13px] text-rose-400 text-center mt-2">{mySajuError}</p>
              )}
            </div>
          </div>
        );

      case "ownerName":
        return (
          <div>
            <h2 className="text-title-2 text-text-primary text-center font-aggro mb-6">
              네 이름이 뭐야?
            </h2>
            <input
              type="text"
              value={owner.name}
              onChange={(e) => actions.setOwner({ name: e.target.value })}
              placeholder="예: 신건주"
              className="w-full px-5 py-4 rounded-xl bg-[#141414] border border-zinc-700 text-white text-[16px] focus:outline-none focus:border-emerald-500"
              autoFocus
            />
          </div>
        );

      case "ownerBirth":
        return (
          <div>
            <h2 className="text-title-2 text-text-primary text-center font-aggro mb-6">
              생년월일 + 시간 알려줘
            </h2>
            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => actions.setOwner({ calendarType: "solar" })}
                  className={`flex-1 py-3 rounded-xl text-[14px] ${owner.calendarType === "solar" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}
                >양력</button>
                <button
                  type="button"
                  onClick={() => actions.setOwner({ calendarType: "lunar" })}
                  className={`flex-1 py-3 rounded-xl text-[14px] ${owner.calendarType === "lunar" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}
                >음력</button>
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={birthDateDisplay}
                onChange={handleOwnerBirthDateChange}
                placeholder="YYYY / MM / DD"
                className="w-full px-5 py-4 rounded-xl bg-[#141414] border border-zinc-700 text-white text-[16px] focus:outline-none focus:border-emerald-500"
                maxLength={16}
              />
              <div>
                <label className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    checked={owner.unknownBirthTime}
                    onChange={(e) => actions.setOwner({ unknownBirthTime: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500"
                  />
                  <span className="text-[14px] text-zinc-300">출생 시간 모름</span>
                </label>
                {!owner.unknownBirthTime && (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={birthTimeDisplay}
                    onChange={handleOwnerBirthTimeChange}
                    placeholder="HH : MM (24시간)"
                    className="w-full px-5 py-4 rounded-xl bg-[#141414] border border-zinc-700 text-white text-[16px] focus:outline-none focus:border-emerald-500"
                    maxLength={7}
                  />
                )}
              </div>
            </div>
          </div>
        );

      case "ownerLocation":
        return (
          <div>
            <h2 className="text-title-2 text-text-primary text-center font-aggro mb-6">
              어디서 태어났어?
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {LOCATIONS.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => actions.setOwner({ birthLocation: loc })}
                  className={`py-4 rounded-xl text-[14px] ${owner.birthLocation === loc ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40" : "bg-zinc-900 text-zinc-300 border border-zinc-800"}`}
                >
                  {owner.birthLocation === loc && <span className="mr-1">✓</span>}{loc}
                </button>
              ))}
            </div>
          </div>
        );

      case "ownerGender":
        return (
          <div>
            <h2 className="text-title-2 text-text-primary text-center font-aggro mb-6">
              성별이 어떻게 돼?
            </h2>
            <div className="space-y-3">
              {[{ v: "male", l: "남성" }, { v: "female", l: "여성" }].map((g) => (
                <button
                  key={g.v}
                  type="button"
                  onClick={() => actions.setOwner({ gender: g.v as "male" | "female" })}
                  className={`w-full py-4 rounded-xl text-[15px] ${owner.gender === g.v ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40" : "bg-zinc-900 text-zinc-300 border border-zinc-800"}`}
                >
                  {owner.gender === g.v && <span className="mr-2">✓</span>}{g.l}
                </button>
              ))}
            </div>
          </div>
        );

      case "petBasic":
        return (
          <div>
            <h2 className="text-title-2 text-text-primary text-center font-aggro mb-6">
              우리 아이 이름이 뭐야?
            </h2>
            <input
              type="text"
              value={pet.name}
              onChange={(e) => actions.setPet({ name: e.target.value })}
              placeholder="예: 콩이, 미오, 감자"
              className="w-full px-5 py-4 rounded-xl bg-[#141414] border border-zinc-700 text-white text-[16px] focus:outline-none focus:border-emerald-500"
              autoFocus
            />
          </div>
        );

      case "petSpecies":
        return (
          <div>
            <h2 className="text-title-2 text-text-primary text-center font-aggro mb-6">
              {pet.name}는 어떤 동물이야?
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => actions.setPet({ species: "dog" })}
                className={`py-8 rounded-2xl text-[18px] font-bold ${pet.species === "dog" ? "bg-emerald-500/15 text-emerald-400 border-2 border-emerald-500/50" : "bg-zinc-900 text-zinc-300 border-2 border-zinc-800"}`}
              >
                🐶<br/>강아지
              </button>
              <button
                type="button"
                onClick={() => actions.setPet({ species: "cat" })}
                className={`py-8 rounded-2xl text-[18px] font-bold ${pet.species === "cat" ? "bg-emerald-500/15 text-emerald-400 border-2 border-emerald-500/50" : "bg-zinc-900 text-zinc-300 border-2 border-zinc-800"}`}
              >
                🐱<br/>고양이
              </button>
            </div>
          </div>
        );

      case "petBirth":
        return (
          <div>
            <h2 className="text-title-2 text-text-primary text-center font-aggro mb-2">
              {pet.name} 생일 정보 알려줘
            </h2>
            <p className="text-center text-[13px] text-zinc-400 mb-6">
              정확할수록 더 깊이 분석돼. 모르면 모르는 대로 OK
            </p>

            <div className="space-y-3 mb-6">
              {([
                { tier: 1, label: "정확한 생일+시간 알아", desc: "분양 시 받음" },
                { tier: 2, label: "생일만 알아", desc: "시간은 모름" },
                { tier: 3, label: "추정 월·년만", desc: "보호소·구조" },
                { tier: 4, label: "가족 된 날밖에 몰라", desc: "정식 생일 미상" },
              ] as const).map((opt) => (
                <button
                  key={opt.tier}
                  type="button"
                  onClick={() => actions.setPet({ birthTier: opt.tier })}
                  className={`w-full p-4 rounded-xl text-left ${pet.birthTier === opt.tier ? "bg-emerald-500/15 border border-emerald-500/40" : "bg-zinc-900 border border-zinc-800"}`}
                >
                  <div className={`text-[15px] font-semibold ${pet.birthTier === opt.tier ? "text-emerald-400" : "text-white"}`}>
                    {pet.birthTier === opt.tier && "✓ "}{opt.label}
                  </div>
                  <div className="text-[12px] text-zinc-500 mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>

            {pet.birthTier === 1 && (
              <div className="space-y-3">
                <input
                  type="text"
                  inputMode="numeric"
                  value={petBirthDateDisplay}
                  onChange={handlePetBirthDateChange}
                  placeholder="YYYY / MM / DD"
                  className="w-full px-5 py-4 rounded-xl bg-[#141414] border border-zinc-700 text-white text-[16px] focus:outline-none focus:border-emerald-500"
                  maxLength={16}
                />
                <input
                  type="text"
                  value={pet.birthTime}
                  onChange={(e) => actions.setPet({ birthTime: e.target.value })}
                  placeholder="HH:MM (예: 14:30)"
                  className="w-full px-5 py-4 rounded-xl bg-[#141414] border border-zinc-700 text-white text-[16px] focus:outline-none focus:border-emerald-500"
                  maxLength={5}
                />
              </div>
            )}

            {pet.birthTier === 2 && (
              <input
                type="text"
                inputMode="numeric"
                value={petBirthDateDisplay}
                onChange={handlePetBirthDateChange}
                placeholder="YYYY / MM / DD"
                className="w-full px-5 py-4 rounded-xl bg-[#141414] border border-zinc-700 text-white text-[16px] focus:outline-none focus:border-emerald-500"
                maxLength={16}
              />
            )}

            {pet.birthTier === 3 && (
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  inputMode="numeric"
                  value={pet.birthYearEstimated}
                  onChange={(e) => actions.setPet({ birthYearEstimated: e.target.value.replace(/[^0-9]/g, "").slice(0, 4) })}
                  placeholder="추정 연도"
                  className="px-5 py-4 rounded-xl bg-[#141414] border border-zinc-700 text-white text-[16px] focus:outline-none focus:border-emerald-500"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={pet.birthMonthEstimated}
                  onChange={(e) => actions.setPet({ birthMonthEstimated: e.target.value.replace(/[^0-9]/g, "").slice(0, 2) })}
                  placeholder="추정 월 (선택)"
                  className="px-5 py-4 rounded-xl bg-[#141414] border border-zinc-700 text-white text-[16px] focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {pet.birthTier === 4 && (
              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={petAdoptionDateDisplay}
                  onChange={handlePetAdoptionDateChange}
                  placeholder="YYYY / MM / DD (가족 된 날)"
                  className="w-full px-5 py-4 rounded-xl bg-[#141414] border border-zinc-700 text-white text-[16px] focus:outline-none focus:border-emerald-500"
                  maxLength={16}
                />
                <p className="text-[12px] text-zinc-500 mt-2">
                  ※ 정식 생일이 아니라 신뢰도 낮음. 큰 흐름만 분석돼.
                </p>
              </div>
            )}
          </div>
        );

      case "petOptional": {
        const breeds = pet.species === "cat" ? CAT_BREEDS : DOG_BREEDS;
        return (
          <div>
            <h2 className="text-title-2 text-text-primary text-center font-aggro mb-2">
              알면 더 정확해져
            </h2>
            <p className="text-center text-[13px] text-zinc-400 mb-6">
              전부 옵션이야. 몰라도 넘어가
            </p>

            <div className="space-y-5">
              {/* 성별 */}
              <div>
                <div className="text-[13px] text-zinc-400 mb-2">성별</div>
                <div className="grid grid-cols-3 gap-2">
                  {[{ v: "male", l: "수컷" }, { v: "female", l: "암컷" }, { v: "unknown", l: "모름" }].map((g) => (
                    <button
                      key={g.v}
                      type="button"
                      onClick={() => actions.setPet({ gender: g.v as "male" | "female" | "unknown" })}
                      className={`py-3 rounded-xl text-[14px] ${pet.gender === g.v ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40" : "bg-zinc-900 text-zinc-300 border border-zinc-800"}`}
                    >{g.l}</button>
                  ))}
                </div>
              </div>

              {/* 중성화 */}
              <div>
                <div className="text-[13px] text-zinc-400 mb-2">중성화</div>
                <div className="grid grid-cols-3 gap-2">
                  {[{ v: "yes", l: "완료" }, { v: "no", l: "안 함" }, { v: "unknown", l: "모름" }].map((n) => (
                    <button
                      key={n.v}
                      type="button"
                      onClick={() => actions.setPet({ neutered: n.v as "yes" | "no" | "unknown" })}
                      className={`py-3 rounded-xl text-[14px] ${pet.neutered === n.v ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40" : "bg-zinc-900 text-zinc-300 border border-zinc-800"}`}
                    >{n.l}</button>
                  ))}
                </div>
              </div>

              {/* 품종 */}
              <div>
                <div className="text-[13px] text-zinc-400 mb-2">품종</div>
                <select
                  value={pet.breed}
                  onChange={(e) => actions.setPet({ breed: e.target.value })}
                  className="w-full px-5 py-4 rounded-xl bg-[#141414] border border-zinc-700 text-white text-[15px] focus:outline-none focus:border-emerald-500"
                >
                  <option value="">선택 안 함</option>
                  {breeds.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              {/* 털색 */}
              <div>
                <div className="text-[13px] text-zinc-400 mb-2">털색</div>
                <div className="grid grid-cols-2 gap-2">
                  {COAT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => actions.setPet({ coatColor: c.value as typeof pet.coatColor })}
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl text-[13px] text-left ${pet.coatColor === c.value ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40" : "bg-zinc-900 text-zinc-300 border border-zinc-800"}`}
                    >
                      <div className="w-5 h-5 rounded-full border border-zinc-600 shrink-0" style={{ background: c.color }} />
                      <div>
                        <div>{c.label}</div>
                        <div className="text-[10px] opacity-60">{c.element}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      }

      case "confirm":
        return (
          <div>
            <h2 className="text-title-2 text-text-primary text-center font-aggro mb-6">
              이대로 분석할게
            </h2>
            <div className="space-y-4">
              <div className="bg-[#141414] rounded-2xl p-5 border border-zinc-800">
                <div className="text-[12px] text-zinc-500 mb-2">보호자</div>
                <div className="text-[15px] text-white font-bold">{owner.name}</div>
                <div className="text-[13px] text-zinc-400 mt-1">
                  {owner.birthYear}.{owner.birthMonth}.{owner.birthDay}
                  {!owner.unknownBirthTime && ` ${owner.birthHour}:${owner.birthMinute}`}
                  {" · "}{owner.birthLocation}{" · "}{owner.gender === "male" ? "남성" : "여성"}
                </div>
              </div>
              <div className="bg-[#141414] rounded-2xl p-5 border border-emerald-500/30">
                <div className="text-[12px] text-emerald-400 mb-2">반려동물</div>
                <div className="text-[15px] text-white font-bold">
                  {pet.name} <span className="text-[13px] text-zinc-400">({pet.species === "dog" ? "강아지" : "고양이"})</span>
                </div>
                <div className="text-[13px] text-zinc-400 mt-1 space-y-0.5">
                  {pet.breed && <div>품종: {pet.breed}</div>}
                  {pet.gender && (
                    <div>성별: {pet.gender === "male" ? "수컷" : pet.gender === "female" ? "암컷" : "모름"}</div>
                  )}
                  {pet.birthTier === 1 && <div>생일: {pet.birthDate} {pet.birthTime}</div>}
                  {pet.birthTier === 2 && <div>생일: {pet.birthDate} (시 미상)</div>}
                  {pet.birthTier === 3 && <div>추정: {pet.birthYearEstimated}년 {pet.birthMonthEstimated || "?"}월</div>}
                  {pet.birthTier === 4 && <div>가족 된 날: {pet.adoptionDate}</div>}
                </div>
              </div>
              <p className="text-center text-[13px] text-zinc-400 mt-2">
                다음 화면에서 결제 후 분석 시작 (10알)
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ────────────────────────────────────────────────────────
  // 메인 JSX
  // ────────────────────────────────────────────────────────

  if (!hydrated || status === "loading") {
    return (
      <div className="min-h-screen bg-[rgb(var(--c-dark-bg))] flex items-center justify-center">
        <div className="text-zinc-400 text-[14px]">불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-background-primary flex flex-col overflow-hidden">
      <Header showBack onBack={handleBack} />

      <main className="flex-1 min-h-0 px-6 pb-6 overflow-y-auto">
        <div className="max-w-[640px] w-full mx-auto pt-10">
          {renderStep()}
        </div>
      </main>

      <footer
        className="shrink-0 bg-[#0D0D0D] px-6 py-4"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))" }}
      >
        <div className="max-w-[640px] mx-auto space-y-4">
          <div className="flex items-center">
            <span className="text-[14px] text-zinc-400">{step + 1} / {totalSteps}</span>
            <div className="ml-3 flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-[width] duration-500 ease-out"
                style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
              />
            </div>
          </div>
          {currentStepId !== "selectMode" && (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed() || submitting}
              className="w-full h-[54px] rounded-xl text-[15px] font-semibold transition-colors duration-200 bg-emerald-500 text-black hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {submitting ? <ButtonSpinner message="" /> : isLastStep ? "결제하러 가기" : "다음"}
            </button>
          )}
        </div>
      </footer>

      <Modal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)}>
        <LoginForm
          callbackUrl="/pet/input"
          onClose={() => setShowLoginModal(false)}
        />
      </Modal>
    </div>
  );
}
