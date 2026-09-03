"use client";

// "우리 결혼해도 되는 사주일까" 결과 화면.
// app/marriage/result/MarriageResultClient.tsx 의 구조·토큰을 그대로 따른다
// (풀블리드 히어로 + 배경 webp + 글로우 + rounded-3xl 카드 + 3단계 게이지 + 고정 CTA).
//
// ★결혼운과 결정적으로 다른 점 두 가지:
//  ① **등급 배지가 없다**(§1-0 운영자 확정 — 등급은 개인사주 전용). 히어로의 중심은
//     판정 라벨과 두 사람 이름이다.
//  ② **"볼 수 없는 축"이 있다.** 시주를 모르거나 대운을 못 구하면 그 축은 값이 아니라
//     "볼 수 없음"으로 그려야 한다. 못 본 것을 평범한 결과처럼 그리면 화면이 거짓말을 한다.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

import Header from "@/components/layout/Header";
import { FullScreenLoading } from "@/components/loading";
import { COUPLE_COST } from "@/lib/constants/coins";

/* ── 공통 토큰 (marriage 결과와 동일) ── */
const EYEBROW = "text-[13px] font-semibold tracking-wide text-primary";
const BODY = "text-[16px] leading-[1.85] text-text-secondary break-keep whitespace-pre-line";

type AxisKey = "마음" | "생활" | "보완" | "시기";
type AxisVerdict = "순" | "평" | "역" | "모름";

const AXIS_META: Record<AxisKey, { title: string; sub: string; left: string; right: string }> = {
  마음: { title: "마음의 결", sub: "타고난 바탕이 만났을 때", left: "부딪힌다", right: "끌린다" },
  생활: { title: "생활의 결", sub: "같이 살면서 닿는 자리", left: "부딪힌다", right: "붙는다" },
  보완: { title: "서로 채우는가", sub: "부족한 걸 메워주는지", left: "건드린다", right: "채운다" },
  시기: { title: "때가 맞는가", sub: "둘 다 열리는 해", left: "엇갈린다", right: "겹친다" },
};

// 3단계 고정 포지션. 연속 점수가 아니다 — 판정이 3단계라 그 이상 정밀하게 그리면 거짓 정밀도가 된다.
const VERDICT_POS: Record<AxisVerdict, number> = { 역: 16, 평: 50, 순: 84, 모름: 50 };

const VERDICT_LABEL: Record<AxisVerdict, string> = {
  순: "순하게 흐른다",
  평: "무난하다",
  역: "손이 간다",
  모름: "볼 수 없음",
};

/* ── 스크롤 진입 애니메이션 (marriage 미러) ── */
function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${className ?? ""} transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      {children}
    </div>
  );
}

