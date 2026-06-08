"use client";

// 반려동물 궁합 입력 폼 — /start (사주) + /battle/input 와 동일 디자인 토큰
// 같은 컴포넌트 사용 → 한 곳 고치면 다 같이 바뀜
// 펫 고유 색은 메뉴 카드/결과 페이지에서만 / 입력 폼은 사주·배틀과 동일

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

const CALENDAR_OPTIONS = [
  { label: "양력", value: "solar" as const },
  { label: "음력", value: "lunar" as const },
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

type StepId =
  | "selectMode"
  | "ownerName" | "ownerBirth" | "ownerLocation" | "ownerGender"
  | "petName" | "petSpecies" | "petBirth" | "petPhoto" | "petOptional" | "confirm";

const STEPS_NEW: StepId[] = [
  "selectMode", "ownerName", "ownerBirth", "ownerLocation", "ownerGender",
  "petName", "petSpecies", "petBirth", "petPhoto", "petOptional", "confirm",
];

const STEPS_EXISTING: StepId[] = [
  "selectMode", "petName", "petSpecies", "petBirth", "petPhoto", "petOptional", "confirm",
];

const STEP_TITLE: Record<StepId, string> = {
  selectMode: "네 사주부터 확인할게",
  ownerName: "네 이름이 뭐야?",
  ownerBirth: "언제 태어났어?",
  ownerLocation: "어디서 태어났어?",
  ownerGender: "성별은?",
  petName: "우리 아이 이름이 뭐야?",
  petSpecies: "어떤 동물이야?",
  petBirth: "생일 정보 알려줘",
  petPhoto: "사진 한 장 넣어줄래?",
  petOptional: "알면 더 정확해져",
  confirm: "이대로 분석할게",
};

// ────────────────────────────────────────────────────────
// 메인
// ────────────────────────────────────────────────────────

export default function PetInputPage() {
  const router = useRouter();
  const { status } = useSession();
  const owner = usePetCompatOwner();
  const pet = usePetCompatPet();
  const step = usePetCompatStep();
  const ownerMode = usePetCompatStore((s) => s.ownerMode);
  const actions = usePetCompatActions();

  const [hydrated, setHydrated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loadingMySaju, setLoadingMySaju] = useState(false);
  const [mySajuError, setMySajuError] = useState("");
  const [birthDateDisplay, setBirthDateDisplay] = useState("");
  const [birthTimeDisplay, setBirthTimeDisplay] = useState("");
  const [petBirthDateDisplay, setPetBirthDateDisplay] = useState("");
  const [petAdoptionDateDisplay, setPetAdoptionDateDisplay] = useState("");
  const [birthDateError, setBirthDateError] = useState("");
  const [birthTimeError, setBirthTimeError] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");

  useEffect(() => {
    if (hasPetCompatHydrated()) setHydrated(true);
    const unsub = usePetCompatStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") setShowLoginModal(true);
  }, [status]);

  const steps: StepId[] = ownerMode === "new" ? STEPS_NEW : STEPS_EXISTING;
  const currentStepId = steps[step] ?? "selectMode";
  const totalSteps = steps.length;
  const isLastStep = step === totalSteps - 1;

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const el = e.target;
    setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 400);
  };

  // ────────────────────────────────────────────────────────
  // 핸들러
  // ────────────────────────────────────────────────────────

  const validateBirthDate = (year: string, month: string, day: string): string => {
    if (!year || !month || !day) return "";
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    if (y < 1900 || y > new Date().getFullYear()) return "올바른 연도를 입력해줘";
    if (m < 1 || m > 12) return "월은 1~12 사이여야 해";
    const maxDay = new Date(y, m, 0).getDate();
    if (d < 1 || d > maxDay) return `${m}월은 ${maxDay}일까지만 있어요`;
    return "";
  };

  const validateBirthTime = (hour: string, minute: string): string => {
    if (!hour || !minute) return "";
    const h = Number(hour);
    const min = Number(minute);
    if (h < 0 || h > 23) return "시는 0~23 사이여야 해";
    if (min < 0 || min > 59) return "분은 0~59 사이여야 해";
    return "";
  };

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

  const handleOwnerBirthDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    let formatted = value;
    if (value.length <= 4) formatted = value;
    else if (value.length <= 6) formatted = `${value.slice(0, 4)} / ${value.slice(4)}`;
    else formatted = `${value.slice(0, 4)} / ${value.slice(4, 6)} / ${value.slice(6, 8)}`;
    setBirthDateDisplay(formatted);

    const y = value.slice(0, 4);
    const m = value.slice(4, 6);
    const d = value.slice(6, 8);
    actions.setOwner({ birthYear: y, birthMonth: m, birthDay: d });
    setBirthDateError(y && m && d ? validateBirthDate(y, m, d) : "");
  };

  const handleOwnerBirthTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    let formatted = value;
    if (value.length <= 2) formatted = value;
    else formatted = `${value.slice(0, 2)} : ${value.slice(2, 4)}`;
    setBirthTimeDisplay(formatted);

    const h = value.slice(0, 2);
    const min = value.slice(2, 4);
    actions.setOwner({ birthHour: h, birthMinute: min });
    setBirthTimeError(h && min ? validateBirthTime(h, min) : "");
  };

  const handlePetBirthDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    let formatted = value;
    if (value.length <= 4) formatted = value;
    else if (value.length <= 6) formatted = `${value.slice(0, 4)} / ${value.slice(4)}`;
    else formatted = `${value.slice(0, 4)} / ${value.slice(4, 6)} / ${value.slice(6, 8)}`;
    setPetBirthDateDisplay(formatted);

    if (value.length >= 8) {
      actions.setPet({ birthDate: `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` });
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
      actions.setPet({ adoptionDate: `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` });
    } else {
      actions.setPet({ adoptionDate: "" });
    }
  };

  const handlePhotoUpload = async (file: File) => {
    setPhotoUploading(true);
    setPhotoError("");
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch("/api/pet-compat/upload-photo", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setPhotoError(data?.error || "업로드 실패");
        return;
      }
      actions.setPet({
        photoPath: data.photoPath || "",
        photoUrl: data.photoUrl || "",
      });
    } catch {
      setPhotoError("업로드 중 오류");
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleNext = () => {
    if (isLastStep) {
      router.push("/checkout?type=pet");
    } else {
      actions.setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step === 0) router.push("/menu");
    else actions.setStep(step - 1);
  };

  // ────────────────────────────────────────────────────────
  // 검증
  // ────────────────────────────────────────────────────────

  const canProceed = (): boolean => {
    switch (currentStepId) {
      case "selectMode":
        return false; // selectMode는 inline 버튼으로 진행, 다음 버튼 미사용
      case "ownerName":
        return owner.name.trim().length > 0;
      case "ownerBirth":
        if (!owner.birthYear || !owner.birthMonth || !owner.birthDay) return false;
        if (birthDateError) return false;
        if (!owner.unknownBirthTime && (!owner.birthHour || !owner.birthMinute)) return false;
        if (!owner.unknownBirthTime && birthTimeError) return false;
        return true;
      case "ownerLocation":
        return owner.birthLocation.length > 0;
      case "ownerGender":
        return owner.gender === "male" || owner.gender === "female";
      case "petName":
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
      case "petPhoto":
        return !photoUploading;  // 사진 업로드 중 아니면 진행 OK (사진 없어도 통과)
      case "petOptional":
        return true;
      case "confirm":
        return true;
      default:
        return false;
    }
  };

  // ────────────────────────────────────────────────────────
  // step 렌더링 — 기존 btn-option/btn-option--selected 토큰 사용
  // ────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (currentStepId) {
      case "selectMode":
        return (
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleLoadMySaju}
              disabled={loadingMySaju}
              className="btn-option w-full py-5 px-5 rounded-xl text-left transition-[transform,background-color,color] duration-200 active:scale-[0.98]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[16px] font-bold text-text-primary">기존 사주 결과 가져오기</div>
                  <div className="text-[13px] text-text-secondary mt-1">사주 한 번 봤으면 바로 시작</div>
                </div>
                {loadingMySaju && <ButtonSpinner message="" />}
              </div>
            </button>
            <button
              type="button"
              onClick={() => { actions.setOwnerMode("new"); actions.setStep(1); }}
              className="btn-option w-full py-5 px-5 rounded-xl text-left transition-[transform,background-color,color] duration-200 active:scale-[0.98]"
            >
              <div className="text-[16px] font-bold text-text-primary">새로 입력하기</div>
              <div className="text-[13px] text-text-secondary mt-1">처음이면 사주 정보부터 알려줘</div>
            </button>
            {mySajuError && (
              <p className="mt-2 text-[13px] text-primary text-center">{mySajuError}</p>
            )}
          </div>
        );

      case "ownerName":
        return (
          <div>
            <input
              type="text"
              value={owner.name}
              onChange={(e) => actions.setOwner({ name: e.target.value })}
              placeholder="예: 두루미"
              className="w-full text-[15px] h-[52px]"
              onFocus={handleInputFocus}
              autoFocus
              aria-label="보호자 이름"
            />
          </div>
        );

      case "ownerBirth":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {CALENDAR_OPTIONS.map((option) => {
                const selected = owner.calendarType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => actions.setOwner({ calendarType: option.value })}
                    className={`h-11 rounded-xl text-[15px] font-semibold transition-colors ${
                      selected
                        ? "bg-primary text-white"
                        : "bg-background-tertiary text-text-secondary hover:bg-background-tertiary/80"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <div>
              <label htmlFor="ownerBirthDate" className="block text-[12px] text-text-secondary mb-2">생년월일</label>
              <input
                id="ownerBirthDate"
                type="text"
                inputMode="numeric"
                value={birthDateDisplay}
                onChange={handleOwnerBirthDateChange}
                placeholder="예: 1990 / 05 / 15"
                maxLength={14}
                className="w-full text-[15px] h-[52px]"
                onFocus={handleInputFocus}
              />
              {birthDateError && <p className="mt-2 text-[13px] text-primary">{birthDateError}</p>}
            </div>
            {!owner.unknownBirthTime && (
              <div>
                <label htmlFor="ownerBirthTime" className="block text-[12px] text-text-secondary mb-2">태어난 시간</label>
                <input
                  id="ownerBirthTime"
                  type="text"
                  inputMode="numeric"
                  value={birthTimeDisplay}
                  onChange={handleOwnerBirthTimeChange}
                  placeholder="예: 09 : 30"
                  maxLength={7}
                  className="w-full text-[15px] h-[52px]"
                  onFocus={handleInputFocus}
                />
                {birthTimeError && <p className="mt-2 text-[13px] text-primary">{birthTimeError}</p>}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                actions.setOwner({
                  unknownBirthTime: !owner.unknownBirthTime,
                  birthHour: "",
                  birthMinute: "",
                });
                setBirthTimeDisplay("");
                setBirthTimeError("");
              }}
              className={`btn-option w-full py-3.5 rounded-xl text-button-sm active:scale-[0.98] transition-[transform,background-color,color] duration-200 ${owner.unknownBirthTime ? "btn-option--selected" : ""}`}
            >
              {owner.unknownBirthTime ? "✓ 태어난 시간을 몰라요" : "태어난 시간을 몰라요"}
            </button>
          </div>
        );

      case "ownerLocation":
        return (
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="출생 지역">
            {LOCATIONS.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => actions.setOwner({ birthLocation: loc })}
                className={`btn-option py-3 px-3 rounded-xl text-button-sm transition-[transform,background-color,color] duration-200 active:scale-[0.98] ${
                  owner.birthLocation === loc ? "btn-option--selected shadow-[0_0_0_1px_rgba(255,107,107,0.2)]" : ""
                }`}
              >
                {owner.birthLocation === loc && <span className="mr-1">✓</span>}{loc}
              </button>
            ))}
          </div>
        );

      case "ownerGender":
        return (
          <div className="space-y-3" role="radiogroup" aria-label="성별">
            {[{ v: "male", l: "남성" }, { v: "female", l: "여성" }].map((g) => (
              <button
                key={g.v}
                type="button"
                onClick={() => actions.setOwner({ gender: g.v as "male" | "female" })}
                className={`btn-option w-full py-4 rounded-xl text-button-md transition-[transform,background-color,color] duration-200 active:scale-[0.98] ${
                  owner.gender === g.v ? "btn-option--selected shadow-[0_0_0_1px_rgba(255,107,107,0.2)]" : ""
                }`}
              >
                {owner.gender === g.v && <span className="mr-2">✓</span>}{g.l}
              </button>
            ))}
          </div>
        );

      case "petName":
        return (
          <div>
            <input
              type="text"
              value={pet.name}
              onChange={(e) => actions.setPet({ name: e.target.value })}
              placeholder="예: 콩이, 미오, 감자"
              className="w-full text-[15px] h-[52px]"
              onFocus={handleInputFocus}
              autoFocus
              aria-label="반려동물 이름"
            />
          </div>
        );

      case "petSpecies":
        return (
          <div className="space-y-3" role="radiogroup" aria-label="종">
            {[{ v: "dog", l: "강아지" }, { v: "cat", l: "고양이" }].map((s) => (
              <button
                key={s.v}
                type="button"
                onClick={() => actions.setPet({ species: s.v as "dog" | "cat" })}
                className={`btn-option w-full py-4 rounded-xl text-button-md transition-[transform,background-color,color] duration-200 active:scale-[0.98] ${
                  pet.species === s.v ? "btn-option--selected shadow-[0_0_0_1px_rgba(255,107,107,0.2)]" : ""
                }`}
              >
                {pet.species === s.v && <span className="mr-2">✓</span>}{s.l}
              </button>
            ))}
          </div>
        );

      case "petBirth":
        return (
          <div className="space-y-4">
            <p className="text-center text-[13px] text-text-secondary">
              정확할수록 더 깊이 분석돼. 모르면 모르는 대로 OK
            </p>
            <div className="space-y-2">
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
                  className={`btn-option w-full py-3.5 px-4 rounded-xl text-left transition-[transform,background-color,color] duration-200 active:scale-[0.98] ${
                    pet.birthTier === opt.tier ? "btn-option--selected shadow-[0_0_0_1px_rgba(255,107,107,0.2)]" : ""
                  }`}
                >
                  <div className="text-[14px] font-semibold">
                    {pet.birthTier === opt.tier && "✓ "}{opt.label}
                  </div>
                  <div className="text-[12px] text-text-secondary mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>

            {pet.birthTier === 1 && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-[12px] text-text-secondary mb-2">생년월일</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={petBirthDateDisplay}
                    onChange={handlePetBirthDateChange}
                    placeholder="예: 2021 / 03 / 15"
                    maxLength={14}
                    className="w-full text-[15px] h-[52px]"
                    onFocus={handleInputFocus}
                  />
                </div>
                <div>
                  <label className="block text-[12px] text-text-secondary mb-2">태어난 시간</label>
                  <input
                    type="text"
                    value={pet.birthTime}
                    onChange={(e) => actions.setPet({ birthTime: e.target.value })}
                    placeholder="예: 14:30"
                    maxLength={5}
                    className="w-full text-[15px] h-[52px]"
                    onFocus={handleInputFocus}
                  />
                </div>
              </div>
            )}

            {pet.birthTier === 2 && (
              <div className="pt-2">
                <label className="block text-[12px] text-text-secondary mb-2">생년월일</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={petBirthDateDisplay}
                  onChange={handlePetBirthDateChange}
                  placeholder="예: 2021 / 03 / 15"
                  maxLength={14}
                  className="w-full text-[15px] h-[52px]"
                  onFocus={handleInputFocus}
                />
              </div>
            )}

            {pet.birthTier === 3 && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[12px] text-text-secondary mb-2">추정 연도</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={pet.birthYearEstimated}
                    onChange={(e) => actions.setPet({ birthYearEstimated: e.target.value.replace(/[^0-9]/g, "").slice(0, 4) })}
                    placeholder="2022"
                    maxLength={4}
                    className="w-full text-[15px] h-[52px]"
                    onFocus={handleInputFocus}
                  />
                </div>
                <div>
                  <label className="block text-[12px] text-text-secondary mb-2">추정 월 (선택)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={pet.birthMonthEstimated}
                    onChange={(e) => actions.setPet({ birthMonthEstimated: e.target.value.replace(/[^0-9]/g, "").slice(0, 2) })}
                    placeholder="6"
                    maxLength={2}
                    className="w-full text-[15px] h-[52px]"
                    onFocus={handleInputFocus}
                  />
                </div>
              </div>
            )}

            {pet.birthTier === 4 && (
              <div className="pt-2">
                <label className="block text-[12px] text-text-secondary mb-2">가족 된 날</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={petAdoptionDateDisplay}
                  onChange={handlePetAdoptionDateChange}
                  placeholder="예: 2024 / 11 / 20"
                  maxLength={14}
                  className="w-full text-[15px] h-[52px]"
                  onFocus={handleInputFocus}
                />
                <p className="text-[12px] text-text-secondary mt-2">
                  정식 생일이 아니라 신뢰도 낮음. 큰 흐름만 분석돼.
                </p>
              </div>
            )}
          </div>
        );

      case "petPhoto":
        return (
          <div className="space-y-4">
            <p className="text-center text-[13px] text-text-secondary">
              사진 올리면 결과 카드에 {pet.name}만의 일러스트가 박혀. 안 올려도 진행 OK.
            </p>

            {pet.photoUrl ? (
              <div className="space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pet.photoUrl}
                  alt={pet.name}
                  className="w-full aspect-square object-cover rounded-2xl bg-background-tertiary"
                />
                <button
                  type="button"
                  onClick={() => actions.setPet({ photoPath: "", photoUrl: "" })}
                  className="btn-option w-full py-3.5 rounded-xl text-button-sm active:scale-[0.98] transition-[transform,background-color,color] duration-200"
                >
                  다시 올리기
                </button>
              </div>
            ) : (
              <label className={`block btn-option w-full py-6 rounded-xl text-center cursor-pointer transition-[transform,background-color,color] duration-200 active:scale-[0.98] ${photoUploading ? "opacity-60" : ""}`}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={photoUploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoUpload(file);
                  }}
                />
                <div className="text-[14px] text-text-secondary mb-1">
                  {photoUploading ? "업로드 중..." : "📷 사진 선택"}
                </div>
                <div className="text-[12px] text-text-tertiary">jpg / png / webp · 5MB 이하</div>
              </label>
            )}

            {photoError && (
              <p className="text-center text-[13px] text-primary">{photoError}</p>
            )}
          </div>
        );

      case "petOptional": {
        const breeds = pet.species === "cat" ? CAT_BREEDS : DOG_BREEDS;
        return (
          <div className="space-y-6">
            <p className="text-center text-[13px] text-text-secondary">
              전부 옵션이야. 몰라도 넘어가
            </p>

            <div>
              <div className="text-[12px] text-text-secondary mb-2">성별</div>
              <div className="grid grid-cols-3 gap-2">
                {[{ v: "male", l: "수컷" }, { v: "female", l: "암컷" }, { v: "unknown", l: "모름" }].map((g) => (
                  <button
                    key={g.v}
                    type="button"
                    onClick={() => actions.setPet({ gender: g.v as "male" | "female" | "unknown" })}
                    className={`btn-option py-3 px-3 rounded-xl text-button-sm transition-[transform,background-color,color] duration-200 active:scale-[0.98] ${
                      pet.gender === g.v ? "btn-option--selected shadow-[0_0_0_1px_rgba(255,107,107,0.2)]" : ""
                    }`}
                  >
                    {g.l}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[12px] text-text-secondary mb-2">품종</div>
              <select
                value={pet.breed}
                onChange={(e) => actions.setPet({ breed: e.target.value })}
                onFocus={handleInputFocus}
                className="w-full text-[15px] h-[52px]"
              >
                <option value="">선택 안 함</option>
                {breeds.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

          </div>
        );
      }

      case "confirm":
        return (
          <div className="space-y-4">
            <div className="bg-background-tertiary rounded-2xl p-5">
              <div className="text-[12px] text-text-secondary mb-2">보호자</div>
              <div className="text-[15px] text-text-primary font-bold">{owner.name}</div>
              <div className="text-[13px] text-text-secondary mt-1">
                {owner.birthYear}.{owner.birthMonth}.{owner.birthDay}
                {!owner.unknownBirthTime && ` ${owner.birthHour}:${owner.birthMinute}`}
                {" · "}{owner.birthLocation}{" · "}{owner.gender === "male" ? "남성" : "여성"}
              </div>
            </div>
            <div className="bg-background-tertiary rounded-2xl p-5">
              <div className="text-[12px] text-text-secondary mb-2">반려동물</div>
              <div className="text-[15px] text-text-primary font-bold">
                {pet.name} <span className="text-[13px] text-text-secondary">({pet.species === "dog" ? "강아지" : "고양이"})</span>
              </div>
              <div className="text-[13px] text-text-secondary mt-1 space-y-0.5">
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
            <p className="text-center text-[13px] text-text-secondary">
              다음 화면에서 결제 후 분석 시작 (10알)
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  // ────────────────────────────────────────────────────────
  // 메인 JSX — /start 와 동일 구조
  // ────────────────────────────────────────────────────────

  if (!hydrated || status === "loading") {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <div className="text-text-secondary text-[14px]">불러오는 중...</div>
      </div>
    );
  }

  const showFooterButton = currentStepId !== "selectMode";

  return (
    <div className="h-[100dvh] bg-background-primary flex flex-col overflow-hidden">
      <Header showBack onBack={handleBack} />

      <main className="flex-1 min-h-0 px-5 pb-6 overflow-y-auto">
        <div className="max-w-[640px] w-full mx-auto pt-10">
          <div>
            <h2 className="text-[24px] font-semibold text-white text-center font-aggro mb-6">
              {STEP_TITLE[currentStepId]}
            </h2>
          </div>
          <div>{renderStep()}</div>
        </div>
      </main>

      <footer
        className="shrink-0 bg-[#0D0D0D] px-5 py-4"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))" }}
      >
        <div className="max-w-[640px] mx-auto space-y-4">
          <div className="flex items-center">
            <span className="text-[14px] text-text-secondary">{step + 1} / {totalSteps}</span>
            <div
              className="ml-3 flex-1 h-1 bg-background-tertiary rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={step + 1}
              aria-valuemin={1}
              aria-valuemax={totalSteps}
            >
              <div
                className="h-full bg-primary rounded-full transition-[width] duration-500 ease-out"
                style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
              />
            </div>
          </div>

          {showFooterButton && (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed()}
              className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold transition-colors duration-200"
            >
              {isLastStep ? "결제하러 가기" : "다음"}
            </button>
          )}
        </div>
      </footer>

      <Modal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        maxWidth="380px"
        ariaLabel="로그인"
      >
        <div className="p-6">
          <h3 className="text-[17px] font-bold text-text-primary text-center mb-2">
            반려동물 궁합을 보려면 로그인이 필요해
          </h3>
          <p className="text-[13px] text-text-secondary text-center mb-6">
            로그인하면 결과가 저장돼
          </p>
          <LoginForm
            callbackUrl="/pet/input"
            onClose={() => setShowLoginModal(false)}
          />
        </div>
      </Modal>
    </div>
  );
}
