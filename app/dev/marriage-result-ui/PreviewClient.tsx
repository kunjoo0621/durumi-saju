"use client";

// 🚨 DEV ONLY — 결혼운 결과 화면 시각 검증용 클라이언트 래퍼.
// MarriageResultClient(feature 파일, 무수정)는 내부에서 useSession() + fetch("/api/marriage/results")로
// 데이터를 가져오는데, DB 마이그레이션이 아직 적용되지 않아 실제 API/DB 경로를 탈 수 없다.
// 그래서 window.fetch를 컴포넌트 렌더 단계(커밋 전, 즉 어떤 useEffect보다도 먼저 실행되는 시점)에서
// 패치해 /api/auth/session과 /api/marriage/results 요청만 가로채 서버에서 미리 계산해 둔 데이터를
// 돌려준다. 그 외 요청(폰트·이미지 등)은 원래 fetch로 그대로 통과시킨다.
import MarriageResultClient from "@/app/marriage/result/MarriageResultClient";

let patched = false;

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function installFetchPatch() {
  if (patched) return;
  patched = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = urlOf(input);
    if (url.includes("/api/auth/session")) {
      return new Response(
        JSON.stringify({
          user: { name: "dev-preview", email: "dev-preview@durumisaju.com" },
          expires: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.includes("/api/marriage/results")) {
      return new Response(JSON.stringify((window as any).__MARRIAGE_PREVIEW_DATA__ ?? {}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return originalFetch(input, init);
  }) as typeof window.fetch;
}

export default function PreviewClient({ data }: { data: unknown }) {
  if (typeof window !== "undefined") {
    // 매 렌더마다 최신 data를 갱신 — patch 설치 자체는 1회만.
    (window as any).__MARRIAGE_PREVIEW_DATA__ = data;
    installFetchPatch();
  }
  return <MarriageResultClient />;
}
