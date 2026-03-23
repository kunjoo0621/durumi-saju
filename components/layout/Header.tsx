"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { CaretLeft, Egg } from "@phosphor-icons/react";
import MenuDrawer from "@/app/MenuDrawer";
import { useCoinStore } from "@/store/useCoinStore";
import { useKakaoLogin } from "@/hooks/useKakaoLogin";
import { useEffect } from "react";

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  sticky?: boolean;
  showBalance?: boolean;
  /** 헤더 배경 클래스 override (랜딩 투명 배경 등) */
  className?: string;
}

export default function Header({
  title = "사주보는 두루미",
  showBack = false,
  onBack,
  sticky = false,
  showBalance = false,
  className,
}: HeaderProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { balance, fetchBalance } = useCoinStore();
  const { login } = useKakaoLogin();

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

  const showCoinBalance = showBalance && isLoggedIn;

  const defaultCls = `shrink-0 z-[100] bg-background-primary px-5 py-4${sticky ? ' sticky top-0' : ''}`;

  return (
    <header className={className ?? defaultCls}>
      <div className="max-w-[640px] mx-auto flex items-center">
        <div className="flex-1 flex justify-start">
          {showBack ? (
            <button
              type="button"
              onClick={handleBack}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-text-primary hover:bg-background-secondary transition-colors"
              aria-label="뒤로가기"
            >
              <CaretLeft size={20} weight="bold" />
            </button>
          ) : (
            <div className="w-10" />
          )}
        </div>

        <h1 className="text-title-3 text-text-primary font-aggro shrink-0">
          <Link href="/">{title}</Link>
        </h1>

        <div className="flex-1 flex items-center justify-end gap-2">
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
          {isLoggedIn ? (
            <MenuDrawer />
          ) : (
            <button
              type="button"
              onClick={() => login()}
              className="text-[13px] font-semibold px-2.5 py-1 rounded-lg border border-white/10 bg-background-secondary text-text-secondary hover:bg-background-secondary/80 transition-colors"
            >
              로그인
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
