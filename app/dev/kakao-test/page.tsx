"use client";

// 카카오톡 공유 4019 원인 격리용 진단 페이지.
// 실서비스 공유가 "요청 실패(4019)"로 막혀서, 변수를 하나씩 빼며 어디서 갈리는지 본다.
// 원인 확인되면 이 페이지는 삭제한다.

import { useEffect, useState } from "react";

export default function KakaoTestPage() {
  const [log, setLog] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  const push = (s: string) => setLog((l) => [...l, s]);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
    push(`origin: ${window.location.origin}`);
    push(`JS키: ${key ? key.slice(0, 8) + "…(길이 " + key.length + ")" : "❌ 없음 — 빌드에 안 박혔다"}`);
    if (!key) return;

    const s = document.createElement("script");
    s.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.6/kakao.min.js";
    s.async = true;
    s.crossOrigin = "anonymous";
    s.onload = () => {
      try {
        const K = (window as any).Kakao;
        if (!K.isInitialized()) K.init(key);
        push(`SDK 로드 OK / init OK (v${K.VERSION ?? "?"})`);
        setReady(true);
      } catch (e: any) {
        push(`init 실패: ${e?.message ?? e}`);
      }
    };
    s.onerror = () => push("SDK 로드 실패");
    document.head.appendChild(s);
  }, []);

  const base = typeof window !== "undefined" ? window.location.origin : "";

  const send = (label: string, extra: Record<string, unknown>) => {
    try {
      push(`▶ ${label} 시도`);
      (window as any).Kakao.Share.sendDefault({
        objectType: "text",
        text: "두루미 공유 테스트",
        link: { mobileWebUrl: base, webUrl: base },
        ...extra,
      });
    } catch (e: any) {
      push(`✖ ${label} 예외: ${e?.message ?? e}`);
    }
  };

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>카카오 공유 진단</h1>
      <p style={{ fontSize: 14, opacity: 0.8 }}>
        위에서부터 순서대로 눌러보고, 어느 것에서 &quot;요청 실패&quot;가 뜨는지 알려주세요.
      </p>

      <div style={{ display: "grid", gap: 10, margin: "20px 0" }}>
        <button
          disabled={!ready}
          onClick={() => send("A. 가장 단순 (텍스트만)", {})}
          style={btn}
        >
          A. 가장 단순 — 텍스트만
        </button>
        <button
          disabled={!ready}
          onClick={() => send("B. serverCallbackArgs 포함", { serverCallbackArgs: { n: "diagnostic" } })}
          style={btn}
        >
          B. 웹훅 파라미터 포함
        </button>
        <button
          disabled={!ready}
          onClick={() =>
            send("C. 실제와 동일 (feed + 이미지)", {
              objectType: "feed",
              content: {
                title: "두루미 공유 테스트",
                description: "진단용",
                imageUrl: `${base}/og-image.png`,
                link: { mobileWebUrl: base, webUrl: base },
              },
              buttons: [{ title: "결과 보러 가기", link: { mobileWebUrl: base, webUrl: base } }],
              installTalk: true,
            })
          }
          style={btn}
        >
          C. 실제 공유와 동일한 형태
        </button>
      </div>

      <pre
        style={{
          background: "#111",
          color: "#0f0",
          padding: 14,
          borderRadius: 8,
          fontSize: 12,
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}
      >
        {log.join("\n")}
      </pre>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "14px 16px",
  fontSize: 15,
  fontWeight: 600,
  borderRadius: 10,
  border: "1px solid #888",
  background: "#FEE500",
  color: "#000",
};
