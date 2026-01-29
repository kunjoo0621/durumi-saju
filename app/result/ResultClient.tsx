"use client";

import { useEffect, useState } from "react";
import JSON5 from "json5";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import MenuDrawer from "../MenuDrawer";
import {
  calculateSaju,
  formatSajuText,
  getHeavenlyStemElement,
  getEarthlyBranchElement,
  ELEMENT_COLORS,
  ELEMENT_BG_COLORS,
  getStemLabel,
  getBranchLabel,
  getElementName,
  getTenGod,
  getMainHiddenStem,
  type SajuData,
} from "@/lib/utils/saju";
import { convertLunarToSolar, formatDisplayDate, type CalendarType } from "@/lib/utils/lunar";

type AnalysisResult = {
  tier: {
    grade: string;
    percentile: number;
    title: string;
    description: string;
  };
  scores: {
    [key: string]: {
      score: number;
      grade: string;
    };
  };
  sections: Array<{
    icon: string;
    title: string;
    content: string;
  }>;
};

export default function ResultClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));
  const [sajuData, setSajuData] = useState<SajuData | null>(null);
  const [saved, setSaved] = useState(false);
  const [displayCalendarType, setDisplayCalendarType] = useState<CalendarType>("solar");
  const [displayBirthDate, setDisplayBirthDate] = useState<string>("");

  const extractJson = (text: string) => {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) {
      return fenced[1].trim();
    }
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      return text.slice(first, last + 1).trim();
    }
    return text.trim();
  };

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const hasQuery = searchParams.get("birthYear") && searchParams.get("birthMonth") && searchParams.get("birthDay");

        if (!hasQuery) {
          const supabaseId = (session?.user as { supabaseId?: string } | undefined)?.supabaseId;
          if (!supabaseId) {
            throw new Error("조회할 결과가 없습니다.");
          }

          const res = await fetch("/api/results");
          if (!res.ok) {
            throw new Error("이전 결과를 불러오는데 실패했습니다.");
          }
          const data = await res.json();
          const latest = data?.results?.[0];
          if (!latest) {
            throw new Error("저장된 결과가 없습니다.");
          }

          const birthDate = latest.birth_date as string | null;
          const birthTime = latest.birth_time as string | null;
          const calendarType = (latest.calendar_type as CalendarType | null) || "solar";

          setDisplayCalendarType(calendarType);

          if (birthDate) {
            const [y, m, d] = birthDate.split("-");
            const hour = birthTime ? parseInt(birthTime.split(":")[0] || "0") : undefined;
            const minute = birthTime ? parseInt(birthTime.split(":")[1] || "0") : undefined;
            setDisplayBirthDate(formatDisplayDate(parseInt(y), parseInt(m), parseInt(d)));

            let calcYear = parseInt(y);
            let calcMonth = parseInt(m);
            let calcDay = parseInt(d);
            if (calendarType === "lunar") {
              const converted = convertLunarToSolar(calcYear, calcMonth, calcDay);
              if (converted) {
                calcYear = converted.year;
                calcMonth = converted.month;
                calcDay = converted.day;
              }
            }

            const saju = await calculateSaju(calcYear, calcMonth, calcDay, hour, minute);
            setSajuData(saju);
          }

          setResult(latest.result);
          setLoading(false);
          return;
        }

        const birthYear = parseInt(searchParams.get("birthYear") || "0");
        const birthMonth = parseInt(searchParams.get("birthMonth") || "0");
        const birthDay = parseInt(searchParams.get("birthDay") || "0");
        const birthHour = searchParams.get("birthHour") ? parseInt(searchParams.get("birthHour")!) : undefined;
        const birthMinute = searchParams.get("birthMinute") ? parseInt(searchParams.get("birthMinute")!) : undefined;
        const unknownBirthTime = searchParams.get("unknownBirthTime") === "true";
        const calendarType = (searchParams.get("calendarType") as CalendarType) || "solar";

        setDisplayCalendarType(calendarType);
        setDisplayBirthDate(formatDisplayDate(birthYear, birthMonth, birthDay));

        // 사주팔자 계산
        let calcYear = birthYear;
        let calcMonth = birthMonth;
        let calcDay = birthDay;
        if (calendarType === "lunar") {
          const converted = convertLunarToSolar(calcYear, calcMonth, calcDay);
          if (converted) {
            calcYear = converted.year;
            calcMonth = converted.month;
            calcDay = converted.day;
          }
        }
        const saju = await calculateSaju(calcYear, calcMonth, calcDay, birthHour, birthMinute);
        setSajuData(saju);

        const formData = {
          name: searchParams.get("name"),
          birthYear: birthYear.toString(),
          birthMonth: birthMonth.toString(),
          birthDay: birthDay.toString(),
          calendarType,
          birthHour: birthHour?.toString() || "",
          birthMinute: birthMinute?.toString() || "",
          birthLocation: searchParams.get("birthLocation"),
          gender: searchParams.get("gender"),
          relationshipStatus: searchParams.get("relationshipStatus"),
          employmentStatus: searchParams.get("employmentStatus"),
          unknownBirthTime: unknownBirthTime,
          saju: saju ? formatSajuText(saju) : null,
        };

        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "분석에 실패했습니다.");
        }

        // JSON 파싱 (서버에서 객체로 내려올 수도 있음)
        try {
          let parsed: AnalysisResult;
          if (typeof data.result === "string") {
            const cleaned = extractJson(data.result);
            parsed = JSON5.parse(cleaned);
          } else {
            parsed = data.result;
          }
          setResult(parsed);
        } catch (e) {
          console.error("JSON 파싱 오류:", e);
          console.log("원본 응답:", data.result);
          throw new Error("결과를 파싱하는데 실패했습니다.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, [searchParams, session]);

  useEffect(() => {
    const saveResult = async () => {
      const supabaseId = (session?.user as { supabaseId?: string } | undefined)?.supabaseId;
      if (!result || saved || !supabaseId) return;

      const birthYear = searchParams.get("birthYear") || "";
      const birthMonth = searchParams.get("birthMonth") || "";
      const birthDay = searchParams.get("birthDay") || "";
      const birthHour = searchParams.get("birthHour") || "";
      const birthMinute = searchParams.get("birthMinute") || "";
      const calendarType = (searchParams.get("calendarType") as CalendarType) || "solar";

      const birthDate = birthYear && birthMonth && birthDay
        ? `${birthYear}-${birthMonth.padStart(2, "0")}-${birthDay.padStart(2, "0")}`
        : null;
      const birthTime = birthHour && birthMinute ? `${birthHour}:${birthMinute}` : null;

      try {
        await fetch("/api/results", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: searchParams.get("name"),
            birthDate,
            birthTime,
            region: searchParams.get("birthLocation"),
            gender: searchParams.get("gender"),
            relationshipStatus: searchParams.get("relationshipStatus"),
            employmentStatus: searchParams.get("employmentStatus"),
            calendarType,
            result,
          }),
        });
        setSaved(true);
      } catch {
        // 저장 실패는 UX를 막지 않도록 조용히 무시
      }
    };

    saveResult();
  }, [result, saved, session, searchParams]);

  const toggleSection = (index: number) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSections(newExpanded);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg-primary px-6">
        <div className="max-w-md w-full text-center">
          <div className="mb-6">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" aria-label="로딩 중" />
          </div>
          <h2 className="text-title-2 text-text-primary mb-2">운명을 분석하고 있어요</h2>
          <p className="text-body-2 text-text-secondary">잠시만 기다려주세요...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg-primary px-6">
        <div className="max-w-md w-full text-center">
          <div className="mb-6 text-6xl" aria-hidden="true">⚠️</div>
          <h2 className="text-title-2 text-text-primary mb-4">분석에 실패했습니다</h2>
          <p className="text-body-2 text-text-secondary mb-8">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="btn-primary px-8 py-4 rounded-2xl text-button-md transition-colors"
          >
            처음으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* 헤더 */}
      <header className="px-6 py-5 sticky top-0 z-[100] bg-bg-primary">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="w-10" />
          <h1 className="text-title-3 text-text-primary text-center font-aggro">사주보는 두루미</h1>
          <MenuDrawer />
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="px-6 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* 등급 카드 */}
          {(() => {
            const grade = result.tier.grade.trim().toUpperCase();
            const gradeKey = grade.startsWith("S")
              ? "S"
              : grade.startsWith("A")
              ? "A"
              : grade.startsWith("B")
              ? "B"
              : grade.startsWith("C")
              ? "C"
              : "D";
            const gradeBackgrounds: Record<string, string> = {
              S: "#2E1A2E",
              A: "#2E1A1A",
              B: "#1A2E1A",
              C: "#2E2A1A",
              D: "#1A1A1A",
            };
            const gradeTextColors: Record<string, string> = {
              S: "#C084FC",
              A: "#FF6B6B",
              B: "#4ADE80",
              C: "#FBBF24",
              D: "#A3A3A3",
            };

            return (
              <div
                className="rounded-3xl p-8 text-center"
                style={{ backgroundColor: gradeBackgrounds[gradeKey] }}
                role="region"
                aria-label="사주 등급"
              >
                <div className="text-6xl font-bold mb-2" style={{ color: gradeTextColors[gradeKey] }}>
                  {result.tier.grade}
                </div>
            <div className="text-title-2 text-white/90 mb-4">상위 {result.tier.percentile}%</div>
            <div className="text-title-3 text-white mb-3">{result.tier.title}</div>
            <p className="text-body-2 text-white/80">{result.tier.description}</p>
              </div>
            );
          })()}

          {/* 만세력 (사주팔자) */}
          {sajuData && (
            <div className="bg-bg-secondary rounded-3xl p-6 md:p-8 border-0">
              {displayBirthDate && (
                <p className="text-[14px] text-text-tertiary mb-4">
                  ({displayCalendarType === "lunar" ? "음력" : "양력"} {displayBirthDate} 기준)
                </p>
              )}
              {(() => {
                const dayStem = sajuData.day.heavenlyStem;
                const pillars = [
                  { key: "hour", label: "생시", data: sajuData.hour },
                  { key: "day", label: "생일", data: sajuData.day },
                  { key: "month", label: "생월", data: sajuData.month },
                  { key: "year", label: "생년", data: sajuData.year },
                ];

                return (
                  <div className="grid grid-cols-4 gap-2">
                    {/* 라벨 */}
                    {pillars.map(({ key, label }) => (
                      <div key={`label-${key}`} className="px-4 py-3 text-center text-[14px] text-text-tertiary bg-bg-primary rounded-xl">
                        {label}
                      </div>
                    ))}

                    {/* 천간 + 오행 */}
                    {pillars.map(({ key, data }) => {
                      const element = getHeavenlyStemElement(data.heavenlyStem);
                      const color = element ? ELEMENT_COLORS[element] : "#E5E5E5";
                      const bgColor = element ? ELEMENT_BG_COLORS[element] : "#262626";
                      return (
                        <div key={`stem-${key}`} className="px-4 py-4 text-center rounded-xl" style={{ backgroundColor: bgColor }}>
                          <div className="text-[28px] font-semibold" style={{ color }}>
                            {getStemLabel(data.heavenlyStem)}
                          </div>
                          {element && (
                            <div className="text-[12px] text-text-secondary mt-1">
                              {getElementName(element)}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* 천간 십성 */}
                    {pillars.map(({ key, data }) => (
                      <div key={`stem-ten-${key}`} className="px-4 py-3 text-center text-[14px] text-text-secondary bg-bg-primary rounded-xl">
                        {getTenGod(dayStem, data.heavenlyStem) || "-"}
                      </div>
                    ))}

                    {/* 지지 + 오행 */}
                    {pillars.map(({ key, data }) => {
                      const element = getEarthlyBranchElement(data.earthlyBranch);
                      const color = element ? ELEMENT_COLORS[element] : "#E5E5E5";
                      const bgColor = element ? ELEMENT_BG_COLORS[element] : "#262626";
                      return (
                        <div key={`branch-${key}`} className="px-4 py-4 text-center rounded-xl" style={{ backgroundColor: bgColor }}>
                          <div className="text-[28px] font-semibold" style={{ color }}>
                            {getBranchLabel(data.earthlyBranch)}
                          </div>
                          {element && (
                            <div className="text-[12px] text-text-secondary mt-1">
                              {getElementName(element)}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* 지지 십성 */}
                    {pillars.map(({ key, data }) => {
                      const mainHiddenStem = getMainHiddenStem(data.earthlyBranch);
                      return (
                        <div key={`branch-ten-${key}`} className="px-4 py-3 text-center text-[14px] text-text-secondary bg-bg-primary rounded-xl">
                          {mainHiddenStem ? getTenGod(dayStem, mainHiddenStem) : "-"}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* 점수 카드 */}
          <div className="bg-bg-secondary rounded-3xl p-6 md:p-8 border-0">
            <div className="space-y-6">
              {Object.entries(result.scores).map(([category, data]) => (
                <div key={category}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-body-2 text-text-primary font-semibold">{category}</span>
                    <span className="text-body-2 font-semibold">
                      <span className="text-primary font-bold">{data.grade}</span>
                      <span className="text-text-tertiary"> · </span>
                      <span className="text-text-secondary">{data.score}점</span>
                    </span>
                  </div>
                  <div
                    className="relative w-full overflow-hidden"
                    style={{ height: "10px", backgroundColor: "#262626", borderRadius: "5px" }}
                    role="progressbar"
                    aria-valuenow={data.score}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${category} ${data.score}점`}
                  >
                    <div
                      className="absolute top-0 left-0 h-full bg-primary transition-all duration-1000 ease-out"
                      style={{ borderRadius: "5px", width: `${data.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 아코디언 섹션들 */}
          <div className="space-y-3">
            {result.sections.map((section, index) => (
              <div
                key={index}
                className="bg-bg-secondary rounded-2xl border-0 overflow-hidden transition-all"
              >
                <button
                  onClick={() => toggleSection(index)}
                  className="btn-option w-full px-6 py-5 flex items-center justify-between transition-colors"
                  aria-expanded={expandedSections.has(index)}
                  aria-controls={`section-content-${index}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl" aria-hidden="true">{section.icon}</span>
                    <span className="text-title-3 text-text-primary">{section.title}</span>
                  </div>
                  <svg
                    className={`w-6 h-6 text-text-secondary transition-transform ${
                      expandedSections.has(index) ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {expandedSections.has(index) && (
                  <div id={`section-content-${index}`} className="px-6 pb-6 pt-2">
                    <p className="text-body-2 text-text-primary leading-relaxed whitespace-pre-wrap">
                      {section.content}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* 다시 보기 버튼 */}
      <div className="px-6 py-8">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => router.push("/")}
            className="btn-primary w-full rounded-xl px-4 py-4 text-[15px] font-semibold leading-none transition-all duration-200"
          >
            다시 보기
          </button>
        </div>
      </div>

      {/* 푸터 */}
      <footer className="px-6 py-12">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[11px] text-text-tertiary">
            이 분석은 AI를 활용한 참고 자료입니다.
            <br />
            실제 운명은 당신의 선택과 노력에 달려있습니다.
          </p>
        </div>
      </footer>
    </div>
  );
}
