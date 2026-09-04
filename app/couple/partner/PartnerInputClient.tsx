"use client";

// 상대(B) 정보 입력 — couple 고유 화면.
//
// ★필수는 이름·생년월일·성별뿐이다. 태어난 시간은 선택이고, 모르면 "모름"으로 받는다.
//   빈 값을 0시로 읽으면 **있지도 않은 시주**가 생기고, 그 가짜 시주가 두 사람 여덟 글자
//   대조에 들어가 없는 관계를 지어낸다. 그래서 기본값이 "모름"이고, 시간을 켜야 입력칸이 열린다.
//
// ★성별이 필수인 이유를 화면에 적는다 — 사람들이 왜 묻는지 모르면 이탈한다.
//   대운이 성별로 순행·역행이 갈려서 없으면 계산 자체가 안 된다.

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import Header from "@/components/layout/Header";
import { useAllInputs, hasInputHydrated } from "@/store/useInputStore";
import { useCoupleStore, isPartnerReady, type PartnerDraft } from "@/store/useCoupleStore";

const LABEL = "text-[13.5px] font-semibold text-text-secondary";
const FIELD =
  "w-full rounded-2xl border border-white/10 bg-background-secondary px-4 py-3.5 text-[16px] text-text-primary placeholder:text-text-tertiary outline-none transition focus:border-primary/50";

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-3 text-[15px] font-medium transition active:scale-[0.98] ${
        active
          ? "border-primary bg-primary/10 text-text-primary"
          : "border-white/10 bg-background-secondary text-text-secondary"
      }`}
    >
      {children}
    </button>
  );
}

export default function PartnerInputClient() {
  const router = useRouter();
  const { status } = useSession();
  const partner = useCoupleStore((s) => s.partner);
  const setPartner = useCoupleStore((s) => s.setPartner);
  const selfInputs = useAllInputs();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [badFields, setBadFields] = useState<string[]>([]);

  const ready = isPartnerReady(partner);

  // 대표사주가 없어 /couple/self 를 거쳐 온 경우 그 입력을 그대로 넘긴다.
  // ★start 에는 반드시 "같은 스토어에서 읽은 같은 값"을 넘겨야 한다(marriage teaser 의 생명선 규칙).
  const selfInput = useMemo(
    () => ({
      name: selfInputs.name,
      birthYear: selfInputs.birthYear,
      birthMonth: selfInputs.birthMonth,
      birthDay: selfInputs.birthDay,
      birthHour: selfInputs.birthHour,
      birthMinute: selfInputs.birthMinute,
      birthLocation: selfInputs.birthLocation,
      gender: selfInputs.gender,
      calendarType: selfInputs.calendarType,
      isLeapMonth: selfInputs.isLeapMonth,
      unknownBirthTime: selfInputs.unknownBirthTime,
    }),
    [selfInputs],
  );

  const hasSelfDraft = Boolean(hasInputHydrated() && selfInputs.birthYear && selfInputs.gender);

  const submit = useCallback(async () => {
    if (!ready || busy) return;
    if (status !== "authenticated") {
      router.push(`/login?callbackUrl=${encodeURIComponent("/couple/partner")}`);
      return;
    }
    setBusy(true);
    setError(null);
    setBadFields([]);
    try {
      const res = await fetch("/api/couple/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // 자체입력을 거쳐 왔으면 self, 아니면 대표사주.
          source: hasSelfDraft ? "self" : "primary",
          selfInput: hasSelfDraft ? selfInput : undefined,
          partner,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (Array.isArray(json?.fields)) setBadFields(json.fields);
        setError(json?.error ?? "잠시 후 다시 시도해줘.");
        return;
      }
      router.push(`/couple/result?id=${encodeURIComponent(json.resultId)}`);
    } catch {
      setError("잠시 후 다시 시도해줘.");
    } finally {
      setBusy(false);
    }
  }, [ready, busy, status, router, hasSelfDraft, selfInput, partner, setBadFields]);

  const set = (patch: Partial<PartnerDraft>) => setPartner(patch);
  const invalid = (f: string) => badFields.includes(f);

  return (
    <div className="mx-auto min-h-screen w-full max-w-[440px] bg-background-primary text-text-primary">
      <Header showBack sticky onBack={() => router.push("/couple")} />

      <main className="px-5 pb-40 pt-6">
        <p className="text-[12px] font-medium text-text-tertiary">2단계 · 상대</p>
        <h1 className="mt-1 font-aggro text-[24px] leading-[1.35] break-keep">
          상대 정보를 알려줘
        </h1>
        <p className="mt-2.5 text-[14px] leading-relaxed text-text-secondary break-keep">
          이름·생년월일·성별만 있으면 돼. 태어난 시간은 몰라도 괜찮아.
        </p>

        <div className="mt-8 space-y-6">
          <div>
            <label className={LABEL} htmlFor="p-name">
              이름 <span className="text-primary">*</span>
            </label>
            <input
              id="p-name"
              value={partner.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="부르는 이름이면 돼"
              maxLength={20}
              className={`mt-2 ${FIELD} ${invalid("name") ? "border-red-400/60" : ""}`}
            />
          </div>

          <div>
            <span className={LABEL}>
              생년월일 <span className="text-primary">*</span>
            </span>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <input
                value={partner.birthYear}
                onChange={(e) => set({ birthYear: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                placeholder="1995"
                inputMode="numeric"
                className={`${FIELD} text-center ${invalid("birthYear") ? "border-red-400/60" : ""}`}
              />
              <input
                value={partner.birthMonth}
                onChange={(e) => set({ birthMonth: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                placeholder="6"
                inputMode="numeric"
                className={`${FIELD} text-center ${invalid("birthMonth") ? "border-red-400/60" : ""}`}
              />
              <input
                value={partner.birthDay}
                onChange={(e) => set({ birthDay: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                placeholder="21"
                inputMode="numeric"
                className={`${FIELD} text-center ${invalid("birthDay") ? "border-red-400/60" : ""}`}
              />
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <Chip active={partner.calendarType === "solar"} onClick={() => set({ calendarType: "solar", isLeapMonth: false })}>
                양력
              </Chip>
              <Chip active={partner.calendarType === "lunar"} onClick={() => set({ calendarType: "lunar" })}>
                음력
              </Chip>
            </div>

            {/* ★윤달을 빠뜨리면 완전히 다른 사주가 된다. 음력일 때만 묻는다. */}
            {partner.calendarType === "lunar" && (
              <button
                type="button"
                onClick={() => set({ isLeapMonth: !partner.isLeapMonth })}
                className="mt-2.5 flex w-full items-center gap-2.5 rounded-2xl border border-white/10 bg-background-secondary px-4 py-3 text-left"
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    partner.isLeapMonth ? "border-primary bg-primary" : "border-white/20"
                  }`}
                >
                  {partner.isLeapMonth && <span className="text-[12px] leading-none text-white">✓</span>}
                </span>
                <span className="text-[14px] text-text-secondary">윤달이야</span>
              </button>
            )}
          </div>

          <div>
            <span className={LABEL}>
              성별 <span className="text-primary">*</span>
            </span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Chip active={partner.gender === "남성"} onClick={() => set({ gender: "남성" })}>
                남성
              </Chip>
              <Chip active={partner.gender === "여성"} onClick={() => set({ gender: "여성" })}>
                여성
              </Chip>
            </div>
            {/* 왜 묻는지 안 적으면 이탈한다 */}
            <p className="mt-2 text-[12.5px] leading-relaxed text-text-tertiary break-keep">
              운의 흐름이 성별에 따라 반대로 흘러서, 없으면 계산 자체가 안 돼.
            </p>
          </div>

          <div>
            <span className={LABEL}>태어난 시간</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Chip active={partner.unknownBirthTime} onClick={() => set({ unknownBirthTime: true })}>
                몰라
              </Chip>
              <Chip active={!partner.unknownBirthTime} onClick={() => set({ unknownBirthTime: false })}>
                알아
              </Chip>
            </div>

            {!partner.unknownBirthTime && (
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <input
                  value={partner.birthHour}
                  onChange={(e) => set({ birthHour: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                  placeholder="시 (0~23)"
                  inputMode="numeric"
                  className={`${FIELD} text-center`}
                />
                <input
                  value={partner.birthMinute}
                  onChange={(e) => set({ birthMinute: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                  placeholder="분"
                  inputMode="numeric"
                  className={`${FIELD} text-center`}
                />
              </div>
            )}

            {/* ★모른다고 대충 채우지 않는다는 걸 알린다 */}
            <p className="mt-2 text-[12.5px] leading-relaxed text-text-tertiary break-keep">
              모르면 몰라도 돼. 억지로 채우지 않고, 시간이 있어야 보이는 자리는{" "}
              <span className="text-text-secondary">&ldquo;못 봤다&rdquo;고 표시해</span>. 없는 걸 있다고 하지
              않아.
            </p>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 mx-auto max-w-[440px] bg-gradient-to-t from-background-primary via-background-primary to-transparent px-5 pb-5 pt-8">
        {error && <p className="mb-3 text-center text-[13px] text-red-400 break-keep">{error}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={!ready || busy}
          className="w-full rounded-2xl bg-primary py-4 text-[16px] font-bold text-white transition active:scale-[0.99] disabled:opacity-40"
        >
          {busy ? "보는 중..." : "미리보기 만들기"}
        </button>
        <p className="mt-2.5 text-center text-[12px] text-text-tertiary">여기까지 무료</p>
      </div>
    </div>
  );
}
