"use client";

import { useMemo } from "react";
import { signIn } from "next-auth/react";
import MenuDrawer from "./MenuDrawer";

const BENEFITS = [
  {
    title: "결론부터 딱 말해줘요",
    desc: "긴 설명 전에 등급으로 핵심부터 확인.",
  },
  {
    title: "친근하고 재밌게",
    desc: "친구가 말해주는 것처럼 술술 읽히게.",
  },
  {
    title: "내 결과 저장",
    desc: "로그인하면 결과를 안전하게 보관.",
  },
];

const FLOW = ["정보 입력", "티저 확인", "카카오 로그인", "결제", "전체 결과 확인"];

const FAQ = [
  {
    q: "사주 결과는 얼마나 정확한가요?",
    a: "사주 원리 기반의 참고 자료로 제공됩니다. 핵심은 방향성을 얻는 데 있어요.",
  },
  {
    q: "결제를 해야만 전체 결과가 보이나요?",
    a: "네. 티저로 핵심만 보여드리고 전체 해석은 결제 후 열립니다.",
  },
  {
    q: "로그인 없이도 볼 수 있나요?",
    a: "티저는 로그인 없이 가능하며, 전체 결과 확인 시 로그인합니다.",
  },
  {
    q: "정보는 안전하게 보관되나요?",
    a: "필요한 정보만 저장하고, 병원 서비스 기준으로 관리합니다.",
  },
];

export default function LandingPage() {
  const callbackUrl = useMemo(() => "/start", []);

  return (
    <div className="min-h-screen bg-background-primary text-text-primary flex flex-col">
      <header className="sticky top-0 z-[100] bg-background-primary px-5 py-5">
        <div className="max-w-[420px] mx-auto flex items-center justify-between">
          <div className="w-10" />
          <div className="text-title-3 font-aggro">사주보는 두루미</div>
          <MenuDrawer />
        </div>
      </header>

      <main className="px-5 pb-[calc(120px+env(safe-area-inset-bottom))]">
        <section className="max-w-[420px] mx-auto pt-10 space-y-6">
          <div>
            <p className="text-text-secondary text-[14px] mb-2">두루미의 사주 리포트</p>
            <h1 className="text-[28px] font-aggro leading-snug">
              등급으로 결론부터 보는 사주
            </h1>
            <p className="text-text-secondary text-[15px] mt-3">
              입력 1분이면 끝. 먼저 “내 등급” 보고, 궁금하면 더 깊게 보자.
            </p>
            <p className="text-text-secondary text-[14px] mt-3">
              로그인하면 결과를 저장하고, 결제 확인/환불 처리가 가능해요
            </p>
            <a
              href={`/api/auth/signin/kakao?callbackUrl=${encodeURIComponent(callbackUrl)}`}
              onClick={(event) => {
                event.preventDefault();
                signIn("kakao", { callbackUrl });
              }}
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-background-secondary px-4 py-3 text-[14px] font-semibold text-text-primary"
            >
              카카오 로그인
            </a>
          </div>

          <div className="bg-background-secondary rounded-2xl p-5 space-y-3">
            <div className="text-[12px] text-text-secondary">등급 카드 예시</div>
            <div className="rounded-xl bg-background-tertiary p-4">
              <div className="text-[22px] font-semibold text-primary">재물운 A 등급</div>
              <p className="text-text-secondary text-[14px] mt-2">
                “성장 탄력이 좋은 타입. 기회는 올해 하반기부터 본격화됩니다.”
              </p>
            </div>
            <div className="rounded-xl bg-background-tertiary p-4 text-text-secondary blur-sm">
              연애운, 직장운, 건강운 해석이 더 길게 이어집니다...
            </div>
          </div>

        </section>

        <section className="max-w-[420px] mx-auto pt-12 space-y-4">
          <h2 className="text-[20px] font-semibold">왜 두루미?</h2>
          <div className="grid gap-3">
            {BENEFITS.map((item) => (
              <div key={item.title} className="bg-background-secondary rounded-xl p-4">
                <div className="text-[16px] font-semibold mb-1">{item.title}</div>
                <p className="text-text-secondary text-[14px]">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-[420px] mx-auto pt-12 space-y-4">
          <h2 className="text-[20px] font-semibold">이용 흐름</h2>
          <div className="grid grid-cols-2 gap-3">
            {FLOW.map((step, index) => (
              <div
                key={step}
                className="bg-background-secondary rounded-xl p-4 text-center text-[13px] text-text-secondary"
              >
                <div className="text-text-primary font-semibold text-[16px] mb-1">
                  {index + 1}
                </div>
                {step}
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-[420px] mx-auto pt-12 space-y-4">
          <h2 className="text-[20px] font-semibold">FAQ</h2>
          <div className="space-y-3">
            {FAQ.map((item) => (
              <div key={item.q} className="bg-background-secondary rounded-xl p-4">
                <div className="text-text-primary font-semibold mb-1">{item.q}</div>
                <p className="text-text-secondary text-[14px]">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-[420px] mx-auto pt-12 space-y-4">
          <h2 className="text-[20px] font-semibold">안심 안내</h2>
          <div className="bg-background-secondary rounded-xl p-4 space-y-2 text-[14px] text-text-secondary">
            <p>병원 서비스 기준으로 개인정보를 안전하게 관리합니다.</p>
            <p>결제 이후에도 로그인하면 결과를 안전하게 보관할 수 있어요.</p>
            <p>필요한 정보만 최소한으로 사용합니다.</p>
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-[120] bg-background-primary/95 backdrop-blur px-5 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <div className="max-w-[420px] mx-auto">
          <a
            href="/start"
            className="block w-full rounded-xl px-4 py-4 text-[15px] font-semibold leading-none transition-all duration-200 bg-primary text-text-primary text-center border-0 outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
          >
            사주 보러가기
          </a>
        </div>
      </div>
    </div>
  );
}
