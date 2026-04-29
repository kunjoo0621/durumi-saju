"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useKakaoLogin } from "@/hooks/useKakaoLogin";
import { X, Egg, BookOpenText, Sparkle, Sword } from "@phosphor-icons/react";
import { SkeletonBar } from "@/components/loading";
import Modal, { ModalDivider } from "@/components/Modal";

type MenuItemProps = {
  href: string;
  title: string;
  subtitle: string;
  iconBg: string;
  iconColor: string;
  Icon: typeof Egg;
  iconWeight?: "regular" | "fill" | "duotone";
  onClick: () => void;
};

function MenuItem({
  href,
  title,
  subtitle,
  iconBg,
  iconColor,
  Icon,
  iconWeight = "duotone",
  onClick,
}: MenuItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="w-full flex items-center gap-3.5 px-5 py-3.5 rounded-[14px] hover:bg-white/[0.03] active:bg-white/[0.05] transition-colors"
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: iconBg }}
      >
        <Icon size={20} weight={iconWeight} color={iconColor} />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="text-[16px] font-semibold text-text-primary">{title}</div>
        <div className="text-[13px] text-text-tertiary mt-0.5">{subtitle}</div>
      </div>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="text-text-tertiary"
        aria-hidden="true"
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </Link>
  );
}

export default function MenuDrawer() {
  const { data: session, status } = useSession();
  const { login, signing } = useKakaoLogin();
  const [isOpen, setIsOpen] = useState(false);

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

      <Modal isOpen={isOpen} onClose={closeMenu} maxWidth="360px" ariaLabel="메뉴">
        {status === "loading" ? (
          <div className="px-6 py-8">
            <SkeletonBar />
          </div>
        ) : session?.user ? (
          <>
            <div className="flex items-center justify-between px-6 pt-6">
              <span className="text-[19px] font-extrabold tracking-tight">메뉴</span>
              <button
                onClick={closeMenu}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                style={{ background: "rgba(255,255,255,0.06)" }}
                aria-label="닫기"
              >
                <X size={15} weight="bold" className="text-text-tertiary" />
              </button>
            </div>

            <div className="h-2" />
            <ModalDivider />

            <div className="px-1 py-1">
              <Link
                href="/my/results"
                onClick={closeMenu}
                className="w-full flex items-center gap-3.5 px-5 py-3.5 rounded-[14px] hover:bg-white/[0.03] active:bg-white/[0.05] transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(255,107,107,0.1)" }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#FF6B6B"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-[16px] font-semibold text-text-primary">
                    내 사주 결과
                  </div>
                  <div className="text-[13px] text-text-tertiary mt-0.5">
                    이전에 본 결과 다시 보기
                  </div>
                </div>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="text-text-tertiary"
                  aria-hidden="true"
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>

              <MenuItem
                href="/dict"
                title="사주 사전"
                subtitle="60갑자·천간지지·신살 정리"
                iconBg="rgba(129, 140, 248, 0.12)"
                iconColor="#818CF8"
                Icon={BookOpenText}
                onClick={closeMenu}
              />

              <Link
                href="/coins"
                onClick={closeMenu}
                className="w-full flex items-center gap-3.5 px-5 py-3.5 rounded-[14px] hover:bg-white/[0.03] active:bg-white/[0.05] transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(234,179,8,0.1)" }}
                >
                  <Egg size={20} weight="fill" className="text-saju-earth-muted" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-[16px] font-semibold text-text-primary">
                    알 충전
                  </div>
                  <div className="text-[13px] text-text-tertiary mt-0.5">
                    사주 이용권 충전하기
                  </div>
                </div>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="text-text-tertiary"
                  aria-hidden="true"
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>
            </div>

            <ModalDivider />

            <div className="flex flex-col items-center px-6 py-3 pb-[22px] gap-1.5">
              <button
                onClick={handleLogout}
                className="text-[13px] text-text-tertiary py-1.5 active:text-text-secondary transition-colors"
              >
                로그아웃
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between px-6 pt-6">
              <span className="text-[19px] font-extrabold tracking-tight">메뉴</span>
              <button
                onClick={closeMenu}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                style={{ background: "rgba(255,255,255,0.06)" }}
                aria-label="닫기"
              >
                <X size={15} weight="bold" className="text-text-tertiary" />
              </button>
            </div>

            <div className="h-2" />
            <ModalDivider />

            <div className="px-1 py-1">
              <MenuItem
                href="/start"
                title="사주 분석하기"
                subtitle="내 사주 등급 확인"
                iconBg="rgba(255,107,107,0.1)"
                iconColor="#FF6B6B"
                Icon={Sparkle}
                onClick={closeMenu}
              />
              <MenuItem
                href="/battle/input"
                title="사주 배틀"
                subtitle="친구와 1:1 사주 비교"
                iconBg="rgba(234,179,8,0.1)"
                iconColor="#EAB308"
                Icon={Sword}
                onClick={closeMenu}
              />
              <MenuItem
                href="/dict"
                title="사주 사전"
                subtitle="60갑자·천간지지·신살 정리"
                iconBg="rgba(129, 140, 248, 0.12)"
                iconColor="#818CF8"
                Icon={BookOpenText}
                onClick={closeMenu}
              />
            </div>

            <ModalDivider />

            <div className="mx-5 mt-4">
              <button
                onClick={handleKakaoLogin}
                disabled={signing}
                className="w-full py-4 rounded-[14px] bg-[#FEE500] text-black text-[15px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] active:opacity-90 transition-[transform,opacity] duration-200 disabled:opacity-50"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3C6.5 3 2 6.58 2 11c0 2.83 1.88 5.32 4.7 6.73-.16.58-.6 2.1-.69 2.43-.11.4.15.39.31.28.13-.08 2.05-1.36 2.88-1.91.57.09 1.17.14 1.8.14 5.5 0 10-3.58 10-8S17.5 3 12 3z" />
                </svg>
                카카오로 시작하기
              </button>
            </div>
            <p className="text-[13px] text-text-tertiary text-center pt-3 pb-6">
              로그인하면 결과가 저장돼
            </p>
          </>
        )}
      </Modal>
    </>
  );
}
