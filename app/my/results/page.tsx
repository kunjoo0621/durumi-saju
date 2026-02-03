"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import MenuDrawer from "../../MenuDrawer";

type ResultItem = {
  id: string;
  input_hash: string;
  unlocked_at: string | null;
  created_at: string | null;
};

export default function MyResultsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchResults = async () => {
      const res = await fetch("/api/results");
      if (!res.ok) {
        if (!cancelled) setResults([]);
        return;
      }
      const data = await res.json();
      if (!cancelled) {
        setResults(Array.isArray(data.results) ? data.results : []);
      }
    };
    fetchResults().finally(() => setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [session]);

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-background-primary flex flex-col">
        <header className="px-6 py-5 sticky top-0 z-[100] bg-background-primary">
          <div className="max-w-[420px] mx-auto flex items-center justify-between">
            <div className="w-10" />
            <h1 className="text-title-3 text-text-primary font-aggro">사주보는 두루미</h1>
            <MenuDrawer />
          </div>
        </header>
        <main className="flex-1 px-5 pb-24 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-text-secondary">로그인하면 저장된 결과를 확인할 수 있어요.</p>
            <button
              onClick={() => signIn("kakao", { callbackUrl: "/my/results" })}
              className="btn-primary px-6 py-3 rounded-xl text-button-md"
            >
              카카오로 로그인
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-primary flex flex-col">
      <header className="px-6 py-5 sticky top-0 z-[100] bg-background-primary">
        <div className="max-w-[420px] mx-auto flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-text-primary hover:bg-background-secondary transition-colors"
            aria-label="이전 화면"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-title-3 text-text-primary font-aggro">내 사주 결과</h1>
          <MenuDrawer />
        </div>
      </header>

      <main className="flex-1 px-5 pb-24">
        <div className="max-w-[420px] mx-auto pt-8 space-y-4">
          {loading && (
            <div className="text-text-secondary text-center">불러오는 중...</div>
          )}
          {!loading && results.length === 0 && (
            <div className="text-text-secondary text-center">저장된 결과가 없습니다.</div>
          )}
          {!loading && results.length > 0 && (
            <div className="space-y-3">
              {results.map((item) => (
                <div key={item.id} className="bg-background-secondary rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-text-primary font-semibold text-[15px]">결과 #{item.id.slice(0, 6)}</div>
                    <div className="text-text-tertiary text-[12px]">
                      {item.unlocked_at ? new Date(item.unlocked_at).toLocaleString() : "미확정"}
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/result?resultId=${item.id}`)}
                    className="text-[13px] font-semibold text-primary"
                  >
                    보기
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
