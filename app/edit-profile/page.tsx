"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useKakaoLogin } from "@/hooks/useKakaoLogin";
import Header from "@/components/layout/Header";

type ProfileForm = {
  name: string;
  birthDate: string;
  birthTime: string;
  region: string;
  gender: string;
  relationshipStatus: string;
  employmentStatus: string;
  calendarType: "solar" | "lunar";
};

const TIME_OPTIONS = [
  "모름",
  "자시(23~01시)",
  "축시(01~03시)",
  "인시(03~05시)",
  "묘시(05~07시)",
  "진시(07~09시)",
  "사시(09~11시)",
  "오시(11~13시)",
  "미시(13~15시)",
  "신시(15~17시)",
  "유시(17~19시)",
  "술시(19~21시)",
  "해시(21~23시)",
];

const REGIONS = [
  "서울", "경기", "인천", "강원", "충북", "충남",
  "대전", "세종", "전북", "전남", "광주", "경북",
  "경남", "대구", "울산", "부산", "제주", "해외",
];
const GENDERS = ["남성", "여성"];
const RELATIONSHIPS = ["솔로", "연애중", "기혼"];
const EMPLOYMENT = ["직장인", "사업·프리랜서", "학생", "취업 준비 중"];

const formatBirthDate = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}.${digits.slice(4)}`;
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`;
};

const normalizeBirthDate = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 8) return "";
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
};

