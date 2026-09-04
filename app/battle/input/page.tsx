"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { trackFormStep, trackFormComplete } from "@/lib/analytics";
import Header from "@/components/layout/Header";
import {
  useBattleStore,
  useBattleActions,
  useBattleStep,
  useBattlePlayerA,
  useBattlePlayerB,
  useBattleRelationship,
} from "@/store/useBattleStore";
import type { BattlePlayerInput, RelationshipType } from "@/types/battle";
import { ButtonSpinner } from "@/components/loading";
import Modal from "@/components/Modal";
import LoginForm from "@/components/LoginForm";

const LOCATIONS = [
  "서울", "경기", "인천", "강원", "충북", "충남",
  "대전", "세종", "전북", "전남", "광주", "경북",
  "경남", "대구", "울산", "부산", "제주", "해외",
] as const;

const CALENDAR_OPTIONS = [
  { label: "양력", value: "solar" as const },
  { label: "음력", value: "lunar" as const },
] as const;

const RELATIONSHIP_OPTIONS: Array<{ label: string; value: RelationshipType }> = [
  { label: "연인", value: "lover" },
  { label: "친구", value: "friend" },
  { label: "직장동료", value: "colleague" },
  { label: "가족", value: "family" },
  { label: "기타", value: "other" },
];

type StepId =
  | "selectMode"
  | "myName"
  | "myBirth"
  | "myLocation"
  | "myGender"
  | "relationship"
  | "oppName"
  | "oppBirth"
  | "oppLocation"
  | "oppGender";

const STEPS_NEW: StepId[] = [
  "selectMode", "myName", "myBirth", "myLocation", "myGender",
  "relationship", "oppName", "oppBirth", "oppLocation", "oppGender",
];
const STEPS_EXISTING: StepId[] = [
  "selectMode",
  "relationship", "oppName", "oppBirth", "oppLocation", "oppGender",
];

// ★이 화면은 배틀 전용이 아니다. couple("우리 결혼해도 되는 사주일까")도 같은 2인 입력을 쓴다
//   — 필드 집합이 동일하고(BattlePlayerInput ≒ InputPayload) "내 사주 재사용" 토글도 이미 있다.
//   화면을 한 벌 더 만들면 2인 입력이 두 벌이 되므로, 목적지만 ?for= 로 갈라 준다.
//   ★배틀 동작은 바뀌지 않는다: for 가 없으면 전부 기존 그대로다.
const DESTINATIONS: Record<string, { next: string; form: "battle" | "couple" }> = {
  couple: { next: "/couple/teaser", form: "couple" },
};

