"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useKakaoLogin } from "@/hooks/useKakaoLogin";
import Image from "next/image";
import Header from "@/components/layout/Header";
import { useStoreActions } from "@/store/useInputStore";
import { getGradeColor, getGradeBadge } from "@/lib/utils/grade-colors";
import type { BattleListItem } from "@/types/battle";

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

type Tab = "saju" | "battle";

const RELATIONSHIP_LABELS: Record<string, string> = {
  lover: "연인",
  friend: "친구",
  colleague: "동료",
  family: "가족",
  other: "기타",
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
            onClick={() => {
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
        onClick={() => {
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
      <div className="bg-[#1C1C1C] rounded-2xl p-6 mx-6 w-full max-w-[320px] text-center">
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
    </div>
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

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "saju" | "battle";
    id: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Popover state
  const [popoverTarget, setPopoverTarget] = useState<string | null>(null);

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

  useEffect(() => {
    if (!session?.user) {
      setLoading(false);
      return;
    }
    fetchResults();
  }, [session]);

  useEffect(() => {
    if (tab === "battle" && session?.user) {
      fetchBattles();
    }
  }, [tab, session, fetchBattles]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const endpoint =
        deleteTarget.type === "saju"
          ? `/api/results/${deleteTarget.id}`
          : `/api/battles/${deleteTarget.id}`;
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
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
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center px-5">
        <div className="text-text-secondary text-[14px]">불러오는 중...</div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-background-primary flex flex-col">
        <Header sticky title="내 결과" />
        <main className="flex-1 px-5 pb-24 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-text-secondary">로그인하면 저장된 결과를 확인할 수 있어요.</p>
            <button
              onClick={() => login("/menu")}
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

      {/* Tabs */}
      <div className="max-w-[640px] mx-auto w-full px-5">
        <div className="flex border-b border-white/10">
          <button
            type="button"
            onClick={() => setTab("saju")}
            className={`flex-1 py-3 text-center text-[14px] font-semibold transition-colors ${
              tab === "saju"
                ? "text-white border-b-2 border-[#FF6B6B]"
                : "text-gray-500"
            }`}
          >
            내 사주
          </button>
          <button
            type="button"
            onClick={() => setTab("battle")}
            className={`flex-1 py-3 text-center text-[14px] font-semibold transition-colors ${
              tab === "battle"
                ? "text-white border-b-2 border-[#FF6B6B]"
                : "text-gray-500"
            }`}
          >
            사주 배틀
          </button>
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
                        className="rounded-2xl p-5 flex items-center gap-4 cursor-pointer active:opacity-80 transition-opacity"
                        style={{ background: "#141414" }}
                        onClick={() => router.push(`/result?resultId=${item.id}`)}
                        role="button"
                        tabIndex={0}
                      >
                        {/* 등급 메달 */}
                        {badgeSrc ? (
                          <div
                            className="w-[56px] h-[56px] rounded-[14px] flex items-center justify-center shrink-0"
                            style={{ background: gc?.bg || "rgba(184,122,64,0.15)" }}
                          >
                            <Image
                              src={badgeSrc}
                              alt={`${item.grade}등급`}
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
                                {item.grade}등급{item.score != null ? ` · ${item.score}점` : ""}
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
                            className="text-[11px] font-bold px-2.5 py-[3px] rounded-[6px] shrink-0 mr-1"
                            style={{ background: "rgba(255,107,107,0.12)", color: "#FF6B6B" }}
                          >
                            대표
                          </span>
                        )}

                        {/* ··· 버튼 */}
                        <div className="relative shrink-0">
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
                      className="w-full h-[54px] rounded-xl text-[15px] font-semibold text-gray-300 bg-white/10"
                    >
                      메뉴로
                    </button>
                  </div>
                </div>
              )}

              {fetchError && (
                <div className="pt-12 flex flex-col items-center text-center space-y-6">
                  <p className="text-[15px] text-text-secondary">
                    사주 내역을 불러오지 못했어요.
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
                      className="w-full h-[54px] rounded-xl text-[15px] font-semibold text-gray-300 bg-white/10"
                    >
                      메뉴로
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ===== 사주 배틀 탭 ===== */}
          {tab === "battle" && (
            <>
              {battleLoading && (
                <div className="pt-12 flex items-center justify-center">
                  <div className="text-text-secondary text-[14px]">불러오는 중...</div>
                </div>
              )}

              {!battleLoading && !battleError && battles.length > 0 && (
                <div className="space-y-3">
                  {battles.map((b) => {
                    const isWinnerA = b.overall_winner === "A";
                    const isDraw = b.overall_winner === "draw";
                    const winnerGrade = isDraw
                      ? b.player_a_grade
                      : isWinnerA
                        ? b.player_a_grade
                        : b.player_b_grade;
                    const winnerColor = getGradeColor(winnerGrade);
                    const winnerBadge = getGradeBadge(winnerGrade);
                    const dateStr = b.created_at;

                    return (
                      <div key={b.id} className="relative rounded-xl bg-[#141414]">
                        <div className="flex items-center">
                          <button
                            type="button"
                            onClick={() => router.push(`/battle/result?id=${b.id}`)}
                            className="flex-1 flex items-center gap-3 p-4 text-left active:bg-white/5 transition-colors min-w-0"
                          >
                            {/* 승자 배지 */}
                            <div
                              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: winnerColor.bg }}
                            >
                              <Image
                                src={winnerBadge}
                                alt={`${winnerGrade}등급`}
                                width={32}
                                height={32}
                              />
                            </div>

                            {/* 텍스트 */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-text-primary font-semibold text-[15px] truncate">
                                  {b.player_a_name} vs {b.player_b_name}
                                </span>
                                <span className="text-text-tertiary text-[12px] flex-shrink-0 ml-2">
                                  {dateStr ? formatResultDate(dateStr) : ""}
                                </span>
                              </div>
                              <div className="flex items-center mt-0.5">
                                <span className="text-[13px] text-text-secondary">
                                  {b.player_a_grade}등급 vs {b.player_b_grade}등급
                                </span>
                              </div>
                              <div className="text-text-secondary text-[12px] mt-0.5">
                                {RELATIONSHIP_LABELS[b.relationship_type] || "기타"}
                                {" · "}
                                {b.wins_a}:{b.wins_b}
                                {" "}
                                {b.overall_intensity}
                              </div>
                            </div>
                          </button>

                          {/* ··· 버튼 (배틀은 삭제만) */}
                          <div className="relative pr-2">
                            <DotsButton
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget({ type: "battle", id: b.id });
                              }}
                            />
                          </div>
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
                      className="w-full h-[54px] rounded-xl text-[15px] font-semibold text-gray-300 bg-white/10"
                    >
                      메뉴로
                    </button>
                  </div>
                </div>
              )}

              {!battleLoading && battleError && (
                <div className="pt-12 flex flex-col items-center text-center space-y-6">
                  <p className="text-[15px] text-text-secondary">
                    배틀 내역을 불러오지 못했어요.
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
                      className="w-full h-[54px] rounded-xl text-[15px] font-semibold text-gray-300 bg-white/10"
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
    </div>
  );
}
