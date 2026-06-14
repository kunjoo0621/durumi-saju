"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Egg } from "@phosphor-icons/react";
import Modal from "@/components/Modal";
import LoginForm from "@/components/LoginForm";

// 가입 보너스 이벤트 마감 시각: 2026-06-22 00:00 KST = 2026-06-21 15:00 UTC (배너는 6/22 00:00까지 노출)
const EVENT_END_TS = Date.UTC(2026, 5, 21, 15, 0, 0);

export default function EventSignupBanner() {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);

  // 이벤트 마감 후 숨김
  if (Date.now() >= EVENT_END_TS) return null;

  // 로딩 중이거나 이미 로그인한 유저에겐 숨김
  if (status === "loading" || session?.user) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="카카오 로그인하면 10알 무료"
        className="group relative block w-full border-b border-white/[0.06] bg-[rgb(var(--c-dark-surface))] transition-colors hover:bg-white/[0.03] active:bg-white/[0.06]"
      >
        <div className="mx-auto flex max-w-[720px] items-center justify-center gap-2 px-5 py-3 text-[14px]">
          <Egg
            size={18}
            weight="fill"
            className="text-[rgb(var(--c-brand))]"
            aria-hidden
          />
          <span className="font-medium text-white">지금 가입하면</span>
          <span className="rounded-full bg-[rgb(var(--c-brand))] px-2 py-0.5 text-[13px] font-bold text-white">
            10알 무료
          </span>
          <span className="text-[13px] text-[rgb(var(--c-text-sub))]">
            · 6/21 마감
          </span>
        </div>
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        maxWidth="380px"
        ariaLabel="로그인"
      >
        <div className="p-6">
          <h3 className="mb-2 text-center text-[17px] font-bold text-text-primary">
            카카오로 로그인하기
          </h3>
          <p className="mb-6 text-center text-[13px] text-text-secondary">
            로그인하면 결과가 저장돼
          </p>
          <LoginForm callbackUrl="/" onClose={() => setIsOpen(false)} />
        </div>
      </Modal>
    </>
  );
}
