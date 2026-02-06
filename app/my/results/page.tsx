"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import MenuDrawer from "../../MenuDrawer";
import { useStoreActions } from "@/store/useInputStore";

type ResultItem = {
  id: string;
  name: string | null;
  birth_date: string | null;
  birth_time: string | null;
  region: string | null;
  gender: string | null;
  calendar_type: "solar" | "lunar" | null;
  unlocked_at: string | null;
  created_at: string | null;
};

export default function MyResultsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { reset } = useStoreActions();
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!session?.user) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchResults = async () => {
      const res = await fetch("/api/results");
      if (!res.ok) {
        if (!cancelled) {
          setResults([]);
          setLoading(false);
        }
        return;
      }
      const data = await res.json();
      if (!cancelled) {
        const nextResults = Array.isArray(data.results) ? data.results : [];
        setResults(nextResults);
        if (nextResults.length === 0) {
          setRedirecting(true);
          router.replace("/start");
        }
        setLoading(false);
      }
    };
    fetchResults();

    return () => {
      cancelled = true;
    };
  }, [session, router]);

  const formatBirthDate = (value: string | null) => {
    if (!value) return "";
    const parts = value.split("-");
    if (parts.length !== 3) return value;
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
  };

  const handleAddAnother = () => {
    reset();
    router.push("/start");
  };

  if (status === "loading" || loading || redirecting) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center px-5">
        <div className="text-text-secondary text-[14px]">불러오는 중...</div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-background-primary flex flex-col">
        <header className="px-6 py-5 sticky top-0 z-[100] bg-background-primary">
          <div className="max-w-[640px] mx-auto flex items-center justify-between">
            <div className="w-10" />
            <h1 className="text-title-3 text-text-primary font-aggro">사주보는 두루미</h1>
            <MenuDrawer />
          </div>
        </header>
        <main className="flex-1 px-5 pb-24 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-text-secondary">로그인하면 저장된 결과를 확인할 수 있어요.</p>
            <button
              onClick={() => signIn("kakao", { callbackUrl: "/menu" })}
              className="px-6 py-3 rounded-xl text-button-md bg-[#FEE500] text-black font-semibold"
            >
              카카오로 시작하기
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-primary flex flex-col">
      <header className="px-6 py-5 sticky top-0 z-[100] bg-background-primary">
        <div className="max-w-[640px] mx-auto flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-text-primary hover:bg-background-secondary transition-colors"
            aria-label="이전 화면"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-title-3 text-text-primary font-aggro">등록된 사주</h1>
          <MenuDrawer />
        </div>
      </header>

      <main className="flex-1 px-5 pb-24">
        <div className="max-w-[640px] mx-auto pt-8 space-y-4">
          {results.length > 0 && (
            <div className="space-y-3">
              {results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => router.push(`/result?resultId=${item.id}`)}
                  className="w-full bg-background-secondary rounded-xl p-4 text-left"
                >
                  <div className="text-text-primary font-semibold text-[15px]">
                    {item.name || `사주 #${item.id.slice(0, 6)}`}
                  </div>
                  <div className="text-text-secondary text-[13px] mt-1">
                    {item.calendar_type === "lunar" ? "음력" : "양력"} {formatBirthDate(item.birth_date)}
                    {item.birth_time ? ` ${item.birth_time}` : ""}
                    {item.region ? ` · ${item.region}` : ""}
                    {item.gender ? ` · ${item.gender}` : ""}
                  </div>
                  <div className="text-text-tertiary text-[12px] mt-2">
                    {item.unlocked_at ? new Date(item.unlocked_at).toLocaleString() : "저장됨"}
                  </div>
                </button>
              ))}
            </div>
          )}

          {results.length > 0 && (
            <div className="pt-2 space-y-2">
              <p className="text-[12px] text-text-secondary">본인 동의가 있는 정보만 입력해 주세요</p>
              <button
                type="button"
                onClick={handleAddAnother}
                className="w-full h-[52px] rounded-xl bg-primary text-text-primary text-[15px] font-semibold"
              >
                다른 사람 사주 추가하기
              </button>
            </div>
          )}

          {results.length === 0 && (
            <div className="pt-2 space-y-2">
              <p className="text-[13px] text-text-secondary">
                저장된 사주를 불러오지 못했습니다.
              </p>
              <button
                type="button"
                onClick={handleAddAnother}
                className="w-full h-[52px] rounded-xl bg-primary text-text-primary text-[15px] font-semibold"
              >
                다른 사람 사주 추가하기
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
