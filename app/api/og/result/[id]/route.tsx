import { ImageResponse } from "next/og";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseJson5Loose } from "@/lib/json5Utils";
import { normalizeScores } from "@/lib/resultSchema";
import type { AnalysisResult } from "@/lib/analysis";
import {
  normalizeComposite,
  gradeFromComposite,
  percentileRankFromComposite,
  topPercentFromPercentileRank,
  COMPOSITE_GRADE_CUTOFFS,
} from "@/lib/gradeSystem";

const GRADE_COLORS: Record<string, string> = {
  S: "#A855F7",
  A: "#EF4444",
  B: "#22C55E",
  C: "#EAB308",
  D: "#6B7280",
};

const CATEGORY_LABELS: Record<string, string> = {
  재물운: "재물",
  연애운: "연애",
  직장운: "직장",
  건강운: "건강",
  대인운: "대인",
};

let fontCache: ArrayBuffer | null = null;
let craneCache: ArrayBuffer | null = null;

async function getFont(): Promise<ArrayBuffer> {
  if (fontCache) return fontCache;
  const res = await fetch(
    "https://cdn.jsdelivr.net/gh/orioncactus/pretendard/packages/pretendard/dist/public/static/Pretendard-Bold.otf"
  );
  fontCache = await res.arrayBuffer();
  return fontCache;
}

async function getCraneImage(): Promise<string | null> {
  try {
    if (!craneCache) {
      const res = await fetch(
        new URL("../../../../../public/images/og/crane-og.png", import.meta.url)
      );
      if (!res.ok) return null;
      craneCache = await res.arrayBuffer();
    }
    const base64 = Buffer.from(craneCache).toString("base64");
    return `data:image/png;base64,${base64}`;
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data } = await supabaseAdmin
    .from("saju_results")
    .select("full_json, name")
    .eq("id", id)
    .single();

  if (!data?.full_json) {
    return new Response("Not Found", { status: 404 });
  }

  let result: AnalysisResult;
  try {
    result =
      typeof data.full_json === "string"
        ? parseJson5Loose<AnalysisResult>(data.full_json)
        : (data.full_json as AnalysisResult);
    result.scores = normalizeScores(result.scores);
  } catch {
    return new Response("Parse Error", { status: 500 });
  }

  const [fontData, craneSrc] = await Promise.all([getFont(), getCraneImage()]);
  const userName = typeof data.name === "string" ? data.name.trim() : "";

  const raw = result.tier;
  const compositeBase =
    typeof raw?.composite === "number" ? raw.composite : 0;
  const composite = normalizeComposite(compositeBase);
  const gradeCandidate =
    typeof raw?.grade === "string" ? raw.grade.trim().toUpperCase() : "";
  const grade = ["S", "A", "B", "C", "D"].includes(gradeCandidate[0])
    ? gradeCandidate[0]
    : gradeFromComposite(composite, COMPOSITE_GRADE_CUTOFFS);
  const percentileRank = percentileRankFromComposite(composite);
  const topPercent = topPercentFromPercentileRank(percentileRank);
  const color = GRADE_COLORS[grade] || "#6B7280";

  const headline = raw?.title || "";
  const safeHeadline = /\d{4}년/.test(headline)
    ? `사주 ${grade}등급 분석 결과`
    : headline;

  const scores = result.scores as Record<string, unknown>;
  const categoryItems = Object.entries(CATEGORY_LABELS).map(([key, label]) => {
    const val = scores?.[key];
    let score = 0;
    if (typeof val === "number") score = val;
    else if (val && typeof val === "object" && "score" in val) {
      score = typeof (val as { score: unknown }).score === "number" ? (val as { score: number }).score : 0;
    }
    const catGrade = gradeFromComposite(score, COMPOSITE_GRADE_CUTOFFS);
    return { label, grade: catGrade };
  });

  const nameText = userName
    ? `두루미가 본 ${userName}님의 사주 결과`
    : "사주보는 두루미";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          backgroundColor: "#0D0D0D",
          color: "white",
          fontFamily: "Pretendard",
          padding: "60px",
        }}
      >
        {/* 왼쪽: 두루미 일러스트 */}
        {craneSrc ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "420px",
              flexShrink: 0,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={craneSrc}
              width={360}
              height={240}
              style={{ objectFit: "contain" }}
              alt=""
            />
          </div>
        ) : null}

        {/* 오른쪽: 텍스트 영역 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            ...(craneSrc ? {} : { alignItems: "center" }),
          }}
        >
          {/* 이름 텍스트 */}
          <div
            style={{
              fontSize: "22px",
              color: "#9CA3AF",
              marginBottom: "20px",
              display: "flex",
            }}
          >
            {nameText}
          </div>

          {/* 등급 + 퍼센트 */}
          <div
            style={{
              fontSize: "48px",
              fontWeight: "bold",
              color,
              marginBottom: "16px",
              display: "flex",
              alignItems: "baseline",
              gap: "12px",
            }}
          >
            <span>{grade}등급</span>
            <span style={{ fontSize: "28px", color: "#9CA3AF" }}>
              상위 {topPercent}%
            </span>
          </div>

          {/* 한줄평 */}
          {safeHeadline && (
            <div
              style={{
                fontSize: "24px",
                color: "#E5E7EB",
                marginBottom: "32px",
                display: "flex",
                maxWidth: "600px",
              }}
            >
              {safeHeadline}
            </div>
          )}

          {/* 카테고리 등급 */}
          <div
            style={{
              display: "flex",
              gap: "20px",
            }}
          >
            {categoryItems.map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "18px",
                  color: "#6B7280",
                }}
              >
                <span>{item.label}</span>
                <span
                  style={{
                    color: GRADE_COLORS[item.grade] || "#6B7280",
                    fontWeight: "bold",
                  }}
                >
                  {item.grade}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Pretendard", data: fontData, style: "normal" as const, weight: 700 as const },
      ],
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    }
  );
}