/* ── 히어로 ── */
function OpeningScene({
  nameA,
  nameB,
  verdict,
  axes,
}: {
  nameA: string;
  nameB: string;
  verdict: string;
  axes: Record<AxisKey, AxisVerdict>;
}) {
  return (
    <section className="relative flex min-h-[82vh] flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* couple 전용 배경 1장. 결혼운(bg-love)·재물운(bg-wealth)과 같은 자리·같은 처리. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/couple/bg-couple.webp"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-top opacity-[0.65]"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background-primary/30 via-background-primary/20 to-background-primary"
        aria-hidden="true"
      />
      {/* 등급이 없으므로 글로우는 등급색이 아니라 브랜드 톤 고정 */}
      <div
        className="pointer-events-none absolute left-1/2 top-[42%] h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[70px] opacity-60"
        style={{ background: "radial-gradient(circle, rgba(255,107,107,0.55) 0%, rgba(255,107,107,0) 70%)" }}
        aria-hidden="true"
      />

      <div className="relative flex flex-col items-center">
        <span className="mb-6 text-[13px] text-text-secondary">둘이서 · 결혼 판정</span>

        {/* 두 사람 — 등급 배지 자리를 대신하는 앵커 */}
        <div className="flex items-center gap-4">
          <span className="font-aggro text-[22px] text-text-primary">{nameA}</span>
          <span className="text-[15px] text-text-tertiary">✕</span>
          <span className="font-aggro text-[22px] text-text-primary">{nameB}</span>
        </div>

        <h1 className="mt-6 font-aggro text-[30px] leading-[1.3] tracking-tight text-text-primary break-keep max-w-[420px]">
          {verdict}
        </h1>

        {/* 4축 미니 신호등 — 스크롤 전에 전체 그림을 먼저 보여준다 */}
        <div className="mt-9 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
          {(Object.keys(AXIS_META) as AxisKey[]).map((k) => (
            <span
              key={k}
              className="rounded-full border border-white/10 bg-background-secondary/70 px-3 py-1.5 text-[12.5px] text-text-secondary backdrop-blur-sm"
            >
              {k}
              <span
                className={`ml-1.5 font-semibold ${
                  axes[k] === "순"
                    ? "text-primary"
                    : axes[k] === "역"
                      ? "text-text-primary"
                      : "text-text-tertiary"
                }`}
              >
                {axes[k] === "모름" ? "—" : axes[k]}
              </span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── 축 게이지 ── */
function AxisGauge({ axis, verdict }: { axis: AxisKey; verdict: AxisVerdict }) {
  const meta = AXIS_META[axis];
  const unknown = verdict === "모름";
  const v = VERDICT_POS[verdict];

  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[13.5px] font-semibold text-text-secondary">{meta.title}</span>
          <span className="ml-2 text-[12px] text-text-tertiary">{meta.sub}</span>
        </div>
        <span className={`shrink-0 text-[12.5px] ${unknown ? "text-text-tertiary" : "text-text-secondary"}`}>
          {VERDICT_LABEL[verdict]}
        </span>
      </div>

      {/* ★볼 수 없는 축은 값을 그리지 않는다. 위치를 찍으면 화면이 거짓말을 한다. */}
      {unknown ? (
        <div className="relative h-2.5 overflow-hidden rounded-full bg-background-tertiary">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              background:
                "repeating-linear-gradient(135deg, rgba(255,255,255,0.10) 0 6px, transparent 6px 12px)",
            }}
            aria-hidden="true"
          />
        </div>
      ) : (
        <div className="relative h-2.5 overflow-hidden rounded-full bg-background-tertiary">
          <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-white/15" aria-hidden="true" />
          <div
            className="absolute top-0 bottom-0 bg-primary/30 transition-[left,right] duration-700 ease-out"
            style={v >= 50 ? { left: "50%", right: `${100 - v}%` } : { left: `${v}%`, right: "50%" }}
          />
          <div
            className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_12px_rgba(255,107,107,0.6)] transition-[left] duration-700 ease-out"
            style={{ left: `${v}%` }}
          />
        </div>
      )}

      <div className="mt-2 flex justify-between text-[11.5px] text-text-tertiary">
        <span>{meta.left}</span>
        <span>{meta.right}</span>
      </div>
    </div>
  );
}

/* ── 본문 ── */
type CoupleResult = {
  headline?: string;
  mindScene?: string;
  lifeScene?: string;
  complement?: string;
  timing?: string;
  advice?: string[];
};

type CompletedData = {
  status: "completed";
  resultId: string;
  names: { a: string; b: string };
  verdict: string;
  axes: Record<AxisKey, AxisVerdict>;
  neutralizedAxes: AxisKey[];
  currentYear: number;
  facts: { fortuneCross?: { timingOverlapYears?: number[] } } | null;
  result: CoupleResult;
};

type TeaserData = {
  status: "teaser";
  resultId: string;
  names: { a: string; b: string };
  teaser: { partnerName?: string; neutralizedAxes?: AxisKey[]; hasTimingOverlap?: boolean };
};

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Reveal>
      <section className="px-6 pt-16">
        <p className={EYEBROW}>{eyebrow}</p>
        <h2 className="mt-3 font-aggro text-[26px] leading-[1.32] break-keep text-text-primary">{title}</h2>
        {children}
      </section>
    </Reveal>
  );
}