export default function BattleInputPage() {
  const router = useRouter();
  // ★useSearchParams 를 쓰지 않는다 — 이 페이지의 정적 프리렌더가 깨진다(빌드 실패로 확인).
  //   목적지는 제출 시점(하이드레이션 이후)에만 필요하므로 location 에서 한 번 읽어 둔다.
  const [destKey, setDestKey] = useState("");
  useEffect(() => {
    setDestKey(new URLSearchParams(window.location.search).get("for") ?? "");
  }, []);
  const dest = DESTINATIONS[destKey] ?? { next: "/teaser?type=battle", form: "battle" as const };
  const step = useBattleStep();
  const playerA = useBattlePlayerA();
  const playerB = useBattlePlayerB();
  const relationshipType = useBattleRelationship();
  const {
    setPlayerA,
    setPlayerAMode,
    setPlayerB,
    setPlayerBField,
    setRelationshipType,
    setStep,
  } = useBattleActions();

  const playerAMode = useBattleStore((s) => s.playerAMode);
  const { status } = useSession();
  // 비로그인 시 selectMode 스킵 → 바로 이름 입력
  useEffect(() => {
    if (status === "unauthenticated" && !playerAMode) {
      setPlayerAMode("new");
      setStep(1); // myName
    }
  }, [status, playerAMode, setPlayerAMode, setStep]);

  const [loadingMySaju, setLoadingMySaju] = useState(false);
  const [mySajuLoaded, setMySajuLoaded] = useState(false);
  const [mySajuError, setMySajuError] = useState("");

  // Birth date display for A (new input)
  const [birthDateDisplayA, setBirthDateDisplayA] = useState("");
  const [birthTimeDisplayA, setBirthTimeDisplayA] = useState("");
  const [birthDateErrorA, setBirthDateErrorA] = useState("");
  const [birthTimeErrorA, setBirthTimeErrorA] = useState("");

  // Birth date display for B
  const [birthDateDisplayB, setBirthDateDisplayB] = useState("");
  const [birthTimeDisplayB, setBirthTimeDisplayB] = useState("");
  const [birthDateErrorB, setBirthDateErrorB] = useState("");
  const [birthTimeErrorB, setBirthTimeErrorB] = useState("");

  // Dynamic step array based on playerAMode
  const steps: StepId[] = playerAMode === "new" ? STEPS_NEW : STEPS_EXISTING;
  const currentStepId = steps[step] ?? "selectMode";
  const totalSteps = steps.length;
  const isLastStep = step === totalSteps - 1;

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const el = e.target;
    setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 400);
  };

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
      if (!res.ok) throw new Error("못 불러왔어");
      const data = await res.json();
      if (!data.result) {
        setMySajuError("저장된 사주가 없어. 새로 입력해줘.");
        return;
      }
      const r = data.result;
      setPlayerA({
        name: r.name || "",
        birthYear: r.birthYear || "",
        birthMonth: r.birthMonth || "",
        birthDay: r.birthDay || "",
        calendarType: r.calendarType || "solar",
        birthHour: r.birthHour || "",
        birthMinute: r.birthMinute || "",
        birthLocation: r.birthLocation || "",
        gender: r.gender || "",
        relationshipStatus: r.relationshipStatus || "",
        employmentStatus: r.employmentStatus || "",
        coreFearAxis: r.coreFearAxis || "",
        unknownBirthTime: r.unknownBirthTime || false,
      });
      setPlayerAMode("existing");
      setMySajuLoaded(true);
      setStep(1); // Go to next step (relationship)
    } catch {
      setMySajuError("사주를 못 불러왔어.");
    } finally {
      setLoadingMySaju(false);
    }
  };

  const handleBirthDateChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: "A" | "B"
  ) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    let formatted = value;
    if (value.length <= 4) formatted = value;
    else if (value.length <= 6) formatted = `${value.slice(0, 4)} / ${value.slice(4)}`;
    else formatted = `${value.slice(0, 4)} / ${value.slice(4, 6)} / ${value.slice(6, 8)}`;

    const parsedYear = value.length >= 4 ? value.slice(0, 4) : "";
    const parsedMonth = value.length >= 6 ? value.slice(4, 6) : "";
    const parsedDay = value.length >= 8 ? value.slice(6, 8) : "";

    if (target === "A") {
      setBirthDateDisplayA(formatted);
      setPlayerA({ birthYear: parsedYear, birthMonth: parsedMonth, birthDay: parsedDay });
      if (parsedYear && parsedMonth && parsedDay) {
        setBirthDateErrorA(validateBirthDate(parsedYear, parsedMonth, parsedDay));
      } else {
        setBirthDateErrorA("");
      }
    } else {
      setBirthDateDisplayB(formatted);
      setPlayerB({ birthYear: parsedYear, birthMonth: parsedMonth, birthDay: parsedDay });
      if (parsedYear && parsedMonth && parsedDay) {
        setBirthDateErrorB(validateBirthDate(parsedYear, parsedMonth, parsedDay));
      } else {
        setBirthDateErrorB("");
      }
    }
  };

  const handleBirthTimeChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: "A" | "B"
  ) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    let formatted = value;
    if (value.length <= 2) formatted = value;
    else formatted = `${value.slice(0, 2)} : ${value.slice(2, 4)}`;

    const parsedHour = value.length >= 2 ? value.slice(0, 2) : "";
    const parsedMinute = value.length >= 4 ? value.slice(2, 4) : "";

    if (target === "A") {
      setBirthTimeDisplayA(formatted);
      setPlayerA({ birthHour: parsedHour, birthMinute: parsedMinute });
      if (parsedHour && parsedMinute) {
        setBirthTimeErrorA(validateBirthTime(parsedHour, parsedMinute));
      } else {
        setBirthTimeErrorA("");
      }
    } else {
      setBirthTimeDisplayB(formatted);
      setPlayerB({ birthHour: parsedHour, birthMinute: parsedMinute });
      if (parsedHour && parsedMinute) {
        setBirthTimeErrorB(validateBirthTime(parsedHour, parsedMinute));
      } else {
        setBirthTimeErrorB("");
      }
    }
  };

  const canProceed = (): boolean => {
    switch (currentStepId) {
      case "selectMode":
        // In selectMode, proceed via button clicks (handleLoadMySaju / "새로 입력하기")
        // If existing loaded, allow proceeding
        if (playerAMode === "existing" && mySajuLoaded) return true;
        return false;
      case "myName":
        return !!playerA.name?.trim();
      case "myBirth":
        if (!playerA.birthYear || !playerA.birthMonth || !playerA.birthDay) return false;
        if (birthDateErrorA) return false;
        if (!playerA.unknownBirthTime && (!playerA.birthHour || !playerA.birthMinute || !!birthTimeErrorA)) return false;
        return true;
      case "myLocation":
        return !!playerA.birthLocation?.trim();
      case "myGender":
        return !!playerA.gender;
      case "relationship":
        return !!relationshipType;
      case "oppName":
        return !!playerB.name?.trim();
      case "oppBirth":
        if (!playerB.birthYear || !playerB.birthMonth || !playerB.birthDay) return false;
        if (birthDateErrorB) return false;
        if (!playerB.unknownBirthTime && (!playerB.birthHour || !playerB.birthMinute || !!birthTimeErrorB)) return false;
        return true;
      case "oppLocation":
        return !!playerB.birthLocation?.trim();
      case "oppGender":
        return !!playerB.gender;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step < totalSteps - 1) {
      trackFormStep("battle", step + 1, steps[step + 1]);
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      const prevStepId = steps[step - 1];
      // When going back to selectMode, reset playerAMode so user can re-choose
      if (prevStepId === "selectMode") {
        setPlayerAMode("");
        setMySajuLoaded(false);
      }
      setStep(step - 1);
    } else {
      router.push("/menu");
    }
  };

  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleSubmit = () => {
    if (status !== "authenticated") {
      setShowLoginModal(true);
      return;
    }
    trackFormComplete(dest.form);
    router.push(dest.next);
  };


  const renderStep = () => {
    switch (currentStepId) {
      case "selectMode":
        return (
          <div className="space-y-4">
            <h2 className="text-title-2 text-text-primary text-center font-aggro mb-6">
              네 사주부터 준비할게
            </h2>

            {!playerAMode && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleLoadMySaju}
                  disabled={loadingMySaju}
                  className="btn-option w-full py-4 rounded-xl text-button-md transition-[transform,background-color,color] duration-200 active:scale-[0.98]"
                >
                  {loadingMySaju ? <ButtonSpinner message="불러오는 중..." /> : "기존 사주 불러오기"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPlayerAMode("new");
                    setStep(1); // Go to myName step
                  }}
                  className="btn-option w-full py-4 rounded-xl text-button-md transition-[transform,background-color,color] duration-200 active:scale-[0.98]"
                >
                  새로 입력하기
                </button>
                {mySajuError && (
                  <p className="text-[13px] text-primary text-center">{mySajuError}</p>
                )}
              </div>
            )}

            {playerAMode === "existing" && mySajuLoaded && (
              <div className="rounded-2xl bg-background-secondary p-5 space-y-2">
                <div className="text-[14px] text-text-secondary">불러온 내 사주</div>
                <div className="text-[16px] font-semibold text-text-primary">{playerA.name}</div>
                <div className="text-[14px] text-text-secondary">
                  {playerA.calendarType === "lunar" ? "음력 " : ""}
                  {playerA.birthYear}.{playerA.birthMonth}.{playerA.birthDay}
                  {playerA.unknownBirthTime ? " (시간 모름)" : ` ${playerA.birthHour}:${playerA.birthMinute}`}
                </div>
                <button
                  type="button"
                  onClick={() => { setPlayerAMode(""); setMySajuLoaded(false); }}
                  className="text-[13px] text-primary underline mt-2"
                >
                  다시 선택
                </button>
              </div>
            )}
          </div>
        );

      case "myName":
        return (
          <div>
            <h2 className="text-title-2 text-text-primary text-center font-aggro mb-6">
              이름이 뭐야?
            </h2>
            <input
              type="text"
              value={playerA.name}
              onChange={(e) => setPlayerA({ name: e.target.value })}
              placeholder="예: 두루미"
              className="w-full text-[15px] h-[52px]"
              autoFocus
              onFocus={handleInputFocus}
            />
          </div>
        );

      case "myBirth":
        return (
          <div className="space-y-4">
            <h2 className="text-title-2 text-text-primary text-center font-aggro mb-6">
              언제 태어났어?
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {CALENDAR_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPlayerA({ calendarType: option.value })}
                  className={`h-11 rounded-xl text-[15px] font-semibold transition-colors ${
                    playerA.calendarType === option.value
                      ? "bg-primary text-white"
                      : "bg-background-tertiary text-text-secondary hover:bg-background-tertiary/80"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div>
              <label htmlFor="birth-date-a" className="block text-[12px] text-text-secondary mb-2">생년월일</label>
              <input
                id="birth-date-a"
                type="text"
                inputMode="numeric"
                value={birthDateDisplayA}
                onChange={(e) => handleBirthDateChange(e, "A")}
                placeholder="예: 1990 / 05 / 15"
                maxLength={14}
                className="w-full text-[15px] h-[52px]"
                onFocus={handleInputFocus}
              />
              {birthDateErrorA && <p className="mt-2 text-[13px] text-primary">{birthDateErrorA}</p>}
            </div>
            {!playerA.unknownBirthTime && (
              <div>
                <label htmlFor="birth-time-a" className="block text-[12px] text-text-secondary mb-2">태어난 시간</label>
                <input
                  id="birth-time-a"
                  type="text"
                  inputMode="numeric"
                  value={birthTimeDisplayA}
                  onChange={(e) => handleBirthTimeChange(e, "A")}
                  placeholder="예: 09 : 30"
                  maxLength={7}
                  className="w-full text-[15px] h-[52px]"
                  onFocus={handleInputFocus}
                />
                {birthTimeErrorA && <p className="mt-2 text-[13px] text-primary">{birthTimeErrorA}</p>}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setPlayerA({ unknownBirthTime: !playerA.unknownBirthTime, birthHour: "", birthMinute: "" });
                setBirthTimeDisplayA("");
              }}
              className={`btn-option w-full py-3.5 rounded-xl text-button-sm active:scale-[0.98] transition-[transform,background-color,color] duration-200 ${playerA.unknownBirthTime ? "btn-option--selected" : ""}`}
              aria-pressed={playerA.unknownBirthTime}
            >
              {playerA.unknownBirthTime ? "✓ 태어난 시간을 몰라요" : "태어난 시간을 몰라요"}
            </button>
          </div>
        );

      case "myLocation":
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
                  onClick={() => setPlayerA({ birthLocation: loc })}
                  className={`btn-option py-3 px-3 rounded-xl text-button-sm transition-[transform,background-color,color] duration-200 active:scale-[0.98] ${
                    playerA.birthLocation === loc ? "btn-option--selected shadow-[0_0_0_1px_rgba(255,107,107,0.2)]" : ""
                  }`}
                >
                  {playerA.birthLocation === loc && <span className="mr-1">✓</span>}
                  {loc}
                </button>
              ))}
            </div>
          </div>
        );

      case "myGender":
        return (
          <div>
            <h2 className="text-title-2 text-text-primary text-center font-aggro mb-6">
              성별은?
            </h2>
            <div className="space-y-3">
              {["남성", "여성"].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setPlayerA({ gender: g })}
                  className={`btn-option w-full py-4 rounded-xl text-button-md transition-[transform,background-color,color] duration-200 active:scale-[0.98] ${
                    playerA.gender === g ? "btn-option--selected shadow-[0_0_0_1px_rgba(255,107,107,0.2)]" : ""
                  }`}
                >
                  {playerA.gender === g && <span className="mr-2">✓</span>}
                  {g}
                </button>
              ))}
            </div>
          </div>
        );

      case "relationship":
        return (
          <div>
            <h2 className="text-title-2 text-text-primary text-center font-aggro mb-6">
              상대방과의 관계는?
            </h2>
            <div className="space-y-3">
              {RELATIONSHIP_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRelationshipType(opt.value)}
                  className={`btn-option w-full py-4 rounded-xl text-button-md transition-[transform,background-color,color] duration-200 active:scale-[0.98] ${
                    relationshipType === opt.value
                      ? "btn-option--selected shadow-[0_0_0_1px_rgba(255,107,107,0.2)]"
                      : ""
                  }`}
                >
                  {relationshipType === opt.value && <span className="mr-2">✓</span>}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        );

      case "oppName":
        return (
          <div>
            <h2 className="text-title-2 text-text-primary text-center font-aggro mb-6">
              상대방 이름은?
            </h2>
            <input
              type="text"
              value={playerB.name}
              onChange={(e) => setPlayerBField("name", e.target.value)}
              placeholder="예: 홍길동"
              className="w-full text-[15px] h-[52px]"
              autoFocus
              onFocus={handleInputFocus}
            />
          </div>
        );

      case "oppBirth":
        return (
          <div className="space-y-4">
            <h2 className="text-title-2 text-text-primary text-center font-aggro mb-6">
              {playerB.name}은(는) 언제 태어났어?
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {CALENDAR_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPlayerBField("calendarType", option.value)}
                  className={`h-11 rounded-xl text-[15px] font-semibold transition-colors ${
                    playerB.calendarType === option.value
                      ? "bg-primary text-white"
                      : "bg-background-tertiary text-text-secondary hover:bg-background-tertiary/80"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div>
              <label htmlFor="birth-date-b" className="block text-[12px] text-text-secondary mb-2">생년월일</label>
              <input
                id="birth-date-b"
                type="text"
                inputMode="numeric"
                value={birthDateDisplayB}
                onChange={(e) => handleBirthDateChange(e, "B")}
                placeholder="예: 1990 / 05 / 15"
                maxLength={14}
                className="w-full text-[15px] h-[52px]"
                onFocus={handleInputFocus}
              />
              {birthDateErrorB && <p className="mt-2 text-[13px] text-primary">{birthDateErrorB}</p>}
            </div>
            {!playerB.unknownBirthTime && (
              <div>
                <label htmlFor="birth-time-b" className="block text-[12px] text-text-secondary mb-2">태어난 시간</label>
                <input
                  id="birth-time-b"
                  type="text"
                  inputMode="numeric"
                  value={birthTimeDisplayB}
                  onChange={(e) => handleBirthTimeChange(e, "B")}
                  placeholder="예: 09 : 30"
                  maxLength={7}
                  className="w-full text-[15px] h-[52px]"
                  onFocus={handleInputFocus}
                />
                {birthTimeErrorB && <p className="mt-2 text-[13px] text-primary">{birthTimeErrorB}</p>}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setPlayerB({ unknownBirthTime: !playerB.unknownBirthTime, birthHour: "", birthMinute: "" });
                setBirthTimeDisplayB("");
              }}
              className={`btn-option w-full py-3.5 rounded-xl text-button-sm active:scale-[0.98] transition-[transform,background-color,color] duration-200 ${playerB.unknownBirthTime ? "btn-option--selected" : ""}`}
              aria-pressed={playerB.unknownBirthTime}
            >
              {playerB.unknownBirthTime ? "✓ 태어난 시간을 몰라요" : "태어난 시간을 몰라요"}
            </button>
          </div>
        );

      case "oppLocation":
        return (
          <div>
            <h2 className="text-title-2 text-text-primary text-center font-aggro mb-6">
              {playerB.name}은(는) 어디서 태어났어?
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {LOCATIONS.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setPlayerBField("birthLocation", loc)}
                  className={`btn-option py-3 px-3 rounded-xl text-button-sm transition-[transform,background-color,color] duration-200 active:scale-[0.98] ${
                    playerB.birthLocation === loc ? "btn-option--selected shadow-[0_0_0_1px_rgba(255,107,107,0.2)]" : ""
                  }`}
                >
                  {playerB.birthLocation === loc && <span className="mr-1">✓</span>}
                  {loc}
                </button>
              ))}
            </div>
          </div>
        );

      case "oppGender":
        return (
          <div>
            <h2 className="text-title-2 text-text-primary text-center font-aggro mb-6">
              {playerB.name} 성별은?
            </h2>
            <div className="space-y-3">
              {["남성", "여성"].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setPlayerBField("gender", g)}
                  className={`btn-option w-full py-4 rounded-xl text-button-md transition-[transform,background-color,color] duration-200 active:scale-[0.98] ${
                    playerB.gender === g ? "btn-option--selected shadow-[0_0_0_1px_rgba(255,107,107,0.2)]" : ""
                  }`}
                >
                  {playerB.gender === g && <span className="mr-2">✓</span>}
                  {g}
                </button>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Hide footer "다음" button on selectMode (navigation is via inline buttons)
  const showFooterButton = currentStepId !== "selectMode";

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
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))' }}
      >
        <div className="max-w-[640px] mx-auto space-y-4">
          <div className="flex items-center">
            <span className="text-[14px] text-text-secondary">{step + 1} / {totalSteps}</span>
            <div className="ml-3 flex-1 h-1 bg-background-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-[width] duration-500 ease-out"
                style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
              />
            </div>
          </div>
          {showFooterButton && (
            <button
              type="button"
              onClick={isLastStep ? handleSubmit : handleNext}
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
            대결하려면 로그인이 필요해
          </h3>
          <p className="text-[13px] text-text-secondary text-center mb-6">
            로그인하면 결과가 저장돼
          </p>
          <LoginForm
            callbackUrl="/teaser?type=battle"
            onClose={() => setShowLoginModal(false)}
          />
        </div>
      </Modal>
    </div>
  );
}
