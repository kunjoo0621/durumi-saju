"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useAllInputs, useStoreActions } from "@/store/useInputStore";
import { useKakaoLogin } from "@/hooks/useKakaoLogin";
import { trackFormStep, trackFormComplete, trackLoginTrigger } from "@/lib/analytics";
import Header from "@/components/layout/Header";
import Modal from "@/components/Modal";

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
const EMPLOYMENT_OPTIONS = ["직장인", "사업·프리랜서", "학생", "취업 준비 중"] as const;

// 핵심 결핍/공포 축 선택지
const CORE_FEAR_OPTIONS = [
  { label: "이직·커리어", value: "ABANDON" as const },
  { label: "돈·재정", value: "INCOMPETENT" as const },
  { label: "인간관계", value: "DISMISS" as const },
  { label: "건강·컨디션", value: "LOSS_OF_CONTROL" as const },
] as const;

export default function Home() {
  const router = useRouter();
  const { status } = useSession();
  const { login } = useKakaoLogin();
  const [currentStep, setCurrentStep] = useState(0);

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

  const totalSteps = QUESTIONS.length;

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      trackFormStep("start", currentStep + 1, QUESTIONS[currentStep + 1].id);
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
    trackFormComplete("start");
    router.push("/teaser");
  };

  const handleLoginConfirm = () => {
    setShowLoginModal(false);
    trackLoginTrigger("start_form_complete");
    login(`${window.location.origin}/teaser`);
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
    const question = QUESTIONS[currentStep];
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
    const question = QUESTIONS[currentStep];

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
                    onClick={() => setField("calendarType", option.value)}
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
          <div className="space-y-3" role="radiogroup" aria-label="연애 상태">
            {RELATIONSHIP_OPTIONS.map((status) => (
              <button
                key={status}
                onClick={() => setField("relationshipStatus", status)}
                className={`btn-option w-full py-4 rounded-xl text-button-md transition-[transform,background-color,color] duration-200 active:scale-[0.98] ${
                  formData.relationshipStatus === status
                    ? "btn-option--selected shadow-[0_0_0_1px_rgba(255,107,107,0.2)]"
                    : ""
                }`}
                role="radio"
                aria-checked={formData.relationshipStatus === status}
              >
                {formData.relationshipStatus === status && <span className="mr-2" aria-hidden="true">✓</span>}
                {status}
              </button>
            ))}
          </div>
        );

      case "employmentStatus":
        return (
          <div className="space-y-3" role="radiogroup" aria-label="현재 상태">
            {EMPLOYMENT_OPTIONS.map((status) => (
              <button
                key={status}
                onClick={() => setField("employmentStatus", status)}
                className={`btn-option w-full py-4 rounded-xl text-button-md transition-[transform,background-color,color] duration-200 active:scale-[0.98] ${
                  formData.employmentStatus === status
                    ? "btn-option--selected shadow-[0_0_0_1px_rgba(255,107,107,0.2)]"
                    : ""
                }`}
                role="radio"
                aria-checked={formData.employmentStatus === status}
              >
                {formData.employmentStatus === status && <span className="mr-2" aria-hidden="true">✓</span>}
                {status}
              </button>
            ))}
          </div>
        );

      case "coreFearAxis":
        return (
          <div className="space-y-3" role="radiogroup" aria-label="핵심 공포 축">
            {CORE_FEAR_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setField("coreFearAxis", option.value)}
                className={`btn-option w-full py-4 rounded-xl text-button-md transition-[transform,background-color,color] duration-200 active:scale-[0.98] ${
                  formData.coreFearAxis === option.value
                    ? "btn-option--selected shadow-[0_0_0_1px_rgba(255,107,107,0.2)]"
                    : ""
                }`}
                role="radio"
                aria-checked={formData.coreFearAxis === option.value}
              >
                {formData.coreFearAxis === option.value && <span className="mr-2" aria-hidden="true">✓</span>}
                {option.label}
              </button>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-[100dvh] bg-background-primary flex flex-col overflow-hidden">
      <Header
        showBack
        showBalance
        onBack={currentStep > 0 ? handleBack : () => router.push("/menu")}
      />

      {/* 메인 콘텐츠 */}
      <main className="flex-1 min-h-0 px-5 pb-6 overflow-y-auto">
        <div className="max-w-[640px] w-full mx-auto pt-10">
          {/* 질문 */}
          <div>
            <h2 className="text-[24px] font-semibold text-white text-center font-aggro mb-6">
              {QUESTIONS[currentStep].title}
            </h2>
          </div>

          {/* 입력 영역 */}
          <div>{renderQuestion()}</div>
        </div>
      </main>

      {/* 하단 영역 (프로그레스바 + 다음 버튼) */}
      <footer
        className="shrink-0 bg-[#0D0D0D] px-5 py-4"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))' }}
      >
        <div className="max-w-[640px] mx-auto space-y-4">
          <div className="flex items-center">
            <span className="text-[14px] text-text-secondary">{currentStep + 1} / {totalSteps}</span>
            <div
              className="ml-3 flex-1 h-1 bg-background-tertiary rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={currentStep + 1}
              aria-valuemin={1}
              aria-valuemax={totalSteps}
            >
              <div
                className="h-full bg-primary rounded-full transition-[width] duration-500 ease-out"
                style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
              />
            </div>
          </div>

          <button
            onClick={currentStep === totalSteps - 1 ? handleSubmit : handleNext}
            disabled={!canProceed()}
            className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold transition-colors duration-200"
          >
            {currentStep === totalSteps - 1 ? "결과 받기" : "다음"}
          </button>
        </div>
      </footer>

      <Modal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        maxWidth="340px"
        ariaLabel="로그인 안내"
      >
        <div className="p-6">
          <h3 className="text-[17px] font-bold text-text-primary text-center mb-2">
            결과를 받으려면 로그인이 필요해
          </h3>
          <p className="text-[13px] text-text-secondary text-center mb-6">
            카카오로 로그인하면 결과가 저장돼
          </p>
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleLoginConfirm}
              className="w-full h-[54px] rounded-xl bg-[#FEE500] text-black text-[15px] font-semibold flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="text-black">
                <path
                  d="M12 4c-5.06 0-9 3.15-9 7.03 0 2.47 1.54 4.63 3.9 5.87l-.7 3.06a.5.5 0 0 0 .75.54l3.56-2.26c.5.07 1.02.1 1.55.1 5.06 0 9-3.15 9-7.03S17.06 4 12 4z"
                  fill="currentColor"
                />
              </svg>
              카카오로 로그인하기
            </button>
            <button
              type="button"
              onClick={() => setShowLoginModal(false)}
              className="w-full h-[48px] rounded-xl text-[14px] text-text-tertiary transition-colors"
            >
              돌아가기
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
