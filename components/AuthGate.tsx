"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import Modal from "@/components/Modal";
import LoginForm from "@/components/LoginForm";

interface AuthGateProps {
  /** 로그인 성공 후 돌아갈 경로 */
  callbackUrl: string;
  /** 모달 닫을 때 이동할 경로 (기본: /menu) */
  backUrl?: string;
  /** 모달 헤더 제목 */
  title?: string;
  /** 모달 부제 */
  subtitle?: string;
}

export default function AuthGate({
  callbackUrl,
  backUrl = "/menu",
  title = "로그인이 필요해",
  subtitle = "로그인하면 결과가 저장돼",
}: AuthGateProps) {
  const router = useRouter();
  // SSR-safe: mount 후에만 모달 open. Modal 내부 createPortal(document.body)이 server에서 에러 안 나도록.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(true);
  }, []);

  const close = () => {
    setOpen(false);
    router.push(backUrl);
  };

  return (
    <div className="min-h-screen bg-background-primary text-text-primary flex flex-col">
      <Header showBack sticky onBack={() => router.push(backUrl)} />

      <Modal
        isOpen={open}
        onClose={close}
        maxWidth="380px"
        ariaLabel="로그인"
      >
        <div className="p-6">
          <h3 className="text-[17px] font-bold text-text-primary text-center mb-2">
            {title}
          </h3>
          <p className="text-[13px] text-text-secondary text-center mb-6">
            {subtitle}
          </p>
          <LoginForm callbackUrl={callbackUrl} onClose={close} />
        </div>
      </Modal>
    </div>
  );
}
