"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";

/* ─────────────────────────────────────────────
 * 공용 모달 / 바텀시트 컴포넌트
 *
 * variant="center"      → 모바일·PC 모두 중앙 모달 (다이얼로그)
 * variant="bottomSheet" → 모바일 바텀시트 + PC 중앙 모달
 * ───────────────────────────────────────────── */

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** "center" = 항상 중앙 모달, "bottomSheet" = 모바일 바텀시트 + PC 모달 */
  variant?: "center" | "bottomSheet";
  /** 중앙 모달 최대 너비 (기본 420px) */
  maxWidth?: string;
  /** 접근성 라벨 */
  ariaLabel?: string;
}

export default function Modal({
  isOpen,
  onClose,
  children,
  variant = "center",
  maxWidth = "420px",
  ariaLabel,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const lastActiveRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const stableOnClose = useCallback(() => onCloseRef.current(), []);

  // 스크롤 잠금
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // 포커스 트랩 + ESC
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
        onCloseRef.current();
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

  if (!isOpen) return null;

  const centerModal = (
    <div
      className="absolute inset-0 flex items-center justify-center p-6"
      onClick={stableOnClose}
    >
      <div
        ref={variant === "center" ? modalRef : undefined}
        className="w-full bg-background-secondary rounded-2xl overflow-hidden animate-[modalIn_0.25s_cubic-bezier(0.16,1,0.3,1)]"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </div>
  );

  // variant === "center": 모바일·PC 모두 중앙 모달
  if (variant === "center") {
    return createPortal(
      <div className="fixed inset-0 z-[200]">
        <div
          className="absolute inset-0 bg-black/60 animate-fadeIn"
          onClick={stableOnClose}
        />
        {centerModal}
      </div>,
      document.body
    );
  }

  // variant === "bottomSheet": 모바일 바텀시트 + PC 중앙 모달
  return createPortal(
    <div ref={modalRef} className="fixed inset-0 z-[200]">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[4px] animate-fadeIn"
        onClick={stableOnClose}
      />

      {/* 모바일 바텀시트 */}
      <div
        className="sm:hidden fixed inset-x-0 bottom-0 z-[201] bg-background-secondary rounded-t-2xl max-h-[85dvh] overflow-y-auto"
        style={{ overflowX: "clip" }}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        {/* 핸들바 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        {children}
        {/* safe area 하단 패딩 */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>

      {/* PC 센터 모달 */}
      <div
        className="hidden sm:flex absolute inset-0 items-center justify-center p-6"
        onClick={stableOnClose}
      >
        <div
          className="w-full bg-background-secondary rounded-2xl overflow-hidden animate-[modalIn_0.25s_cubic-bezier(0.16,1,0.3,1)]"
          style={{
            maxWidth,
            boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─────────────────────────────────────────────
 * 편의 export: Modal 내부 레이아웃 서브컴포넌트
 * ───────────────────────────────────────────── */

/** 모달 헤더 (제목 + 닫기 버튼) */
export function ModalHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-6 pt-6 pb-4">
      <div>
        <h2 className="text-[20px] font-bold text-text-primary">{title}</h2>
        {subtitle && (
          <p className="text-[14px] text-text-secondary mt-1">{subtitle}</p>
        )}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.06]"
          aria-label="닫기"
        >
          <X size={15} weight="bold" className="text-text-tertiary" />
        </button>
      )}
    </div>
  );
}

/** 모달 구분선 */
export function ModalDivider() {
  return (
    <div className="h-px mx-5 bg-white/[0.06]" />
  );
}

/** 모달 본문 영역 */
export function ModalBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`px-5 pt-4 pb-6 ${className}`}>{children}</div>;
}

/** 모달 하단 안내문 */
export function ModalFooter({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`px-6 pb-6 ${className}`}>
      {children}
    </div>
  );
}
