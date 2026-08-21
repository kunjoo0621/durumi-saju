"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useAllInputs, useStoreActions, type CoreFearAxis } from "@/store/useInputStore";
import { trackFormStep, trackFormComplete, type FormName } from "@/lib/analytics";
import Modal from "@/components/Modal";
import LoginForm from "@/components/LoginForm";
import OptionCardGroup from "@/components/saju-input/OptionCardGroup";
import { hasLeapMonth } from "@/lib/utils/lunar";
import QuestionStepScaffold from "@/components/saju-input/QuestionStepScaffold";

/* 공통 사주 입력 흐름 컴포넌트
 * /start (개인사주) + /yearly/input (올해 운세 단독) 양쪽에서 사용.
 *  - onComplete: 입력 완료 시 호출 (saju → /teaser, yearly → 결제·analyze)
 *  - callbackUrl: 로그인 후 돌아올 URL
 *  - backUrl: 뒤로가기 (default /menu)
 *  - trackName: analytics 폼 이름
 *  - skipQuestions: 특정 question id 제외 (예: yearly는 coreFearAxis 제외)
 */
type SajuInputFlowProps = {
  onComplete: () => void;
  callbackUrl: string;
  backUrl?: string;
  trackName?: FormName;
  skipQuestions?: string[];
  submitLabel?: string;
};

// 상수를 모듈 레벨로 이동 (렌더링마다 재생성 방지)
const QUESTIONS = [
  { id: "name", title: "이름이 뭐야?", type: "text" },
  { id: "birthDateTime", title: "언제 태어났어?", type: "datetime" },
  { id: "birthLocation", title: "어디서 태어났어?", type: "location" },
  { id: "gender", title: "성별은?", type: "select" },
  { id: "relationshipStatus", title: "연애는?", type: "select" },
  { id: "employmentStatus", title: "요즘 뭐 해?", type: "select" },
  { id: "coreFearAxis", title: "요즘 머릿속 1등 이슈는?", type: "select" },
] as const;

const LOCATIONS = [
  "서울", "경기", "인천", "강원", "충북", "충남",
  "대전", "세종", "전북", "전남", "광주", "경북",
  "경남", "대구", "울산", "부산", "제주", "해외"
] as const;

const CALENDAR_OPTIONS = [
  { label: "양력", value: "solar" as const },
  { label: "음력", value: "lunar" as const },
] as const;

const RELATIONSHIP_OPTIONS = ["솔로", "연애중", "기혼"] as const;
const EMPLOYMENT_OPTIONS = ["직장인", "사업·프리랜서", "학생", "취업 준비 중", "주부"] as const;

// 핵심 결핍/공포 축 선택지
const CORE_FEAR_OPTIONS = [
  { label: "이직·커리어", value: "ABANDON" as const },
  { label: "돈·재정", value: "INCOMPETENT" as const },
  { label: "인간관계", value: "DISMISS" as const },
  { label: "건강·컨디션", value: "LOSS_OF_CONTROL" as const },
] as const;

// OptionCardGroup용 { value, label } 카드 배열 (모듈 레벨 — 렌더마다 재생성 방지)
const RELATIONSHIP_OPTION_CARDS = RELATIONSHIP_OPTIONS.map((v) => ({ value: v, label: v }));
const EMPLOYMENT_OPTION_CARDS = EMPLOYMENT_OPTIONS.map((v) => ({ value: v, label: v }));
const CORE_FEAR_OPTION_CARDS = CORE_FEAR_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

