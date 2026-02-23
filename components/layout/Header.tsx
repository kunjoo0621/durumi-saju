"use client";

import { useRouter } from "next/navigation";
import { CaretLeft, List } from "@phosphor-icons/react";
import MenuDrawer from "@/app/MenuDrawer";

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
}

export default function Header({
  title = "사주보는 두루미",
  showBack = false,
  onBack,
}: HeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <header className="sticky top-0 z-[100] bg-[#0D0D0D] px-6 py-5">
      <div className="max-w-[640px] mx-auto flex items-center justify-between">
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

        <h1 className="text-title-3 text-text-primary font-aggro">{title}</h1>

        <MenuDrawer />
      </div>
    </header>
  );
}
