"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

type FormData = {
  name: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  birthHour: string;
  birthMinute: string;
  birthLocation: string;
  gender: string;
  relationshipStatus: string;
  unknownBirthTime: boolean;
};

const questions = [
  { id: "name", title: "이름이 무엇인가요?", type: "text" },
  { id: "birthDateTime", title: "언제 태어났어요?", type: "datetime" },
  { id: "birthLocation", title: "어디서 태어나셨어요?", type: "location" },
  { id: "gender", title: "성별이 어떻게 되세요?", type: "select" },
  { id: "relationshipStatus", title: "현재 어떤 상태이신가요?", type: "select" },
];

const LOCATIONS = [
  "서울", "경기", "인천", "강원", "충북", "충남",
  "대전", "세종", "전북", "전남", "광주", "경북",
  "경남", "대구", "울산", "부산", "제주", "해외"
];

export default function Home() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    birthYear: "",
    birthMonth: "",
    birthDay: "",
    birthHour: "",
    birthMinute: "",
    birthLocation: "",
    gender: "",
    relationshipStatus: "",
    unknownBirthTime: false,
  });

  // 생년월일 포맷팅용 상태
  const [birthDateDisplay, setBirthDateDisplay] = useState("");
  const [birthTimeDisplay, setBirthTimeDisplay] = useState("");

  const totalSteps = questions.length;

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    const params = new URLSearchParams({
      name: formData.name,
      birthYear: formData.birthYear,
      birthMonth: formData.birthMonth,
      birthDay: formData.birthDay,
      birthHour: formData.birthHour,
      birthMinute: formData.birthMinute,
      birthLocation: formData.birthLocation,
      gender: formData.gender,
      relationshipStatus: formData.relationshipStatus,
      unknownBirthTime: formData.unknownBirthTime.toString(),
    });

    signIn("kakao", { callbackUrl: `/result?${params.toString()}` });
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
    if (value.length >= 4) {
      setFormData(prev => ({ ...prev, birthYear: value.slice(0, 4) }));
    } else {
      setFormData(prev => ({ ...prev, birthYear: "" }));
    }

    if (value.length >= 6) {
      setFormData(prev => ({ ...prev, birthMonth: value.slice(4, 6) }));
    } else {
      setFormData(prev => ({ ...prev, birthMonth: "" }));
    }

    if (value.length >= 8) {
      setFormData(prev => ({ ...prev, birthDay: value.slice(6, 8) }));
    } else {
      setFormData(prev => ({ ...prev, birthDay: "" }));
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
    if (value.length >= 2) {
      setFormData(prev => ({ ...prev, birthHour: value.slice(0, 2) }));
    } else {
      setFormData(prev => ({ ...prev, birthHour: "" }));
    }

    if (value.length >= 4) {
      setFormData(prev => ({ ...prev, birthMinute: value.slice(2, 4) }));
    } else {
      setFormData(prev => ({ ...prev, birthMinute: "" }));
    }
  };

  const canProceed = () => {
    const question = questions[currentStep];
    switch (question.id) {
      case "name":
        return formData.name.trim() !== "";
      case "birthDateTime":
        // 생년월일은 필수, 시간은 unknownBirthTime이 true이거나 입력되어야 함
        return (
          formData.birthYear &&
          formData.birthMonth &&
          formData.birthDay &&
          (formData.unknownBirthTime || (formData.birthHour && formData.birthMinute))
        );
      case "birthLocation":
        return formData.birthLocation.trim() !== "";
      case "gender":
        return formData.gender !== "";
      case "relationshipStatus":
        return formData.relationshipStatus !== "";
      default:
        return false;
    }
  };

  const renderQuestion = () => {
    const question = questions[currentStep];

    switch (question.id) {
      case "name":
        return (
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="예: 홍길동"
            className="w-full text-[15px]"
            autoFocus
            aria-label="이름"
          />
        );

      case "birthDateTime":
        return (
          <div className="space-y-4">
            {/* 생년월일 입력 */}
            <div>
              <label htmlFor="birthDate" style={{ display: 'block', fontSize: '12px', color: '#A3A3A3', marginBottom: '8px' }}>생년월일</label>
              <input
                id="birthDate"
                type="text"
                inputMode="numeric"
                value={birthDateDisplay}
                onChange={handleBirthDateChange}
                placeholder="1995 / 06 / 21"
                maxLength={14}
                className="w-full text-[15px]"
                aria-label="생년월일"
              />
            </div>

            {/* 시간 입력 */}
            {!formData.unknownBirthTime && (
              <div>
                <label htmlFor="birthTime" style={{ display: 'block', fontSize: '12px', color: '#A3A3A3', marginBottom: '8px' }}>태어난 시간</label>
                <input
                  id="birthTime"
                  type="text"
                  inputMode="numeric"
                  value={birthTimeDisplay}
                  onChange={handleBirthTimeChange}
                  placeholder="16 : 30"
                  maxLength={7}
                  className="w-full text-[15px]"
                  aria-label="태어난 시간"
                />
              </div>
            )}

            {/* 시간 모름 버튼 */}
            <button
              type="button"
              onClick={() => {
                setFormData({
                  ...formData,
                  unknownBirthTime: !formData.unknownBirthTime,
                  birthHour: "",
                  birthMinute: "",
                });
                setBirthTimeDisplay("");
              }}
              className="btn-option w-full py-3.5 rounded-xl text-button-sm active:scale-[0.98] transition-all duration-200"
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
                  setFormData({ ...formData, birthLocation: location });
                }}
                className={`btn-option py-3 px-3 rounded-xl text-button-sm transition-all duration-200 active:scale-[0.98] ${
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
              onClick={() => setFormData({ ...formData, gender: "남성" })}
              className={`btn-option w-full py-4 rounded-xl text-button-md transition-all duration-200 active:scale-[0.98] ${
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
              onClick={() => setFormData({ ...formData, gender: "여성" })}
              className={`btn-option w-full py-4 rounded-xl text-button-md transition-all duration-200 active:scale-[0.98] ${
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
            {["솔로", "연애중", "기혼"].map((status) => (
              <button
                key={status}
                onClick={() => setFormData({ ...formData, relationshipStatus: status })}
                className={`btn-option w-full py-4 rounded-xl text-button-md transition-all duration-200 active:scale-[0.98] ${
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

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      {/* 헤더 */}
      <header className="px-6 py-5">
        <div className="max-w-[420px] mx-auto flex items-center justify-between">
          {/* 뒤로가기 버튼 */}
          {currentStep > 0 && (
            <button
              onClick={handleBack}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-text-primary hover:bg-bg-secondary transition-colors"
              aria-label="이전 단계로"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          )}
          {currentStep === 0 && <div className="w-10" />}

          <h1 className="text-title-3 text-text-primary">사주보는 두루묵</h1>

          <div className="w-10" />
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 flex flex-col justify-center px-6 pb-40 pt-8">
        <div className="max-w-[420px] w-full mx-auto">
          {/* 질문 */}
          <div>
            <p className="text-step">
              {currentStep + 1} / {totalSteps}
            </p>
            <h2 className="text-question">
              {questions[currentStep].title}
            </h2>
          </div>

          {/* 입력 영역 */}
          <div>{renderQuestion()}</div>
        </div>
      </main>

      {/* 하단 고정 영역 (프로그레스바 + 다음 버튼) */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-bg-primary via-bg-primary/95 to-transparent backdrop-blur-sm px-6 py-6">
        <div className="max-w-[420px] mx-auto space-y-4">
          {/* 프로그레스 바 */}
          <div
            style={{
              width: '100%',
              height: '4px',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: '2px',
              overflow: 'hidden'
            }}
            role="progressbar"
            aria-valuenow={currentStep + 1}
            aria-valuemin={1}
            aria-valuemax={totalSteps}
          >
            <div
              style={{
                height: '100%',
                background: 'var(--primary)',
                width: `${((currentStep + 1) / totalSteps) * 100}%`,
                transition: 'all 0.5s ease-out',
                borderRadius: '2px'
              }}
            />
          </div>

          {/* 다음 버튼 */}
          <button
            onClick={currentStep === totalSteps - 1 ? handleSubmit : handleNext}
            disabled={!canProceed()}
            className="btn-primary w-full rounded-xl px-4 py-4 text-[15px] font-semibold leading-none transition-all duration-200"
          >
            {currentStep === totalSteps - 1 ? "결과 보기" : "다음"}
          </button>
        </div>
      </div>
    </div>
  );
}
