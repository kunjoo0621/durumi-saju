"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useKakaoLogin } from "@/hooks/useKakaoLogin";
import { X } from "@phosphor-icons/react";

export default function MenuDrawer() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { login, signing } = useKakaoLogin();
  const [isOpen, setIsOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const lastActiveRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    lastActiveRef.current = document.activeElement as HTMLElement;
    const modal = modalRef.current;
    if (!modal) return;

    const focusables = Array.from(
      modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    );

    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      modal.focus();
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

  const handleLogout = () => {
    closeMenu();
    signOut({ callbackUrl: "/" });
  };

  const handleKakaoLogin = () => {
    closeMenu();
    login();
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

      {isOpen && createPortal(
        <div className="fixed inset-0 z-[200]">
          {/* 오버레이 */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-[4px] animate-fadeIn"
            onClick={closeMenu}
          />

          {/* 모달 센터 */}
          <div className="absolute inset-0 flex items-center justify-center p-6" onClick={closeMenu}>
            <div
              ref={modalRef}
              className="w-full max-w-[320px] bg-[#1A1A1A] rounded-3xl overflow-hidden animate-[modalIn_0.25s_cubic-bezier(0.16,1,0.3,1)]"
              style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)' }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              {status === "loading" ? (
                <div className="px-6 py-8">
                  <div className="h-5 w-24 bg-zinc-700 rounded animate-pulse" />
                </div>
              ) : session?.user ? (
                <>
                  {/* 헤더 */}
                  <div className="flex items-center justify-between px-6 pt-6">
                    <span className="text-[19px] font-extrabold tracking-tight">메뉴</span>
                    <button
                      onClick={closeMenu}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                      style={{ background: 'rgba(255,255,255,0.06)' }}
                    >
                      <X size={15} weight="bold" className="text-gray-500" />
                    </button>
                  </div>

                  <div className="h-2" />
                  <div className="h-px mx-5" style={{ background: 'rgba(255,255,255,0.06)' }} />

                  {/* 내 사주 결과 */}
                  <div className="px-1 py-1">
                    <button
                      onClick={() => { closeMenu(); router.push('/my/results'); }}
                      className="w-full flex items-center gap-3.5 px-5 py-3.5 rounded-[14px] active:bg-white/[0.04] transition-colors"
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(255,107,107,0.1)' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                          <line x1="16" y1="13" x2="8" y2="13"/>
                          <line x1="16" y1="17" x2="8" y2="17"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="text-[15px] font-semibold text-gray-200">내 사주 결과</div>
                        <div className="text-xs text-gray-600 mt-0.5">이전에 본 결과 다시 보기</div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round">
                        <path d="M9 6l6 6-6 6"/>
                      </svg>
                    </button>
                  </div>

                  <div className="h-px mx-5" style={{ background: 'rgba(255,255,255,0.06)' }} />

                  {/* 하단: 로그아웃 + 버전 */}
                  <div className="flex items-center justify-between px-6 py-2 pb-[22px]">
                    <button
                      onClick={handleLogout}
                      className="text-[13px] text-gray-700 py-1.5 active:text-gray-500 transition-colors"
                    >
                      로그아웃
                    </button>
                    <span className="text-[11px] text-neutral-800">v1.0</span>
                  </div>
                </>
              ) : (
                <>
                  {/* 비로그인: 헤더 */}
                  <div className="flex items-center justify-between px-6 pt-6">
                    <span className="text-[19px] font-extrabold tracking-tight">메뉴</span>
                    <button
                      onClick={closeMenu}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                      style={{ background: 'rgba(255,255,255,0.06)' }}
                    >
                      <X size={15} weight="bold" className="text-gray-500" />
                    </button>
                  </div>

                  {/* 카카오 로그인 CTA */}
                  <div className="mx-5 mt-6">
                    <button
                      onClick={handleKakaoLogin}
                      disabled={signing}
                      className="w-full py-4 rounded-[14px] bg-[#FEE500] text-[#191600] text-[15px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] active:opacity-90 transition-all disabled:opacity-50"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3C6.5 3 2 6.58 2 11c0 2.83 1.88 5.32 4.7 6.73-.16.58-.6 2.1-.69 2.43-.11.4.15.39.31.28.13-.08 2.05-1.36 2.88-1.91.57.09 1.17.14 1.8.14 5.5 0 10-3.58 10-8S17.5 3 12 3z"/>
                      </svg>
                      카카오로 시작하기
                    </button>
                  </div>
                  <p className="text-[13px] text-gray-600 text-center pt-3 pb-6">
                    로그인하면 결과가 저장돼
                  </p>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
