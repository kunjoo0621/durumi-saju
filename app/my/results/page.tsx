"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useKakaoLogin } from "@/hooks/useKakaoLogin";
import Image from "next/image";
import Header from "@/components/layout/Header";
import { useStoreActions } from "@/store/useInputStore";
import { getGradeColor, getGradeBadge } from "@/lib/utils/grade-colors";
import { safeDisplayGrade } from "@/lib/gradeSystem";
import type { BattleListItem } from "@/types/battle";
import { FullScreenLoading, InlineLoading } from "@/components/loading";
import Modal from "@/components/Modal";

type ResultItem = {
  id: string;
  name: string | null;
  birth_date: string | null;
  birth_time: string | null;
  region: string | null;
  gender: string | null;
  calendar_type: "solar" | "lunar" | null;
  unlocked_at: string | null;
  created_at: string | null;
  grade: string | null;
  score: number | null;
  is_primary: boolean;
};

type Tab = "saju" | "yearly" | "marriage" | "wealth" | "today" | "pet" | "battle";

const TABS: { key: Tab; label: string }[] = [
  { key: "saju", label: "내 사주" },
  { key: "yearly", label: "올해 운세" },
  { key: "marriage", label: "결혼운" },
  { key: "wealth", label: "재물운" },
  { key: "today", label: "오늘" },
  { key: "pet", label: "펫 궁합" },
  { key: "battle", label: "사주 배틀" },
];

type YearlyItem = {
  id: string;
  target_year: number;
  name: string | null;
  birth_date: string | null;
  birth_time: string | null;
  gender: string | null;
  yearly_pillar: string | null;
  created_at: string | null;
  grade: string | null;
  score: number | null;
  title: string | null;
  tenStar: string | null;
  twelveStage: string | null;
  pillarKorean: string | null;
};

type MarriageItem = {
  id: string;
  maritalStatus: string | null;
  grade: string | null; // 표시 등급 (SS/S/A/B/C)
  createdAt: string | null;
  unlocked: boolean;
};

type WealthItem = {
  id: string;
  interest: string | null;
  grade: string | null; // 표시 등급 (SS/S/A/B/C)
  createdAt: string | null;
  unlocked: boolean;
};

type TodayItem = {
  id: string;
  target_date: string;
  today_mood: string | null;
  today_weather_icon: "sun" | "cloud" | "rain" | "thunder" | null;
  ten_star: string | null;
  created_at: string | null;
};

type PetItem = {
  id: string;
  labelGrade: string | null; // S/A/B/C/D
  labelText: string | null;
  illustrationUrl: string | null;
  petName: string | null;
  petSpecies: "dog" | "cat" | string | null;
  createdAt: string | null;
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  lover: "연인",
  friend: "친구",
  colleague: "동료",
  family: "가족",
  other: "기타",
};

// 결혼운·재물운 등급은 표시 등급(SS/S/A/B/C)으로 저장됨 → 등급메달/색상 유틸이 기대하는
// 내부 등급(S/A/B/C/D)으로 역매핑. MarriageResultClient의 MARRIAGE_TO_INTERNAL_GRADE와 동일.
const DISPLAY_TO_INTERNAL: Record<string, string> = {
  SS: "S",
  S: "A",
  A: "B",
  B: "C",
  C: "D",
};

const WEATHER_LABEL: Record<string, string> = {
  sun: "맑음",
  cloud: "흐림",
  rain: "비 예보",
  thunder: "폭풍 주의",
};

const PET_SPECIES_LABEL: Record<string, string> = {
  dog: "강아지",
  cat: "고양이",
};

/* ── 날짜 포맷 ── */
function formatResultDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("ko-KR", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}.${date.getDate()}`;
  }
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
}

/* ── 시간 포맷 (24h → 오전/오후) ── */
function formatBirthTime(time: string | null): string | null {
  if (!time) return null;
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr || "00";
  if (isNaN(h)) return null;
  const period = h < 12 ? "오전" : "오후";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${period} ${h12}:${m}`;
}

/* ── 팝오버 메뉴 ── */
function PopoverMenu({
  isPrimary,
  onSetPrimary,
  onDelete,
  onClose,
}: {
  isPrimary: boolean;
  onSetPrimary: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 z-30 w-[160px] bg-[#242424] rounded-xl overflow-hidden shadow-lg"
      style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)" }}
    >
      {!isPrimary && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSetPrimary();
              onClose();
            }}
            className="w-full px-4 py-3 text-left text-[14px] text-gray-200 active:bg-white/5 transition-colors"
          >
            대표 사주로 설정
          </button>
          <div className="h-px bg-white/6 mx-3" />
        </>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
          onClose();
        }}
        className="w-full px-4 py-3 text-left text-[14px] text-red-400 active:bg-white/5 transition-colors"
      >
        삭제
      </button>
    </div>
  );
}