export default function SajuInputFlow({
  onComplete,
  callbackUrl,
  backUrl = "/menu",
  trackName = "start",
  skipQuestions = [],
  submitLabel = "결과 받기",
}: SajuInputFlowProps) {
  const router = useRouter();
  const { status } = useSession();

  // skipQuestions에 포함된 질문은 제외 (예: yearly에서 coreFearAxis 빼기)
  const filteredQuestions = QUESTIONS.filter((q) => !skipQuestions.includes(q.id));
  const maxStep = filteredQuestions.length - 1;

  // currentStep 영구화 — 로그인 callback 후 페이지 재로드 시 진행도 유지
  const STEP_KEY = `saju-input-step-${trackName}`;
  // sessionStorage에서 진행도 복원 (로그인 callback 등으로 페이지 재로드 시)
  const [currentStep, setCurrentStep] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const saved = sessionStorage.getItem(STEP_KEY);
    if (!saved) return 0;
    const n = parseInt(saved, 10);
    if (!Number.isFinite(n)) return 0;
    return Math.min(Math.max(0, n), maxStep);
  });

  // currentStep 변경 시 sessionStorage 자동 저장
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(STEP_KEY, String(currentStep));
    }
  }, [currentStep, STEP_KEY]);

  // 최적화된 선택자 사용 - 전체 스토어 구독 대신 필요한 필드만
  const formData = useAllInputs();
  const { setField, setFields } = useStoreActions();

  const {
    name,
    birthYear,
    birthMonth,
    birthDay,
    calendarType,
    birthHour,
    birthMinute,
    birthLocation,
    gender,
    relationshipStatus,
    employmentStatus,
    coreFearAxis,
    unknownBirthTime,
  } = formData;

  /**
   * 그 해 그 음력 월에 윤달이 실재하는지 — 체크박스 노출 조건.
   * 윤달은 19년에 7번뿐이라, 없는 달에 띄우면 대부분의 사용자에게 혼란만 준다.
   */
  const leapAvailable = useMemo(() => {
    if (calendarType !== "lunar") return false;
    const y = Number(birthYear), m = Number(birthMonth);
    if (!y || !m || m < 1 || m > 12) return false;
    return hasLeapMonth(y, m);
  }, [calendarType, birthYear, birthMonth]);

  // 생년월일 포맷팅용 상태
  const [birthDateDisplay, setBirthDateDisplay] = useState("");
  const [birthTimeDisplay, setBirthTimeDisplay] = useState("");
  const [birthDateError, setBirthDateError] = useState("");
  const [birthTimeError, setBirthTimeError] = useState("");
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

  useEffect(() => {
    const digits = `${birthYear}${birthMonth}${birthDay}`;
    if (!digits) {
      setBirthDateDisplay("");
      return;
    }
    if (digits.length <= 4) {
      setBirthDateDisplay(digits);
    } else if (digits.length <= 6) {
      setBirthDateDisplay(`${digits.slice(0, 4)} / ${digits.slice(4)}`);
    } else {
      setBirthDateDisplay(`${digits.slice(0, 4)} / ${digits.slice(4, 6)} / ${digits.slice(6, 8)}`);
    }
  }, [birthYear, birthMonth, birthDay]);

  useEffect(() => {
    const digits = `${birthHour}${birthMinute}`;
    if (!digits) {
      setBirthTimeDisplay("");
      return;
    }
    if (digits.length <= 2) {
      setBirthTimeDisplay(digits);
    } else {
      setBirthTimeDisplay(`${digits.slice(0, 2)} : ${digits.slice(2, 4)}`);
    }
  }, [birthHour, birthMinute]);

  const totalSteps = filteredQuestions.length;

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      trackFormStep(trackName, currentStep + 1, filteredQuestions[currentStep + 1].id);
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleSubmit = () => {
    if (status !== "authenticated") {
      setShowLoginModal(true);
      return;
    }
    trackFormComplete(trackName);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(STEP_KEY);
    }
    onComplete();
  };


  // 생년월일 입력 처리
  const handleBirthDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, ""); // 숫자만 추출
    let formatted = value;

    if (value.length > 0) {
      // YYYY / MM / DD 형식으로 포맷팅
      if (value.length <= 4) {
        formatted = value;
      } else if (value.length <= 6) {
        formatted = `${value.slice(0, 4)} / ${value.slice(4)}`;
      } else {
        formatted = `${value.slice(0, 4)} / ${value.slice(4, 6)} / ${value.slice(6, 8)}`;
      }
    }

    setBirthDateDisplay(formatted);

    // 실제 데이터 파싱
    const parsedYear = value.length >= 4 ? value.slice(0, 4) : "";
    const parsedMonth = value.length >= 6 ? value.slice(4, 6) : "";
    const parsedDay = value.length >= 8 ? value.slice(6, 8) : "";
    setFields({ birthYear: parsedYear, birthMonth: parsedMonth, birthDay: parsedDay });

    // 8자리 완성 시 유효성 검증
    if (parsedYear && parsedMonth && parsedDay) {
      setBirthDateError(validateBirthDate(parsedYear, parsedMonth, parsedDay));
    } else {
      setBirthDateError("");
    }
  };

  // 시간 입력 처리
  const handleBirthTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, ""); // 숫자만 추출
    let formatted = value;

    if (value.length > 0) {
      // HH : MM 형식으로 포맷팅
      if (value.length <= 2) {
        formatted = value;
      } else {
        formatted = `${value.slice(0, 2)} : ${value.slice(2, 4)}`;
      }
    }

    setBirthTimeDisplay(formatted);

    // 실제 데이터 파싱
    const parsedHour = value.length >= 2 ? value.slice(0, 2) : "";
    const parsedMinute = value.length >= 4 ? value.slice(2, 4) : "";
    setFields({ birthHour: parsedHour, birthMinute: parsedMinute });

    // 4자리 완성 시 유효성 검증
    if (parsedHour && parsedMinute) {
      setBirthTimeError(validateBirthTime(parsedHour, parsedMinute));
    } else {
      setBirthTimeError("");
    }
  };

  const canProceed = () => {
    const question = filteredQuestions[currentStep];
    switch (question.id) {
      case "name":
        return formData.name.trim() !== "";
      case "birthDateTime":
        // 생년월일은 필수, 유효해야 하고, 시간은 unknownBirthTime이 true이거나 입력+유효해야 함
        return (
          formData.birthYear &&
          formData.birthMonth &&
          formData.birthDay &&
          !birthDateError &&
          (formData.unknownBirthTime || (formData.birthHour && formData.birthMinute && !birthTimeError))
        );
      case "birthLocation":
        return formData.birthLocation.trim() !== "";
      case "gender":
        return formData.gender !== "";
      case "relationshipStatus":
        return formData.relationshipStatus !== "";
      case "employmentStatus":
        return formData.employmentStatus !== "";
      case "coreFearAxis":
        return formData.coreFearAxis !== "";
      default:
        return false;
    }
  };

  const renderQuestion = () => {
    const question = filteredQuestions[currentStep];

    switch (question.id) {
      case "name":
        return (
          <div>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="예: 두루미"
              className="w-full text-[15px] h-[52px]"
              autoFocus
              onFocus={handleInputFocus}
              aria-label="이름"
            />
          </div>
        );

      case "birthDateTime":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {CALENDAR_OPTIONS.map((option) => {
                const selected = formData.calendarType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setField("calendarType", option.value);
                      // 양력으로 돌아가면 윤달 선택은 의미가 없다 — 남겨두면 오염된다.
                      if (option.value === "solar") setField("isLeapMonth", false);
                    }}
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
            {/*
              윤달 선택 — 음력이면서 **그 해 그 월에 윤달이 실재할 때만** 보여준다.
              윤달은 19년에 7번뿐이라 항상 띄우면 대부분의 사용자에게 혼란만 준다.
              (기본값 false 이므로 이 체크박스를 안 건드리면 기존과 동일하게 평달로 간다)
            */}
            {formData.calendarType === "lunar" && leapAvailable && (
              <button
                type="button"
                onClick={() => setField("isLeapMonth", !formData.isLeapMonth)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 h-11 text-[14px] transition-colors ${
                  formData.isLeapMonth
                    ? "bg-primary/15 text-primary"
                    : "bg-background-tertiary text-text-secondary hover:bg-background-tertiary/80"
                }`}
                aria-pressed={formData.isLeapMonth}
              >
                <span
                  className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
                    formData.isLeapMonth ? "border-primary bg-primary" : "border-text-tertiary"
                  }`}
                >
                  {formData.isLeapMonth && (
                    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
                      <path d="M2.5 6.2L4.8 8.5L9.5 3.8" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                윤달이에요
                <span className="ml-auto text-[12px] text-text-tertiary">
                  {formData.birthMonth}월에 윤달이 있어요
                </span>
              </button>
            )}
            {/* 생년월일 입력 */}
            <div>
              <label htmlFor="birthDate" className="block text-[12px] text-text-secondary mb-2">생년월일</label>
              <input
                id="birthDate"
                type="text"
                inputMode="numeric"
                value={birthDateDisplay}
                onChange={handleBirthDateChange}
                placeholder="예: 1990 / 05 / 15"
                maxLength={14}
                className="w-full text-[15px] h-[52px]"
                onFocus={handleInputFocus}
                aria-label="생년월일"
              />
              {birthDateError && (
                <p className="mt-2 text-[13px] text-primary">{birthDateError}</p>
              )}
            </div>

            {/* 시간 입력 */}
            {!formData.unknownBirthTime && (
              <div>
                <label htmlFor="birthTime" className="block text-[12px] text-text-secondary mb-2">태어난 시간</label>
                <input
                  id="birthTime"
                  type="text"
                  inputMode="numeric"
                  value={birthTimeDisplay}
                  onChange={handleBirthTimeChange}
                  placeholder="예: 09 : 30"
                  maxLength={7}
                  className="w-full text-[15px] h-[52px]"
                  onFocus={handleInputFocus}
                  aria-label="태어난 시간"
                />
                {birthTimeError && (
                  <p className="mt-2 text-[13px] text-primary">{birthTimeError}</p>
                )}
              </div>
            )}

            {/* 시간 모름 버튼 */}
            <button
              type="button"
              onClick={() => {
                setFields({
                  unknownBirthTime: !formData.unknownBirthTime,
                  birthHour: "",
                  birthMinute: "",
                });
                setBirthTimeDisplay("");
              }}
              className="btn-option w-full py-3.5 rounded-xl text-button-sm active:scale-[0.98] transition-[transform,background-color,color] duration-200"
              aria-pressed={formData.unknownBirthTime}
            >
              {formData.unknownBirthTime ? "✓ 태어난 시간을 몰라요" : "태어난 시간을 몰라요"}
            </button>
          </div>
        );

      case "birthLocation":
        return (
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="출생 지역">
            {LOCATIONS.map((location) => (
              <button
                key={location}
                onClick={() => {
                  setField("birthLocation", location);
                }}
                className={`btn-option py-3 px-3 rounded-xl text-button-sm transition-[transform,background-color,color] duration-200 active:scale-[0.98] ${
                  formData.birthLocation === location
                    ? "btn-option--selected shadow-[0_0_0_1px_rgba(255,107,107,0.2)]"
                    : ""
                }`}
                role="radio"
                aria-checked={formData.birthLocation === location}
              >
                {formData.birthLocation === location && <span className="mr-1" aria-hidden="true">✓</span>}
                {location}
              </button>
            ))}
          </div>
        );

      case "gender":
        return (
          <div className="space-y-3" role="radiogroup" aria-label="성별">
            <button
              onClick={() => setField("gender", "남성")}
              className={`btn-option w-full py-4 rounded-xl text-button-md transition-[transform,background-color,color] duration-200 active:scale-[0.98] ${
                formData.gender === "남성"
                  ? "btn-option--selected shadow-[0_0_0_1px_rgba(255,107,107,0.2)]"
                  : ""
              }`}
              role="radio"
              aria-checked={formData.gender === "남성"}
            >
              {formData.gender === "남성" && <span className="mr-2" aria-hidden="true">✓</span>}
              남성
            </button>
            <button
              onClick={() => setField("gender", "여성")}
              className={`btn-option w-full py-4 rounded-xl text-button-md transition-[transform,background-color,color] duration-200 active:scale-[0.98] ${
                formData.gender === "여성"
                  ? "btn-option--selected shadow-[0_0_0_1px_rgba(255,107,107,0.2)]"
                  : ""
              }`}
              role="radio"
              aria-checked={formData.gender === "여성"}
            >
              {formData.gender === "여성" && <span className="mr-2" aria-hidden="true">✓</span>}
              여성
            </button>
          </div>
        );

      case "relationshipStatus":
        return (
          <OptionCardGroup
            name="연애 상태"
            options={RELATIONSHIP_OPTION_CARDS}
            selected={formData.relationshipStatus}
            onSelect={(value) => setField("relationshipStatus", value)}
          />
        );

      case "employmentStatus":
        return (
          <OptionCardGroup
            name="현재 상태"
            options={EMPLOYMENT_OPTION_CARDS}
            selected={formData.employmentStatus}
            onSelect={(value) => setField("employmentStatus", value)}
          />
        );

      case "coreFearAxis":
        return (
          <OptionCardGroup
            name="핵심 공포 축"
            options={CORE_FEAR_OPTION_CARDS}
            selected={formData.coreFearAxis}
            onSelect={(value) => setField("coreFearAxis", value as CoreFearAxis)}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-[100dvh] bg-background-primary flex flex-col overflow-hidden">
      <QuestionStepScaffold
        title={filteredQuestions[currentStep].title}
        onBack={currentStep > 0 ? handleBack : () => router.push(backUrl)}
        stepIndex={currentStep}
        stepTotal={totalSteps}
        canProceed={!!canProceed()}
        onProceed={currentStep === totalSteps - 1 ? handleSubmit : handleNext}
        ctaLabel={currentStep === totalSteps - 1 ? submitLabel : "다음"}
      >
        {renderQuestion()}
      </QuestionStepScaffold>

      <Modal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        maxWidth="380px"
        ariaLabel="로그인"
      >
        <div className="p-6">
          <h3 className="text-[17px] font-bold text-text-primary text-center mb-2">
            결과를 받으려면 로그인이 필요해
          </h3>
          <p className="text-[13px] text-text-secondary text-center mb-6">
            로그인하면 결과가 저장돼
          </p>
          <LoginForm
            callbackUrl={callbackUrl}
            onClose={() => setShowLoginModal(false)}
          />
        </div>
      </Modal>
    </div>
  );
}
