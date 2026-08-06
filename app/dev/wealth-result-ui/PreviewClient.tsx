"use client";

// 🚨 DEV ONLY — 재물운 결과 화면 시각 검증용 클라이언트 래퍼.
// app/dev/marriage-result-ui/PreviewClient.tsx 그대로 미러(도메인만 wealth로 교체).
// WealthResultClient(feature 파일, 무수정)는 내부에서 useSession() + fetch("/api/wealth/results")로
// 데이터를 가져오는데, DB 마이그레이션이 아직 적용되지 않아 실제 API/DB 경로를 탈 수 없다.
// window.fetch를 렌더 단계(어떤 useEffect보다도 먼저 실행되는 시점)에서 패치해
// /api/auth/session과 /api/wealth/results만 가로채고, 나머지는 원래 fetch로 통과시킨다.
import WealthResultClient from "@/app/wealth/result/WealthResultClient";

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
    if (url.includes("/api/wealth/results")) {
      return new Response(JSON.stringify((window as any).__WEALTH_PREVIEW_DATA__ ?? {}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return originalFetch(input, init);
  }) as typeof window.fetch;
}

export default function PreviewClient({ data }: { data: unknown }) {
  if (typeof window !== "undefined") {
    (window as any).__WEALTH_PREVIEW_DATA__ = data;
    installFetchPatch();
  }
  return <WealthResultClient />;
}
