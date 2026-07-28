"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sendKakaoShare } from "@/lib/kakao-share";
import type { ShareRewardKind } from "@/lib/constants/share-reward";

// 카카오톡 공유 버튼 (7종 결과지 공용).
//
// 흐름: prepare로 nonce 발급 → 카톡 전송 → 카카오가 전송 성공 시 서버 웹훅 호출 →
//      클라이언트는 status를 짧게 폴링해 결과를 알린다.
// 전송 완료 여부를 브라우저가 알 방법은 없다(JS SDK에 성공 콜백이 없음). 그래서
// "보냈다"고 단정하지 않고, 웹훅이 도착했을 때만 문구를 띄운다.

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30000;

type Props = {
  kind: ShareRewardKind;
  resultId: string;
  shareUrl: string;
  title: string;
  description: string;
  imageUrl: string;
  /** 로그인 사용자만 보상 대상 — 비로그인은 공유만 (nonce 없이) */
  isAuthenticated: boolean;
  onNotice: (message: string) => void;
  className?: string;
};

export default function KakaoShareButton({
  kind,
  resultId,
  shareUrl,
  title,
  description,
  imageUrl,
  isAuthenticated,
  onNotice,
  className,
}: Props) {
  const [alreadyGranted, setAlreadyGranted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStop = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    fetch(`/api/coins/share-reward/status?kind=${kind}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setAlreadyGranted(!!d.alreadyGranted);
      })
      .catch(() => {
        // 라벨 결정 실패는 조용히 넘긴다 — 기본 라벨로 보인다
      });
    return () => {
      cancelled = true;
    };
  }, [kind, isAuthenticated]);

  const clearPolling = useCallback(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    if (pollStop.current) clearTimeout(pollStop.current);
    pollTimer.current = null;
    pollStop.current = null;
  }, []);

  useEffect(() => clearPolling, [clearPolling]);

  const startPolling = useCallback(
    (nonce: string) => {
      clearPolling();

      const tick = async () => {
        try {
          const res = await fetch(`/api/coins/share-reward/status?nonce=${encodeURIComponent(nonce)}`);
          if (!res.ok) return;
          const data = await res.json();

          if (data.state === "granted") {
            clearPolling();
            if (data.alreadyHad) {
              onNotice("공유 완료!");
            } else {
              onNotice("공유 완료! 5알이 들어왔어요 🎁");
              setAlreadyGranted(true);
            }
          } else if (data.state === "rejected") {
            clearPolling();
            if (data.rejectReason === "memo_chat" || data.rejectReason === "single_chatroom") {
              onNotice("나와의 채팅은 제외돼요. 친구에게 보내주세요");
            } else {
              onNotice("공유 완료!");
            }
          }
        } catch {
          // 폴링 실패는 무시 — 다음 틱에서 다시 시도
        }
      };

      pollTimer.current = setInterval(tick, POLL_INTERVAL_MS);
      pollStop.current = setTimeout(clearPolling, POLL_TIMEOUT_MS);
    },
    [clearPolling, onNotice]
  );

  const copyFallback = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      onNotice("링크를 복사했어요");
    } catch {
      onNotice("잠시 후 다시 시도해 주세요");
    }
  }, [shareUrl, onNotice]);

  const handleClick = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      let nonce: string | null = null;

      if (isAuthenticated) {
        try {
          const res = await fetch("/api/coins/share-reward/prepare", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resultKind: kind, resultId }),
          });
          if (res.ok) {
            const data = await res.json();
            nonce = data.nonce ?? null;
            if (typeof data.alreadyGranted === "boolean") setAlreadyGranted(data.alreadyGranted);
          }
          // 실패해도 공유 자체는 막지 않는다. 보상만 없다.
        } catch {
          // 동일
        }
      }

      try {
        await sendKakaoShare(
          { title, description, imageUrl, linkUrl: shareUrl },
          nonce
        );
      } catch (e) {
        // SDK 로드 실패/차단 환경 — 링크 복사로 강등하고 보상 문구는 띄우지 않는다
        console.error("[KAKAO_SHARE] send failed", e);
        await copyFallback();
        return;
      }

      if (nonce) startPolling(nonce);
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    isAuthenticated,
    kind,
    resultId,
    title,
    description,
    imageUrl,
    shareUrl,
    startPolling,
    copyFallback,
  ]);

  const label =
    !isAuthenticated || alreadyGranted
      ? "카카오톡으로 공유하기"
      : "카카오톡으로 공유하고 5알 받기";

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className={
        className ??
        "btn-primary w-full h-[54px] rounded-xl text-[15px] font-semibold transition-colors duration-200 disabled:opacity-60"
      }
    >
      {label}
    </button>
  );
}