/* ── 삭제 확인 모달 ── */
function DeleteModal({
  onConfirm,
  onCancel,
  variant,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  variant: "normal" | "primary-has-others" | "primary-last" | "battle";
}) {
  const texts = {
    normal: {
      title: "이 사주 결과를 삭제할까?",
      desc: "삭제하면 되돌릴 수 없어.",
    },
    "primary-has-others": {
      title: "대표 사주를 삭제할까?",
      desc: "삭제하면 다른 결과가 대표로 바뀌어.",
    },
    "primary-last": {
      title: "마지막 사주 결과를 삭제할까?",
      desc: "삭제하면 결과가 전부 사라져.",
    },
    battle: {
      title: "배틀 결과를 삭제할까?",
      desc: "삭제하면 되돌릴 수 없어.",
    },
  };
  const { title, desc } = texts[variant];

  return (
    <Modal isOpen onClose={onCancel} maxWidth="320px" ariaLabel="삭제 확인">
      <div className="p-6 text-center">
        <p className="text-text-primary text-[16px] font-semibold">
          {title}
        </p>
        <p className="text-text-secondary text-[13px] mt-2">
          {desc}
        </p>
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-[48px] rounded-xl bg-white/10 text-text-primary text-[14px] font-semibold"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 h-[48px] rounded-xl bg-red-600 text-white text-[14px] font-semibold"
          >
            삭제
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ── ··· 버튼 ── */
function DotsButton({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-9 h-9 flex items-center justify-center rounded-[10px] shrink-0 active:bg-white/[0.06] transition-colors"
      style={{ color: "#4B5563" }}
      aria-label="더보기"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
        <circle cx="9" cy="3.5" r="1.5" />
        <circle cx="9" cy="9" r="1.5" />
        <circle cx="9" cy="14.5" r="1.5" />
      </svg>
    </button>
  );
}

/* ── 등급 메달 (내부 등급 기준) ── */
function GradeMedal({ grade, size = 56 }: { grade: string | null; size?: number }) {
  const gc = grade ? getGradeColor(grade) : null;
  const badgeSrc = grade ? getGradeBadge(grade) : null;
  if (badgeSrc) {
    return (
      <div
        className="rounded-[14px] flex items-center justify-center shrink-0"
        style={{ width: size, height: size, background: gc?.bg || "#2D231B" }}
      >
        <Image src={badgeSrc} alt="등급" width={30} height={30} />
      </div>
    );
  }
  return (
    <div
      className="rounded-[14px] flex items-center justify-center shrink-0 bg-white/5"
      style={{ width: size, height: size }}
    >
      <span className="text-[#4B5563] text-[14px]">?</span>
    </div>
  );
}

/* ── 잠김(미결제) 배지 ── */
function LockBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 text-[12px] font-semibold whitespace-nowrap shrink-0"
      style={{ color: "#8A8A8A" }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
      잠김 · 이어서 보기
    </span>
  );
}

/* ── 공통 빈/에러 상태 (신규 탭 재사용) ── */
function TabEmpty({ message, ctaLabel, onCta, onMenu }: { message: string; ctaLabel: string; onCta: () => void; onMenu: () => void }) {
  return (
    <div className="pt-12 flex flex-col items-center text-center space-y-6">
      <p className="text-[15px] text-text-secondary">{message}</p>
      <div className="w-full space-y-3">
        <button type="button" onClick={onCta} className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold">
          {ctaLabel}
        </button>
        <button type="button" onClick={onMenu} className="btn-secondary w-full h-[54px] rounded-xl text-[15px] font-semibold">
          메뉴로
        </button>
      </div>
    </div>
  );
}

function TabError({ message, onRetry, onMenu }: { message: string; onRetry: () => void; onMenu: () => void }) {
  return (
    <div className="pt-12 flex flex-col items-center text-center space-y-6">
      <p className="text-[15px] text-text-secondary">{message}</p>
      <div className="w-full space-y-3">
        <button type="button" onClick={onRetry} className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold">
          다시 시도
        </button>
        <button type="button" onClick={onMenu} className="btn-secondary w-full h-[54px] rounded-xl text-[15px] font-semibold">
          메뉴로
        </button>
      </div>
    </div>
  );
}

/* ── 결혼운 카드 ── */
function MarriageCard({ item }: { item: MarriageItem }) {
  const internalGrade = item.grade ? DISPLAY_TO_INTERNAL[item.grade] ?? "D" : null;
  const gc = item.grade ? getGradeColor(internalGrade || "D") : null;
  return (
    <Link
      href={`/marriage/result?id=${item.id}`}
      className="block rounded-2xl active:opacity-80 transition-opacity"
      style={{ background: "#141414" }}
    >
      <div className="py-5 px-5 flex items-center gap-4">
        <GradeMedal grade={internalGrade} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1.5">
            <span className="text-[16px] font-bold text-[#F5F5F5] tracking-tight truncate">결혼운·애정운</span>
            {item.unlocked ? (
              item.grade && (
                <span className="text-[13px] font-semibold whitespace-nowrap shrink-0" style={{ color: gc?.text || "#D0A070" }}>
                  {item.grade}등급
                </span>
              )
            ) : (
              <LockBadge />
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "#4B5563" }}>
            {item.maritalStatus && <span>{item.maritalStatus}</span>}
            {item.maritalStatus && item.createdAt && <span style={{ color: "#2A2A2A" }}>·</span>}
            {item.createdAt && <span>{formatResultDate(item.createdAt)}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ── 재물운 카드 ── */
function WealthCard({ item }: { item: WealthItem }) {
  const internalGrade = item.grade ? DISPLAY_TO_INTERNAL[item.grade] ?? "D" : null;
  const gc = item.grade ? getGradeColor(internalGrade || "D") : null;
  return (
    <Link
      href={`/wealth/result?id=${item.id}`}
      className="block rounded-2xl active:opacity-80 transition-opacity"
      style={{ background: "#141414" }}
    >
      <div className="py-5 px-5 flex items-center gap-4">
        <GradeMedal grade={internalGrade} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1.5">
            <span className="text-[16px] font-bold text-[#F5F5F5] tracking-tight truncate">재물운</span>
            {item.unlocked ? (
              item.grade && (
                <span className="text-[13px] font-semibold whitespace-nowrap shrink-0" style={{ color: gc?.text || "#D0A070" }}>
                  {item.grade}등급
                </span>
              )
            ) : (
              <LockBadge />
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "#4B5563" }}>
            {item.interest && <span>{item.interest}</span>}
            {item.interest && item.createdAt && <span style={{ color: "#2A2A2A" }}>·</span>}
            {item.createdAt && <span>{formatResultDate(item.createdAt)}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ── 오늘 카드 ── */
function todayDateLabel(targetDate: string): string {
  const [y, m, d] = targetDate.split("-").map(Number);
  if (!y || !m || !d) return targetDate;
  const dayName = ["일", "월", "화", "수", "목", "금", "토"][new Date(y, m - 1, d).getDay()];
  return `${m}월 ${d}일 (${dayName})`;
}

function TodayCard({ item }: { item: TodayItem }) {
  const icon = item.today_weather_icon;
  const weatherLabel = icon ? WEATHER_LABEL[icon] : null;
  const tenStar = item.ten_star ? item.ten_star.replace(/\([^)]*\)/g, "").trim() : null;
  return (
    <Link
      href={`/today/result/${item.id}`}
      className="block rounded-2xl active:opacity-80 transition-opacity"
      style={{ background: "#141414" }}
    >
      <div className="py-5 px-5 flex items-center gap-4">
        <div className="w-[56px] h-[56px] rounded-[14px] flex items-center justify-center shrink-0 bg-white/5">
          {icon ? (
            <img src={`/icons/weather/${icon}.svg`} alt="" aria-hidden width={34} height={34} />
          ) : (
            <span className="text-[#4B5563] text-[14px]">?</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1.5">
            <span className="text-[16px] font-bold text-[#F5F5F5] tracking-tight truncate">{todayDateLabel(item.target_date)}</span>
            {weatherLabel && (
              <span className="text-[13px] font-semibold whitespace-nowrap shrink-0" style={{ color: "#D0A070" }}>
                {weatherLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "#4B5563" }}>
            <span>오늘의 운세</span>
            {tenStar && (
              <>
                <span style={{ color: "#2A2A2A" }}>·</span>
                <span>{tenStar}운</span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ── 펫 궁합 카드 ── */
function PetCard({ item }: { item: PetItem }) {
  const speciesLabel = item.petSpecies ? PET_SPECIES_LABEL[item.petSpecies] ?? item.petSpecies : null;
  return (
    <Link
      href={`/pet/result?id=${item.id}`}
      className="block rounded-2xl active:opacity-80 transition-opacity"
      style={{ background: "#141414" }}
    >
      <div className="py-5 px-5 flex items-center gap-4">
        {item.illustrationUrl ? (
          <div className="w-[56px] h-[56px] rounded-[14px] overflow-hidden shrink-0 bg-white/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.illustrationUrl} alt="" aria-hidden className="w-full h-full object-cover" />
          </div>
        ) : (
          <GradeMedal grade={item.labelGrade} />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1.5">
            <span className="text-[16px] font-bold text-[#F5F5F5] tracking-tight truncate">
              {item.petName ? `${item.petName}와의 궁합` : "우리 아이와 궁합"}
            </span>
            {item.labelGrade && (
              <span className="text-[13px] font-semibold whitespace-nowrap shrink-0" style={{ color: getGradeColor(item.labelGrade).text }}>
                {safeDisplayGrade(item.labelGrade)}등급
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "#4B5563" }}>
            {speciesLabel && <span>{speciesLabel}</span>}
            {speciesLabel && item.createdAt && <span style={{ color: "#2A2A2A" }}>·</span>}
            {item.createdAt && <span>{formatResultDate(item.createdAt)}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ── 메인 페이지 ── */
export default function MyResultsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { login, signing } = useKakaoLogin();
  const { reset } = useStoreActions();

  const [tab, setTab] = useState<Tab>("saju");

  // Saju results state
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  // Battle results state
  const [battles, setBattles] = useState<BattleListItem[]>([]);
  const [battleLoading, setBattleLoading] = useState(false);
  const [battleError, setBattleError] = useState(false);
  const battleFetched = useRef(false);

  // Yearly results state
  const [yearlyResults, setYearlyResults] = useState<YearlyItem[]>([]);
  const [yearlyLoading, setYearlyLoading] = useState(false);
  const [yearlyError, setYearlyError] = useState(false);
  const yearlyFetched = useRef(false);

  // Marriage results state
  const [marriageResults, setMarriageResults] = useState<MarriageItem[]>([]);
  const [marriageLoading, setMarriageLoading] = useState(false);
  const [marriageError, setMarriageError] = useState(false);
  const marriageFetched = useRef(false);

  // Wealth results state
  const [wealthResults, setWealthResults] = useState<WealthItem[]>([]);
  const [wealthLoading, setWealthLoading] = useState(false);
  const [wealthError, setWealthError] = useState(false);
  const wealthFetched = useRef(false);

  // Today results state
  const [todayResults, setTodayResults] = useState<TodayItem[]>([]);
  const [todayLoading, setTodayLoading] = useState(false);
  const [todayError, setTodayError] = useState(false);
  const todayFetched = useRef(false);

  // Pet compat results state
  const [petResults, setPetResults] = useState<PetItem[]>([]);
  const [petLoading, setPetLoading] = useState(false);
  const [petError, setPetError] = useState(false);
  const petFetched = useRef(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "saju" | "battle";
    id: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Popover state
  const [popoverTarget, setPopoverTarget] = useState<string | null>(null);

  // Toast state
  const [toast, setToast] = useState<string | null>(null);

  const fetchResults = async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const res = await fetch("/api/results");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch {
      setFetchError(true);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchBattles = useCallback(async () => {
    if (battleFetched.current) return;
    setBattleLoading(true);
    setBattleError(false);
    try {
      const res = await fetch("/api/battles");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBattles(Array.isArray(data.battles) ? data.battles : []);
      battleFetched.current = true;
    } catch {
      setBattleError(true);
      setBattles([]);
    } finally {
      setBattleLoading(false);
    }
  }, []);

  const retryBattles = useCallback(async () => {
    battleFetched.current = false;
    await fetchBattles();
  }, [fetchBattles]);

  const fetchYearly = useCallback(async () => {
    if (yearlyFetched.current) return;
    setYearlyLoading(true);
    setYearlyError(false);
    try {
      const res = await fetch("/api/yearly/list");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setYearlyResults(Array.isArray(data.results) ? data.results : []);
      yearlyFetched.current = true;
    } catch {
      setYearlyError(true);
      setYearlyResults([]);
    } finally {
      setYearlyLoading(false);
    }
  }, []);

  const retryYearly = useCallback(async () => {
    yearlyFetched.current = false;
    await fetchYearly();
  }, [fetchYearly]);

  const fetchMarriage = useCallback(async () => {
    if (marriageFetched.current) return;
    setMarriageLoading(true);
    setMarriageError(false);
    try {
      const res = await fetch("/api/marriage/list");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMarriageResults(Array.isArray(data.results) ? data.results : []);
      marriageFetched.current = true;
    } catch {
      setMarriageError(true);
      setMarriageResults([]);
    } finally {
      setMarriageLoading(false);
    }
  }, []);

  const retryMarriage = useCallback(async () => {
    marriageFetched.current = false;
    await fetchMarriage();
  }, [fetchMarriage]);

  const fetchWealth = useCallback(async () => {
    if (wealthFetched.current) return;
    setWealthLoading(true);
    setWealthError(false);
    try {
      const res = await fetch("/api/wealth/list");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setWealthResults(Array.isArray(data.results) ? data.results : []);
      wealthFetched.current = true;
    } catch {
      setWealthError(true);
      setWealthResults([]);
    } finally {
      setWealthLoading(false);
    }
  }, []);

  const retryWealth = useCallback(async () => {
    wealthFetched.current = false;
    await fetchWealth();
  }, [fetchWealth]);

  const fetchToday = useCallback(async () => {
    if (todayFetched.current) return;
    setTodayLoading(true);
    setTodayError(false);
    try {
      const res = await fetch("/api/today/list");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTodayResults(Array.isArray(data.results) ? data.results : []);
      todayFetched.current = true;
    } catch {
      setTodayError(true);
      setTodayResults([]);
    } finally {
      setTodayLoading(false);
    }
  }, []);

  const retryToday = useCallback(async () => {
    todayFetched.current = false;
    await fetchToday();
  }, [fetchToday]);

  const fetchPet = useCallback(async () => {
    if (petFetched.current) return;
    setPetLoading(true);
    setPetError(false);
    try {
      const res = await fetch("/api/pet-compat/list");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPetResults(Array.isArray(data.results) ? data.results : []);
      petFetched.current = true;
    } catch {
      setPetError(true);
      setPetResults([]);
    } finally {
      setPetLoading(false);
    }
  }, []);

  const retryPet = useCallback(async () => {
    petFetched.current = false;
    await fetchPet();
  }, [fetchPet]);

  useEffect(() => {
    if (!session?.user) {
      setLoading(false);
      return;
    }
    fetchResults();
  }, [session]);

  useEffect(() => {
    if (!session?.user) return;
    if (tab === "battle") fetchBattles();
    if (tab === "yearly") fetchYearly();
    if (tab === "marriage") fetchMarriage();
    if (tab === "wealth") fetchWealth();
    if (tab === "today") fetchToday();
    if (tab === "pet") fetchPet();
  }, [tab, session, fetchBattles, fetchYearly, fetchMarriage, fetchWealth, fetchToday, fetchPet]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const endpoint =
        deleteTarget.type === "saju"
          ? `/api/results/${deleteTarget.id}`
          : `/api/battles/${deleteTarget.id}`;
      console.log("[handleDelete]", { type: deleteTarget.type, id: deleteTarget.id, endpoint });
      const res = await fetch(endpoint, { method: "DELETE" });
      console.log("[handleDelete] response:", res.status, res.ok);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("[handleDelete] error body:", body);
        throw new Error(body?.error || "삭제 실패");
      }

      if (deleteTarget.type === "saju") {
        setResults((prev) => {
          const filtered = prev.filter((r) => r.id !== deleteTarget.id);
          // 대표 삭제 시 서버가 승계 처리 → 다음 fetch에서 반영됨
          // 로컬에서도 즉시 반영: 삭제된 게 대표였으면 첫 번째 결과를 대표로
          const deletedWasPrimary = prev.find((r) => r.id === deleteTarget.id)?.is_primary;
          if (deletedWasPrimary && filtered.length > 0) {
            return filtered.map((r, i) => ({ ...r, is_primary: i === 0 }));
          }
          return filtered;
        });
      } else {
        setBattles((prev) => prev.filter((b) => b.id !== deleteTarget.id));
      }

      const msg = deleteTarget.type === "saju" ? "결과가 삭제됐어" : "배틀이 삭제됐어";
      setToast(msg);
      setTimeout(() => setToast(null), 2000);
    } catch (err: any) {
      alert(err?.message || "삭제에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleSetPrimary = async (resultId: string) => {
    try {
      const res = await fetch("/api/results/primary", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId }),
      });
      if (!res.ok) throw new Error();
      setResults((prev) =>
        prev.map((r) => ({ ...r, is_primary: r.id === resultId }))
      );
    } catch {
      alert("대표 사주 설정에 실패했습니다.");
    }
  };

  const handleAddAnother = () => {
    reset();
    router.push("/start");
  };

  if (status === "loading" || loading) {
    return <FullScreenLoading message="불러오는 중..." />;
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-background-primary flex flex-col">
        <Header sticky title="내 결과" />
        <main className="flex-1 px-5 pb-24 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-text-secondary">로그인하면 저장된 결과를 볼 수 있어</p>
            <button
              onClick={() => login("/my/results")}
              disabled={signing}
              className="w-full h-[54px] rounded-xl bg-[#FEE500] text-black text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              카카오로 시작하기
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-primary flex flex-col">
      <Header showBack sticky title="내 결과" onBack={() => router.push("/menu")} />

      {/* Tabs — 가로 스크롤 칩 (서비스 7종) */}
      <div className="max-w-[640px] mx-auto w-full">
        <div className="flex border-b border-white/10 overflow-x-auto scrollbar-hide px-5">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`shrink-0 px-4 py-3 text-center text-[14px] font-semibold whitespace-nowrap transition-colors ${
                tab === t.key
                  ? "text-white border-b-2 border-[#FF6B6B]"
                  : "text-gray-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 px-5 pb-24">
        <div className="max-w-[640px] mx-auto pt-6 space-y-4">
          {/* ===== 내 사주 탭 ===== */}
          {tab === "saju" && (
            <>
              {results.length > 0 && (
                <div className="space-y-3">
                  {results.map((item) => {
                    const gc = item.grade ? getGradeColor(item.grade) : null;
                    const badgeSrc = item.grade ? getGradeBadge(item.grade) : null;
                    const birthTime = formatBirthTime(item.birth_time);

                    return (
                      <div
                        key={item.id}
                        className="relative rounded-2xl flex items-center active:opacity-80 transition-opacity"
                        style={{ background: "#141414" }}
                      >
                        <Link
                          href={`/result?resultId=${item.id}`}
                          className="flex-1 min-w-0 py-5 pl-5 pr-2 flex items-center gap-4"
                        >
                          {/* 등급 메달 */}
                          {badgeSrc ? (
                            <div
                              className="w-[56px] h-[56px] rounded-[14px] flex items-center justify-center shrink-0"
                              style={{ background: gc?.bg || "#2D231B" }}
                            >
                              <Image
                                src={badgeSrc}
                                alt={`${safeDisplayGrade(item.grade)}등급`}
                                width={30}
                                height={30}
                              />
                            </div>
                          ) : (
                            <div className="w-[56px] h-[56px] rounded-[14px] flex items-center justify-center shrink-0 bg-white/5">
                              <span className="text-[#4B5563] text-[14px]">?</span>
                            </div>
                          )}

                          {/* 정보 영역 */}
                          <div className="flex-1 min-w-0">
                            {/* 1줄: 이름 + 등급 */}
                            <div className="flex items-baseline gap-2 mb-1.5">
                              <span className="text-[16px] font-bold text-[#F5F5F5] tracking-tight truncate">
                                {item.name || `사주 #${item.id.slice(0, 6)}`}
                              </span>
                              {item.grade && (
                                <span
                                  className="text-[13px] font-semibold whitespace-nowrap shrink-0"
                                  style={{ color: gc?.text || "#D0A070" }}
                                >
                                  {safeDisplayGrade(item.grade)}등급{item.score != null ? ` · ${item.score}점` : ""}
                                </span>
                              )}
                            </div>
                            {/* 2줄: 메타 */}
                            <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "#4B5563" }}>
                              {item.birth_date && (
                                <span>{item.birth_date.replace(/-/g, ".")}</span>
                              )}
                              {item.gender && (
                                <>
                                  <span style={{ color: "#2A2A2A" }}>·</span>
                                  <span>{item.gender}</span>
                                </>
                              )}
                              {birthTime && (
                                <>
                                  <span style={{ color: "#2A2A2A" }}>·</span>
                                  <span>{birthTime}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* 대표 뱃지 */}
                          {item.is_primary && (
                            <span
                              className="text-[11px] font-bold px-2.5 py-[3px] rounded-[6px] shrink-0"
                              style={{ background: "rgba(255,107,107,0.12)", color: "#FF6B6B" }}
                            >
                              대표
                            </span>
                          )}
                        </Link>

                        {/* ··· 버튼 (Link 바깥) */}
                        <div className="relative shrink-0 pr-5">
                          <DotsButton
                            onClick={(e) => {
                              e.stopPropagation();
                              setPopoverTarget(popoverTarget === item.id ? null : item.id);
                            }}
                          />
                          {popoverTarget === item.id && (
                            <PopoverMenu
                              isPrimary={item.is_primary}
                              onSetPrimary={() => handleSetPrimary(item.id)}
                              onDelete={() => setDeleteTarget({ type: "saju", id: item.id })}
                              onClose={() => setPopoverTarget(null)}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}


              {!fetchError && results.length === 0 && (
                <div className="pt-12 flex flex-col items-center text-center space-y-6">
                  <p className="text-[15px] text-text-secondary">
                    아직 결과가 없어
                  </p>
                  <div className="w-full space-y-3">
                    <button
                      type="button"
                      onClick={handleAddAnother}
                      className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold"
                    >
                      사주 보러가기
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/menu")}
                      className="btn-secondary w-full h-[54px] rounded-xl text-[15px] font-semibold"
                    >
                      메뉴로
                    </button>
                  </div>
                </div>
              )}

              {fetchError && (
                <div className="pt-12 flex flex-col items-center text-center space-y-6">
                  <p className="text-[15px] text-text-secondary">
                    사주 내역을 못 불러왔어
                  </p>
                  <div className="w-full space-y-3">
                    <button
                      type="button"
                      onClick={fetchResults}
                      className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold"
                    >
                      다시 시도
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/menu")}
                      className="btn-secondary w-full h-[54px] rounded-xl text-[15px] font-semibold"
                    >
                      메뉴로
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ===== 올해 운세 탭 ===== */}
          {tab === "yearly" && (
            <>
              {yearlyLoading && <InlineLoading message="불러오는 중..." />}

              {!yearlyLoading && !yearlyError && yearlyResults.length > 0 && (
                <div className="space-y-3">
                  {yearlyResults.map((y) => {
                    const gc = y.grade ? getGradeColor(y.grade) : null;
                    const badgeSrc = y.grade ? getGradeBadge(y.grade) : null;
                    const birthTime = formatBirthTime(y.birth_time);

                    return (
                      <Link
                        key={y.id}
                        href={`/yearly/result/${y.id}`}
                        className="block rounded-2xl active:opacity-80 transition-opacity"
                        style={{ background: "#141414" }}
                      >
                        <div className="py-5 px-5 flex items-center gap-4">
                          {/* 등급 메달 */}
                          {badgeSrc ? (
                            <div
                              className="w-[56px] h-[56px] rounded-[14px] flex items-center justify-center shrink-0"
                              style={{ background: gc?.bg || "#2D231B" }}
                            >
                              <Image src={badgeSrc} alt={`${safeDisplayGrade(y.grade)}등급`} width={30} height={30} />
                            </div>
                          ) : (
                            <div className="w-[56px] h-[56px] rounded-[14px] flex items-center justify-center shrink-0 bg-white/5">
                              <span className="text-[#4B5563] text-[14px]">?</span>
                            </div>
                          )}

                          {/* 정보 영역 */}
                          <div className="flex-1 min-w-0">
                            {/* 1줄: 이름 + 연도 */}
                            <div className="flex items-baseline gap-2 mb-1.5">
                              <span className="text-[16px] font-bold text-[#F5F5F5] tracking-tight truncate">
                                {y.name || "올해 운세"}
                              </span>
                              <span
                                className="text-[13px] font-semibold whitespace-nowrap shrink-0"
                                style={{ color: gc?.text || "#D0A070" }}
                              >
                                {y.target_year}년
                              </span>
                            </div>
                            {/* 2줄: 메타 (천간지지·십성·12운성) */}
                            <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "#4B5563" }}>
                              {y.pillarKorean && <span>{y.pillarKorean}</span>}
                              {y.tenStar && (
                                <>
                                  <span style={{ color: "#2A2A2A" }}>·</span>
                                  <span>{y.tenStar}운</span>
                                </>
                              )}
                              {y.twelveStage && (
                                <>
                                  <span style={{ color: "#2A2A2A" }}>·</span>
                                  <span>{y.twelveStage}</span>
                                </>
                              )}
                            </div>
                            {/* 3줄: 생년월일 */}
                            {y.birth_date && (
                              <div className="flex items-center gap-1.5 text-[11px] mt-1" style={{ color: "#3A3A3A" }}>
                                <span>{y.birth_date.replace(/-/g, ".")}</span>
                                {y.gender && (
                                  <>
                                    <span>·</span>
                                    <span>{y.gender}</span>
                                  </>
                                )}
                                {birthTime && (
                                  <>
                                    <span>·</span>
                                    <span>{birthTime}</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

              {!yearlyLoading && !yearlyError && yearlyResults.length === 0 && (
                <div className="pt-12 flex flex-col items-center text-center space-y-6">
                  <p className="text-[15px] text-text-secondary">
                    아직 올해 운세 결과가 없어
                  </p>
                  <div className="w-full space-y-3">
                    <button
                      type="button"
                      onClick={() => router.push("/yearly")}
                      className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold"
                    >
                      올해 운세 보러가기
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/menu")}
                      className="btn-secondary w-full h-[54px] rounded-xl text-[15px] font-semibold"
                    >
                      메뉴로
                    </button>
                  </div>
                </div>
              )}

              {!yearlyLoading && yearlyError && (
                <div className="pt-12 flex flex-col items-center text-center space-y-6">
                  <p className="text-[15px] text-text-secondary">
                    올해 운세 내역을 못 불러왔어
                  </p>
                  <div className="w-full space-y-3">
                    <button
                      type="button"
                      onClick={retryYearly}
                      className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold"
                    >
                      다시 시도
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/menu")}
                      className="btn-secondary w-full h-[54px] rounded-xl text-[15px] font-semibold"
                    >
                      메뉴로
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ===== 결혼운 탭 ===== */}
          {tab === "marriage" && (
            <>
              {marriageLoading && <InlineLoading message="불러오는 중..." />}
              {!marriageLoading && !marriageError && marriageResults.length > 0 && (
                <div className="space-y-3">
                  {marriageResults.map((m) => (
                    <MarriageCard key={m.id} item={m} />
                  ))}
                </div>
              )}
              {!marriageLoading && !marriageError && marriageResults.length === 0 && (
                <TabEmpty
                  message="아직 결혼운 결과가 없어"
                  ctaLabel="결혼운 보러가기"
                  onCta={() => router.push("/marriage")}
                  onMenu={() => router.push("/menu")}
                />
              )}
              {!marriageLoading && marriageError && (
                <TabError message="결혼운 내역을 못 불러왔어" onRetry={retryMarriage} onMenu={() => router.push("/menu")} />
              )}
            </>
          )}

          {/* ===== 재물운 탭 ===== */}
          {tab === "wealth" && (
            <>
              {wealthLoading && <InlineLoading message="불러오는 중..." />}
              {!wealthLoading && !wealthError && wealthResults.length > 0 && (
                <div className="space-y-3">
                  {wealthResults.map((w) => (
                    <WealthCard key={w.id} item={w} />
                  ))}
                </div>
              )}
              {!wealthLoading && !wealthError && wealthResults.length === 0 && (
                <TabEmpty
                  message="아직 재물운 결과가 없어"
                  ctaLabel="재물운 보러가기"
                  onCta={() => router.push("/wealth")}
                  onMenu={() => router.push("/menu")}
                />
              )}
              {!wealthLoading && wealthError && (
                <TabError message="재물운 내역을 못 불러왔어" onRetry={retryWealth} onMenu={() => router.push("/menu")} />
              )}
            </>
          )}

          {/* ===== 오늘 탭 ===== */}
          {tab === "today" && (
            <>
              {todayLoading && <InlineLoading message="불러오는 중..." />}
              {!todayLoading && !todayError && todayResults.length > 0 && (
                <div className="space-y-3">
                  {todayResults.map((t) => (
                    <TodayCard key={t.id} item={t} />
                  ))}
                </div>
              )}
              {!todayLoading && !todayError && todayResults.length === 0 && (
                <TabEmpty
                  message="아직 오늘의 운세 결과가 없어"
                  ctaLabel="오늘의 운세 보러가기"
                  onCta={() => router.push("/today")}
                  onMenu={() => router.push("/menu")}
                />
              )}
              {!todayLoading && todayError && (
                <TabError message="오늘의 운세 내역을 못 불러왔어" onRetry={retryToday} onMenu={() => router.push("/menu")} />
              )}
            </>
          )}

          {/* ===== 펫 궁합 탭 ===== */}
          {tab === "pet" && (
            <>
              {petLoading && <InlineLoading message="불러오는 중..." />}
              {!petLoading && !petError && petResults.length > 0 && (
                <div className="space-y-3">
                  {petResults.map((p) => (
                    <PetCard key={p.id} item={p} />
                  ))}
                </div>
              )}
              {!petLoading && !petError && petResults.length === 0 && (
                <TabEmpty
                  message="아직 펫 궁합 결과가 없어"
                  ctaLabel="펫 궁합 보러가기"
                  onCta={() => router.push("/pet/input")}
                  onMenu={() => router.push("/menu")}
                />
              )}
              {!petLoading && petError && (
                <TabError message="펫 궁합 내역을 못 불러왔어" onRetry={retryPet} onMenu={() => router.push("/menu")} />
              )}
            </>
          )}

          {/* ===== 사주 배틀 탭 ===== */}
          {tab === "battle" && (
            <>
              {battleLoading && (
                <InlineLoading message="불러오는 중..." />
              )}

              {!battleLoading && !battleError && battles.length > 0 && (
                <div className="space-y-3">
                  {battles.map((b) => {
                    const isWinnerA = b.overall_winner === "A";
                    const isDraw = b.overall_winner === "draw";
                    const gcA = getGradeColor(b.player_a_grade);
                    const gcB = getGradeColor(b.player_b_grade);
                    const badgeA = getGradeBadge(b.player_a_grade);
                    const badgeB = getGradeBadge(b.player_b_grade);
                    const winnerName = isDraw ? null : isWinnerA ? b.player_a_name : b.player_b_name;

                    const intensityLabel =
                      b.overall_intensity === "무승부" ? "무승부"
                        : `${winnerName}의 ${b.overall_intensity}`;

                    return (
                      <div
                        key={b.id}
                        className="relative rounded-2xl flex items-center active:opacity-80 transition-opacity"
                        style={{ background: "#141414" }}
                      >
                        <Link
                          href={`/battle/result?id=${b.id}`}
                          className="flex-1 min-w-0 py-5 pl-5 pr-2 flex items-center gap-4"
                        >
                          {/* 배지 메인+서브 겹침 */}
                          <div className="relative w-[56px] h-[56px] shrink-0">
                            <div
                              className="w-[56px] h-[56px] rounded-[14px] flex items-center justify-center"
                              style={{ background: gcA.bg }}
                            >
                              <Image src={badgeA} alt={`${safeDisplayGrade(b.player_a_grade)}등급`} width={30} height={30} />
                            </div>
                            <div
                              className="absolute -right-1.5 -bottom-1.5 w-[28px] h-[28px] rounded-[8px] flex items-center justify-center ring-2 ring-[#141414]"
                              style={{ background: gcB.bg }}
                            >
                              <Image src={badgeB} alt={`${safeDisplayGrade(b.player_b_grade)}등급`} width={16} height={16} />
                            </div>
                          </div>

                          {/* 정보 영역 */}
                          <div className="flex-1 min-w-0">
                            {/* 1줄: 이름 */}
                            <div className="flex items-baseline gap-2 mb-1.5">
                              <span className="text-[16px] font-bold text-[#F5F5F5] tracking-tight truncate">
                                {b.player_a_name} vs {b.player_b_name}
                              </span>
                            </div>
                            {/* 2줄: 메타 */}
                            <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "#4B5563" }}>
                              <span>{RELATIONSHIP_LABELS[b.relationship_type] || "기타"}</span>
                              <span style={{ color: "#2A2A2A" }}>·</span>
                              <span>{intensityLabel}</span>
                              <span style={{ color: "#2A2A2A" }}>·</span>
                              <span>{b.wins_a}:{b.wins_b}</span>
                            </div>
                          </div>
                        </Link>

                        {/* ··· 버튼 (Link 바깥) */}
                        <div className="relative shrink-0 pr-5">
                          <DotsButton
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget({ type: "battle", id: b.id });
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {!battleLoading && !battleError && battles.length === 0 && (
                <div className="pt-12 flex flex-col items-center text-center space-y-6">
                  <p className="text-[15px] text-text-secondary">
                    아직 배틀 기록이 없어
                  </p>
                  <div className="w-full space-y-3">
                    <button
                      type="button"
                      onClick={() => router.push("/battle/input")}
                      className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold"
                    >
                      사주 배틀 하러가기
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/menu")}
                      className="btn-secondary w-full h-[54px] rounded-xl text-[15px] font-semibold"
                    >
                      메뉴로
                    </button>
                  </div>
                </div>
              )}

              {!battleLoading && battleError && (
                <div className="pt-12 flex flex-col items-center text-center space-y-6">
                  <p className="text-[15px] text-text-secondary">
                    배틀 내역을 못 불러왔어
                  </p>
                  <div className="w-full space-y-3">
                    <button
                      type="button"
                      onClick={retryBattles}
                      className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold"
                    >
                      다시 시도
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/menu")}
                      className="btn-secondary w-full h-[54px] rounded-xl text-[15px] font-semibold"
                    >
                      메뉴로
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* 하단 플로팅 CTA */}
      {tab === "saju" && results.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-[130] border-t border-white/10 bg-black/45 px-5 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))] backdrop-blur-xl">
          <div className="max-w-[640px] mx-auto">
            <button
              type="button"
              onClick={handleAddAnother}
              className="btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold"
            >
              다른 사람 사주 추가하기
            </button>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <DeleteModal
          onConfirm={handleDelete}
          onCancel={() => !deleting && setDeleteTarget(null)}
          variant={
            deleteTarget.type === "battle"
              ? "battle"
              : (() => {
                  const target = results.find((r) => r.id === deleteTarget.id);
                  if (!target?.is_primary) return "normal";
                  return results.length <= 1 ? "primary-last" : "primary-has-others";
                })()
          }
        />
      )}

      {/* 삭제 완료 토스트 */}
      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[200] bg-background-tertiary text-text-primary px-4 py-2 rounded-lg text-[14px] shadow-lg transition-opacity duration-300">
          {toast}
        </div>
      )}
    </div>
  );
}
