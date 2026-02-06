"use client";

import { useEffect, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function MenuDrawer() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [hasResults, setHasResults] = useState(false);
  const [checkingResults, setCheckingResults] = useState(false);
  const [profileStatus, setProfileStatus] = useState<"unknown" | "complete" | "incomplete">("unknown");
  const drawerRef = useRef<HTMLDivElement>(null);
  const lastActiveRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!session?.user) {
      setProfileStatus("unknown");
      return;
    }

    let cancelled = false;
    const checkProfile = async () => {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) return;
        const data = await res.json();
        const profile = data?.profile || {};
        const requiredFilled = Boolean(
          profile?.name &&
          profile?.birth_date &&
          profile?.gender &&
          profile?.employment_status
        );
        if (!cancelled) {
          setProfileStatus(requiredFilled ? "complete" : "incomplete");
        }
      } catch {
        if (!cancelled) {
          setProfileStatus("incomplete");
        }
      }
    };

    checkProfile();

    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!isOpen || !session?.user) return;

    const checkResults = async () => {
      setCheckingResults(true);
      try {
        const res = await fetch("/api/results");
        if (res.ok) {
          const data = await res.json();
          setHasResults(Array.isArray(data.results) && data.results.length > 0);
        }
      } finally {
        setCheckingResults(false);
      }
    };

    checkResults();
  }, [isOpen, session]);

  useEffect(() => {
    if (!isOpen) return;

    lastActiveRef.current = document.activeElement as HTMLElement;
    const drawer = drawerRef.current;
    if (!drawer) return;

    const focusables = Array.from(
      drawer.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    );

    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      drawer.focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        return;
      }

      if (event.key === "Tab" && focusables.length > 0) {
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement;

        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      lastActiveRef.current?.focus();
    };
  }, [isOpen]);

  const closeMenu = () => setIsOpen(false);

  const handleMyResults = () => {
    closeMenu();
    router.push("/my/results");
  };

  const handleEditInfo = () => {
    closeMenu();
    router.push("/edit-profile");
  };

  return (
    <>
      <button
        type="button"
        aria-label="메뉴 열기"
        onClick={() => setIsOpen(true)}
        className="w-10 h-10 flex items-center justify-center rounded-lg text-white hover:bg-zinc-800/40 transition-colors"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 6h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={closeMenu}
            aria-label="메뉴 닫기"
          />
          <div
            ref={drawerRef}
            className="absolute right-0 top-0 h-full w-[280px] bg-zinc-900 shadow-xl transition-transform duration-300 ease-out flex flex-col border-l border-white/10"
            style={{ transform: isOpen ? "translateX(0)" : "translateX(100%)" }}
            role="dialog"
            aria-modal="true"
          >
            {session?.user ? (
              <div className="px-5 py-6 bg-zinc-800">
                <div className="text-[18px] font-semibold text-white">
                  {session.user.name || "사용자"}님
                </div>
                {profileStatus === "incomplete" && (
                  <p className="mt-2 text-[13px] text-zinc-400">
                    정보 입력이 필요합니다
                  </p>
                )}
              </div>
            ) : (
              <div className="px-5 py-6 bg-zinc-800">
                <div className="text-[18px] font-semibold text-white">로그인이 필요해요</div>
                <p className="mt-2 text-[14px] text-zinc-400">
                  내 사주 결과를 저장할 수 있어요
                </p>
              </div>
            )}

            <div className="flex-1 border-t border-white/10">
              {!session?.user && (
                <button
                  type="button"
                  onClick={() => signIn("kakao")}
                  className="mx-5 my-4 h-12 w-[calc(100%-40px)] rounded-xl bg-primary-kakao text-black text-[15px] font-semibold flex items-center justify-center gap-2"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="text-black">
                    <path
                      d="M12 4c-5.06 0-9 3.15-9 7.03 0 2.47 1.54 4.63 3.9 5.87l-.7 3.06a.5.5 0 0 0 .75.54l3.56-2.26c.5.07 1.02.1 1.55.1 5.06 0 9-3.15 9-7.03S17.06 4 12 4z"
                      fill="currentColor"
                    />
                  </svg>
                  카카오로 로그인
                </button>
              )}

              {session?.user && (
                <div className="flex flex-col h-full">
                  <div>
                    <button
                      type="button"
                      onClick={handleMyResults}
                      disabled={!hasResults || checkingResults}
                      className={`w-full text-left px-5 py-4 text-[16px] transition-colors ${
                        !hasResults || checkingResults
                          ? "text-zinc-400/50 cursor-not-allowed"
                          : "text-white hover:bg-zinc-800"
                      }`}
                    >
                      내 사주 결과
                    </button>
                    <button
                      type="button"
                      onClick={handleEditInfo}
                      className="w-full text-left px-5 py-4 text-[16px] text-white hover:bg-zinc-800 transition-colors"
                    >
                      정보 수정
                    </button>
                  </div>
                  <div className="mt-auto border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="w-full text-left px-5 py-4 text-[16px] text-zinc-400 hover:text-white"
                    >
                      로그아웃
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
