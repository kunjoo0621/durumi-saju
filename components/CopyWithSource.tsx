"use client";

import { useEffect, useRef } from "react";

// 본문을 복사하면 출처 두 줄이 자동으로 따라붙는다.
//
// 왜 만들었나 (2026-08-31):
//   사전이 인용되는 자산이 되고 있는데 인용될 때 링크가 안 따라간다.
//   실사례 — 네이버 블로그 pinklip93 이 /dict/gangyak/junghwa-singang 본문 3문단을
//   그대로 옮기고 "사주보는 두루미"라고 출처를 손으로 적었다. 링크는 없었다.
//   AI 챗봇도 같은 방식으로 우리 사전을 인용한다(3개월 11명 유입).
//   이름은 퍼지는데 유입이 안 돌아오는 구조라, 복사 시점에 링크를 얹는다.
//
// ★설계 원칙 — 조금이라도 이상하면 개입하지 않는다.
//   출처를 못 붙이는 건 손해가 없지만, 복사가 깨지는 건 손해다.
//   사전은 트래픽 65% 관문이고 사용자의 83% 가 모바일이다.
//   그래서 setData 가 성공한 뒤에만 preventDefault 를 부른다. 어느 단계에서든
//   실패하면 preventDefault 가 실행되지 않아 브라우저 기본 복사가 그대로 동작한다.

/** 이 길이 미만은 건드리지 않는다 — 단어 하나 복사에 출처가 붙으면 짜증난다. 인용은 문단 단위다. */
const MIN_CHARS = 40;

const BRAND = "사주보는 두루미";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function CopyWithSource({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (typeof window === "undefined" || !el) return;

    const onCopy = (e: ClipboardEvent) => {
      try {
        const dt = e.clipboardData;
        if (!dt) return; // 클립보드 접근 불가 → 기본 동작

        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;

        const plain = sel.toString();
        if (plain.trim().length < MIN_CHARS) return; // 짧은 복사는 그대로 둔다

        // 선택 영역이 본문 컨테이너 안에 온전히 있을 때만 개입한다.
        // 헤더·메뉴까지 걸쳐 드래그한 경우는 건드리지 않는다.
        const range = sel.getRangeAt(0);
        if (!el.contains(range.commonAncestorContainer)) return;

        // 쿼리·해시를 뗀 정규 URL. utm 을 붙이지 않는 이유 — 블로그에 붙일 때
        // 지저분해 보이면 링크 자체를 지울 수 있다. 깨끗한 주소가 더 오래 남는다.
        const url = `${window.location.origin}${window.location.pathname}`;

        const plainOut = `${plain}\n\n출처: ${BRAND}\n${url}`;

        // ★text/html 도 같이 세팅해야 한다. plain 만 넣으면 블로그에 붙일 때
        //   문단 구분이 통째로 뭉개져 지금보다 나빠진다.
        const frag = range.cloneContents();
        const holder = document.createElement("div");
        holder.appendChild(frag);
        const htmlOut =
          `${holder.innerHTML}` +
          `<p>출처: <a href="${escapeHtml(url)}">${escapeHtml(BRAND)}</a></p>`;

        // 여기서부터가 되돌릴 수 없는 지점 — setData 가 모두 성공한 뒤에만 기본 동작을 막는다.
        dt.setData("text/plain", plainOut);
        dt.setData("text/html", htmlOut);
        e.preventDefault();
      } catch {
        // 어떤 이유로든 실패하면 아무것도 하지 않는다.
        // preventDefault 를 안 불렀으므로 브라우저가 원래대로 복사한다.
      }
    };

    el.addEventListener("copy", onCopy as EventListener);
    return () => el.removeEventListener("copy", onCopy as EventListener);
  }, []);

  return <div ref={ref}>{children}</div>;
}
