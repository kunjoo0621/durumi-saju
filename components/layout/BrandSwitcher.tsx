"use client";

// 헤더 브랜드 = 세계 스위처. 탭하면 사주 / 타로 / 별자리(준비중) 시트가 열린다.
//
// 탭해도 홈으로 가지 않는다(운영자 확정 2026-07-31) — 리스트만 연다.
// 홈 통로는 햄버거 메뉴에 이미 있어서 두 번 만들 이유가 없다.
//
// 타로 플래그가 꺼져 있으면 스위처 자체를 렌더하지 않고 평범한 제목으로 남는다.
// 운영 중인 사주 화면에 미완성 라우트로 가는 통로가 먼저 뚫리는 걸 막는다.
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CaretDown, Check } from "@phosphor-icons/react";
import Modal, { ModalHeader, ModalDivider, ModalBody } from "@/components/Modal";
import { TAROT_ENABLED, WORLDS, worldBrand, worldFromPath } from "@/lib/tarot/worlds";

export default function BrandSwitcher() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);

  const current = worldFromPath(pathname);
  const brand = worldBrand(current);

  if (!TAROT_ENABLED) {
    return <span className="font-aggro text-title-3 text-text-primary">{brand}</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${brand} — 다른 두루미 보기`}
        className="-mx-1.5 flex items-center gap-1 rounded-lg px-1.5 py-0.5 transition-colors hover:bg-white/[0.06] active:bg-white/[0.09]"
      >
        <span className="font-aggro text-title-3 text-text-primary">{brand}</span>
        <CaretDown
          size={13}
          weight="bold"
          className={`shrink-0 text-text-tertiary transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        variant="bottomSheet"
        maxWidth="440px"
        ariaLabel="두루미 고르기"
      >
        <ModalHeader
          title="어떤 두루미를 볼까?"
          subtitle="같은 두루미가 다른 걸 봐줘요"
          onClose={() => setOpen(false)}
        />
        <ModalDivider />
        <ModalBody className="space-y-1">
          {WORLDS.map((w) => {
            const selected = w.id === current;
            const inner = (
              <>
                <span
                  className="h-9 w-9 shrink-0 rounded-xl"
                  style={{ background: `${w.dot}1F`, boxShadow: `inset 0 0 0 1px ${w.dot}3D` }}
                >
                  <span className="flex h-full w-full items-center justify-center">
                    <span className="h-2 w-2 rounded-full" style={{ background: w.dot }} />
                  </span>
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[16px] font-semibold text-text-primary">
                    {w.brand}
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-text-tertiary">
                    {w.tagline}
                  </span>
                </span>
                {selected ? (
                  <Check size={16} weight="bold" className="shrink-0 text-text-secondary" />
                ) : null}
              </>
            );

            const base = "flex w-full items-center gap-3.5 rounded-[14px] px-3 py-3";

            if (!w.ready) {
              return (
                <div key={w.id} className={`${base} opacity-40`} aria-disabled="true">
                  {inner}
                </div>
              );
            }

            return (
              <Link
                key={w.id}
                href={w.href}
                onClick={() => setOpen(false)}
                aria-current={selected ? "page" : undefined}
                className={`${base} transition-colors hover:bg-white/[0.03] active:bg-white/[0.05]`}
              >
                {inner}
              </Link>
            );
          })}
        </ModalBody>
      </Modal>
    </>
  );
}