export default function EditProfilePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { login, signing } = useKakaoLogin();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const attemptedSignInRef = useRef(false);
  const [form, setForm] = useState<ProfileForm>({
    name: "",
    birthDate: "",
    birthTime: "모름",
    region: "",
    gender: "",
    relationshipStatus: "",
    employmentStatus: "",
    calendarType: "solar",
  });

  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user) {
      setLoading(false);
      setAuthRequired(true);
      if (!attemptedSignInRef.current) {
        attemptedSignInRef.current = true;
        login("/edit-profile");
      }
      return;
    }

    let cancelled = false;
    const loadProfile = async () => {
      setLoading(true);
      setAuthRequired(false);
      try {
        const res = await fetch("/api/profile");
        if (res.status === 401) {
          setAuthRequired(true);
          if (!attemptedSignInRef.current) {
            attemptedSignInRef.current = true;
            login("/edit-profile");
          }
          return;
        }
        if (!res.ok) {
          throw new Error("정보를 불러올 수 없습니다.");
        }
        const data = await res.json();
        const profile = data?.profile || {};
        const birthDate = profile.birth_date
          ? formatBirthDate(profile.birth_date)
          : "";

        if (!cancelled) {
          setForm({
            name: profile.name || "",
            birthDate,
            birthTime: profile.birth_time || "모름",
            region: profile.region || "",
            gender: profile.gender || "",
            relationshipStatus: profile.relationship_status || "",
            employmentStatus: profile.employment_status || "",
            calendarType: profile.calendar_type || "solar",
          });
        }
      } catch (error: any) {
        if (!cancelled) {
          setErrorToast(error?.message || "정보를 불러오는 중 오류가 발생했습니다.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [session, status]);

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const el = e.target;
    setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 400);
  };

  const requiredErrors = useMemo(() => {
    const birthDigits = form.birthDate.replace(/\D/g, "");
    return {
      name: form.name.trim() === "",
      birthDate: birthDigits.length !== 8,
      gender: form.gender.trim() === "",
      employmentStatus: form.employmentStatus.trim() === "",
    };
  }, [form]);

  const canSave =
    !requiredErrors.name &&
    !requiredErrors.birthDate &&
    !requiredErrors.gender &&
    !requiredErrors.employmentStatus;

  const handleSave = async () => {
    setShowErrors(true);
    if (!canSave || saving) return;

    setSaving(true);
    setErrorToast(null);
    try {
      const birthDate = normalizeBirthDate(form.birthDate);
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          birthDate,
          birthTime: form.birthTime,
          region: form.region,
          gender: form.gender,
          relationshipStatus: form.relationshipStatus,
          employmentStatus: form.employmentStatus,
          calendarType: form.calendarType,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "저장에 실패했습니다.");
      }

      setToast("저장되었습니다");
      setTimeout(() => {
        router.back();
      }, 600);
    } catch (error: any) {
      setErrorToast(error?.message || "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-[100dvh] bg-background-primary text-text-primary flex flex-col overflow-hidden">
      <Header showBack title="프로필 수정" />

      <main className="px-5 pb-6 flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[640px] mx-auto space-y-7 pt-10">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-text-secondary">
              <div className="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin" />
              <p className="mt-4 text-[14px] text-text-secondary">불러오는 중...</p>
            </div>
          ) : authRequired ? (
            <div className="text-center py-24">
              <p className="text-[14px] text-text-secondary mb-6">로그인이 필요합니다.</p>
              <button
                type="button"
                onClick={() => login("/edit-profile")}
                disabled={signing}
                className="btn-primary px-6 py-3 rounded-xl text-[15px] font-semibold disabled:opacity-50"
              >
                {signing ? "로그인 중..." : "카카오로 로그인"}
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[16px] text-white mb-2">
                  이름 <span className="text-primary">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="예: 두루미"
                  className={`w-full h-[52px] text-[16px] ${showErrors && requiredErrors.name ? "input-error" : ""}`}
                  onFocus={handleInputFocus}
                />
                {showErrors && requiredErrors.name && (
                  <p className="mt-2 text-[14px] text-primary">필수 입력 항목입니다</p>
                )}
              </div>

              <div>
                <label className="block text-[16px] text-white mb-2">
                  생년월일 <span className="text-primary">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {[
                    { label: "양력", value: "solar" },
                    { label: "음력", value: "lunar" },
                  ].map((option) => {
                    const selected = form.calendarType === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setForm({ ...form, calendarType: option.value as "solar" | "lunar" })}
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
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.birthDate}
                  onChange={(e) => setForm({ ...form, birthDate: formatBirthDate(e.target.value) })}
                  placeholder="예: 1990.05.15"
                  maxLength={10}
                  className={`w-full h-[52px] text-[16px] ${showErrors && requiredErrors.birthDate ? "input-error" : ""}`}
                  onFocus={handleInputFocus}
                />
                {showErrors && requiredErrors.birthDate && (
                  <p className="mt-2 text-[14px] text-primary">필수 입력 항목입니다</p>
                )}
              </div>

              <div>
                <label className="block text-[16px] text-white mb-2">태어난 시간</label>
                <select
                  value={form.birthTime}
                  onChange={(e) => setForm({ ...form, birthTime: e.target.value })}
                  className="w-full h-[52px] text-[16px]"
                  onFocus={handleInputFocus}
                >
                  {TIME_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[16px] text-white mb-2">태어난 지역</label>
                <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="태어난 지역">
                  {REGIONS.map((region) => {
                    const selected = form.region === region;
                    return (
                      <button
                        key={region}
                        type="button"
                        onClick={() => setForm({ ...form, region })}
                        className={`h-12 rounded-xl text-[15px] font-semibold transition-colors ${
                          selected
                            ? "bg-primary text-white"
                            : "bg-background-tertiary text-text-secondary hover:bg-background-tertiary/80"
                        }`}
                        role="radio"
                        aria-checked={selected}
                      >
                        {region}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[16px] text-white mb-2">
                  성별 <span className="text-primary">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="성별">
                  {GENDERS.map((gender) => {
                    const selected = form.gender === gender;
                    return (
                      <button
                        key={gender}
                        type="button"
                        onClick={() => setForm({ ...form, gender })}
                        className={`h-12 rounded-xl text-[15px] font-semibold transition-colors ${
                          selected
                            ? "bg-primary text-white"
                            : "bg-background-tertiary text-text-secondary hover:bg-background-tertiary/80"
                        }`}
                        role="radio"
                        aria-checked={selected}
                      >
                        {gender}
                      </button>
                    );
                  })}
                </div>
                {showErrors && requiredErrors.gender && (
                  <p className="mt-2 text-[14px] text-primary">필수 입력 항목입니다</p>
                )}
              </div>

              <div>
                <label className="block text-[16px] text-white mb-2">연애 상태</label>
                <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="연애 상태">
                  {RELATIONSHIPS.map((status) => {
                    const selected = form.relationshipStatus === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setForm({ ...form, relationshipStatus: status })}
                        className={`h-12 rounded-xl text-[15px] font-semibold transition-colors ${
                          selected
                            ? "bg-primary text-white"
                            : "bg-background-tertiary text-text-secondary hover:bg-background-tertiary/80"
                        }`}
                        role="radio"
                        aria-checked={selected}
                      >
                        {status}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[16px] text-white mb-2">
                  현재 상태 <span className="text-primary">*</span>
                </label>
                <div className="space-y-3" role="radiogroup" aria-label="현재 상태">
                  {EMPLOYMENT.map((status) => {
                    const selected = form.employmentStatus === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setForm({ ...form, employmentStatus: status })}
                        className={`w-full h-12 rounded-xl text-[15px] font-semibold transition-colors ${
                          selected
                            ? "bg-primary text-white"
                            : "bg-background-tertiary text-text-secondary hover:bg-background-tertiary/80"
                        }`}
                        role="radio"
                        aria-checked={selected}
                      >
                        {status}
                      </button>
                    );
                  })}
                </div>
                {showErrors && requiredErrors.employmentStatus && (
                  <p className="mt-2 text-[14px] text-primary">필수 입력 항목입니다</p>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {!loading && session?.user && (
        <footer
          className="shrink-0 bg-[#0D0D0D] px-5 py-5"
          style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}
        >
          <div className="max-w-[640px] mx-auto">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave || saving}
              className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold disabled:cursor-not-allowed"
            >
              {saving ? "저장 중..." : "저장하기"}
            </button>
          </div>
        </footer>
      )}

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-background-tertiary text-text-primary px-4 py-2 rounded-lg text-[14px] shadow-lg">
          {toast}
        </div>
      )}
      {errorToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-background-tertiary text-primary px-4 py-2 rounded-lg text-[14px] shadow-lg">
          {errorToast}
        </div>
      )}
    </div>
  );
}
