"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { CaretLeft, Egg } from "@phosphor-icons/react";
import MenuDrawer from "@/app/MenuDrawer";
import BrandSwitcher from "@/components/layout/BrandSwitcher";
import { useCoinStore } from "@/store/useCoinStore";
import { useEffect } from "react";

interface HeaderProps {
  /** 넘기면 그 페이지 제목("알 충전" 등). 생략하면 브랜드 스위처가 뜬다 */
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  sticky?: boolean;
  /** 헤더 배경 클래스 override (랜딩 투명 배경 등) */
  className?: string;
}

export default function Header({
  title,
  showBack = false,
  onBack,
  sticky = false,
  className,
}: HeaderProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { balance, fetchBalance } = useCoinStore();

  const isLoggedIn = !!session?.user;

  useEffect(() => {
    if (isLoggedIn) fetchBalance();
  }, [isLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const showCoinBalance = isLoggedIn;

  const defaultCls = `shrink-0 z-[100] bg-background-primary px-5 py-4${sticky ? ' sticky top-0' : ''}`;

  return (
    <header className={className ?? defaultCls}>
      {/* 제목 좌측 고정 — 브랜드 스위처로 세계를 넘나들 때 제목이 좌우로 튀지 않게(§3.1).
          왼쪽에 빈 자리를 잡아두지 않으므로 브랜드가 본문(px-5)과 같은 x에 선다 */}
      <div className="max-w-[640px] mx-auto flex items-center gap-1">
        {showBack && (
          <button
            type="button"
            onClick={handleBack}
            className="-ml-2 w-10 h-10 shrink-0 flex items-center justify-center rounded-lg text-text-primary hover:bg-background-secondary transition-colors"
            aria-label="뒤로가기"
          >
            <CaretLeft size={20} weight="bold" />
          </button>
        )}

        <div className="min-w-0 shrink">
          {title ? (
            <h1 className="truncate text-title-3 text-text-primary font-aggro">{title}</h1>
          ) : (
            <BrandSwitcher />
          )}
        </div>

        <div className="ml-auto pl-2 flex items-center justify-end gap-2">
          {showCoinBalance && (
            <Link
              href="/coins"
              className={`flex items-center gap-1 whitespace-nowrap text-[13px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                (balance ?? 0) <= 10
                  ? "text-saju-earth bg-saju-earth/10"
                  : "text-text-secondary bg-white/[0.06]"
              }`}
            >
              <Egg size={14} weight="fill" className="shrink-0" />
              <span>{balance !== null ? balance : "–"}</span>
            </Link>
          )}
          {!isLoggedIn && (
            <Link
              href="/login"
              className="text-[13px] font-semibold px-2.5 py-1 rounded-lg border border-white/10 bg-background-secondary text-text-secondary hover:bg-background-secondary/80 transition-colors"
            >
              로그인
            </Link>
          )}
          <MenuDrawer />
        </div>
      </div>
    </header>
  );
}