function CompletedView({ data }: { data: CompletedData }) {
  const router = useRouter();
  const r = data.result ?? {};
  const overlapYears = data.facts?.fortuneCross?.timingOverlapYears ?? [];
  const dead = new Set(data.neutralizedAxes ?? []);

  return (
    <div className="min-h-screen bg-background-primary text-text-primary pb-32">
      <Header showBack sticky onBack={() => router.push("/menu")} />

      <main className="mx-auto max-w-[640px] animate-fadeIn">
        <OpeningScene
          nameA={data.names.a || "너"}
          nameB={data.names.b || "상대"}
          verdict={data.verdict}
          axes={data.axes}
        />

        {r.headline && (
          <Reveal>
            <section className="px-6 pt-14">
              <p className="text-[19px] font-bold leading-[1.6] text-text-primary break-keep">{r.headline}</p>
            </section>
          </Reveal>
        )}

        <Section eyebrow="네 축" title="둘 사이를 네 갈래로 봤어">
          <div className="mt-8 space-y-7 rounded-3xl bg-background-secondary px-6 py-7">
            {(Object.keys(AXIS_META) as AxisKey[]).map((k) => (
              <AxisGauge key={k} axis={k} verdict={data.axes[k]} />
            ))}
          </div>

          {/* ★볼 수 없는 축이 있으면 그 사실을 숨기지 않고 적는다. */}
          {dead.size > 0 && (
            <p className="mt-4 rounded-2xl border border-white/5 bg-background-secondary/60 px-4 py-3 text-[13px] leading-relaxed text-text-tertiary break-keep">
              {[...dead].join("·")} 축은 태어난 시간을 몰라서 볼 수 없었어. 없는 게 아니라 못 본 거야 — 그래서
              단정하지 않았어.
            </p>
          )}
        </Section>

        {r.mindScene && (
          <Section eyebrow="마음의 결" title="바탕이 만나면 이렇게 돼">
            <p className={`mt-7 ${BODY}`}>{r.mindScene}</p>
          </Section>
        )}

        {r.lifeScene && (
          <Section eyebrow="생활의 결" title="같이 살면 이런 자리에서 갈려">
            <p className={`mt-7 ${BODY}`}>{r.lifeScene}</p>
          </Section>
        )}

        {r.complement && (
          <Section eyebrow="서로 채우는가" title="한쪽이 비면 다른 쪽이 메우나">
            <p className={`mt-7 ${BODY}`}>{r.complement}</p>
          </Section>
        )}

        {r.timing && (
          <Section eyebrow="때" title="둘 다 열리는 해">
            {overlapYears.length > 0 && (
              <div className="mt-7 flex flex-wrap gap-2">
                {overlapYears.map((y) => (
                  <span
                    key={y}
                    className="rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-[14px] font-semibold text-primary"
                  >
                    {y}년
                  </span>
                ))}
              </div>
            )}
            <p className={`mt-6 ${BODY}`}>{r.timing}</p>
          </Section>
        )}

        {Array.isArray(r.advice) && r.advice.length > 0 && (
          <Section eyebrow="해볼 것" title="당장 써먹을 수 있는 것">
            <ul className="mt-7 space-y-4">
              {r.advice.map((a, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  <p className="text-[15.5px] leading-[1.8] text-text-secondary break-keep">{a}</p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Reveal>
          <p className="px-6 pt-16 text-[12.5px] leading-relaxed text-text-tertiary break-keep">
            이 판정은 두 사람 사주를 함께 계산해 나온 결과야. 사람은 사주로만 정해지지 않아 — 참고로 봐줘.
          </p>
        </Reveal>
      </main>
    </div>
  );
}

/* ── 티저(결제 전) ── */
function TeaserView({ data }: { data: TeaserData }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unlock = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/couple/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId: data.resultId }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json?.insufficient) {
          router.push("/coins");
          return;
        }
        setError(json?.error ?? "잠시 후 다시 시도해줘.");
        return;
      }
      router.refresh();
      window.location.reload();
    } catch {
      setError("잠시 후 다시 시도해줘.");
    } finally {
      setBusy(false);
    }
  }, [data.resultId, router]);

  return (
    <div className="min-h-screen bg-background-primary text-text-primary pb-32">
      <Header showBack sticky onBack={() => router.push("/menu")} />

      <main className="mx-auto max-w-[640px] animate-fadeIn">
        <section className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden px-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/couple/bg-couple.webp"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover object-top opacity-[0.5]"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background-primary/40 via-background-primary/30 to-background-primary"
            aria-hidden="true"
          />
          <div className="relative flex flex-col items-center">
            <span className="mb-6 text-[13px] text-text-secondary">둘이서 · 결혼 판정</span>
            <div className="flex items-center gap-4">
              <span className="font-aggro text-[22px] text-text-primary">{data.names.a || "너"}</span>
              <span className="text-[15px] text-text-tertiary">✕</span>
              <span className="font-aggro text-[22px] text-text-primary">{data.names.b || "상대"}</span>
            </div>

            {/* ★판정은 결제 전에 안 보여준다. 그래서 가린 자리를 보여준다. */}
            <div className="mt-7 rounded-3xl border border-white/10 bg-background-secondary/70 px-8 py-7 backdrop-blur-sm">
              <p className="font-aggro text-[26px] tracking-widest text-text-tertiary">? ? ?</p>
              <p className="mt-3 text-[13px] text-text-tertiary">판정은 결제 후에 열려</p>
            </div>

            <p className="mt-8 max-w-[380px] text-[15px] leading-[1.75] text-text-secondary break-keep">
              두 사람 사주를 다 세워서, 같은 상황에서 둘이 어떻게 다르게 반응하는지까지 봤어.
            </p>
          </div>
        </section>

        <Reveal>
          <section className="px-6 pt-12">
            <div className="space-y-3 rounded-3xl bg-background-secondary px-6 py-7">
              {["마음의 결", "생활의 결", "서로 채우는가", "때가 맞는가"].map((t) => (
                <div key={t} className="flex items-center justify-between">
                  <span className="text-[14.5px] text-text-secondary">{t}</span>
                  <span className="text-[13px] text-text-tertiary">?</span>
                </div>
              ))}
            </div>
            {data.teaser?.hasTimingOverlap && (
              <p className="mt-4 text-[13.5px] leading-relaxed text-text-secondary break-keep">
                둘 다 열리는 해가 실제로 잡혔어. 몇 년인지는 안에서 알려줄게.
              </p>
            )}
          </section>
        </Reveal>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background-primary via-background-primary to-transparent px-5 pb-5 pt-8">
        <div className="mx-auto max-w-[640px]">
          {error && <p className="mb-3 text-center text-[13px] text-red-400">{error}</p>}
          <button
            type="button"
            onClick={unlock}
            disabled={busy}
            className="w-full rounded-2xl bg-primary py-4 text-[16px] font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? "여는 중..." : `${COUPLE_COST}알로 판정 보기`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 진입점 ── */
export default function CoupleResultClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status: authStatus } = useSession();
  const [data, setData] = useState<CompletedData | TeaserData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const id = searchParams.get("id");

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/couple/results${id ? `?id=${encodeURIComponent(id)}` : ""}`);
        const json = await res.json();
        if (!alive) return;
        if (!res.ok) {
          setError(json?.error ?? "결과를 불러오지 못했어.");
          return;
        }
        setData(json);
      } catch {
        if (alive) setError("결과를 불러오지 못했어.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [authStatus, id]);

  if (authStatus === "loading" || (!data && !error)) return <FullScreenLoading />;

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background-primary px-6 text-center">
        <p className="text-[15px] text-text-secondary break-keep">{error}</p>
        <button
          type="button"
          onClick={() => router.push("/menu")}
          className="mt-6 rounded-2xl bg-background-secondary px-5 py-3 text-[14px] text-text-primary"
        >
          메뉴로
        </button>
      </div>
    );
  }

  if (data?.status === "teaser") return <TeaserView data={data} />;
  if (data?.status === "completed") return <CompletedView data={data} />;
  return <FullScreenLoading />;
}
