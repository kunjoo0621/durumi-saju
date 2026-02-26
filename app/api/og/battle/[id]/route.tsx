import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

let fontCache: ArrayBuffer | null = null;
let craneBase64: string | null = null;

async function getFont(): Promise<ArrayBuffer> {
  if (fontCache) return fontCache;
  const res = await fetch(
    "https://cdn.jsdelivr.net/gh/orioncactus/pretendard/packages/pretendard/dist/public/static/Pretendard-Bold.otf"
  );
  fontCache = await res.arrayBuffer();
  return fontCache;
}

function getCraneImage(): string | null {
  if (craneBase64) return craneBase64;
  try {
    const buf = readFileSync(join(process.cwd(), "public/images/og/crane-og.png"));
    craneBase64 = `data:image/png;base64,${buf.toString("base64")}`;
    return craneBase64;
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
    .from("saju_battles")
    .select("player_a_name, player_b_name")
    .eq("id", id)
    .single();

  if (!data) {
    return new Response("Not Found", { status: 404 });
  }

  const fontData = await getFont();
  const craneSrc = getCraneImage();

  const nameA = data.player_a_name || "???";
  const nameB = data.player_b_name || "???";

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
          {/* 사이트명 */}
          <div
            style={{
              fontSize: "22px",
              color: "#9CA3AF",
              marginBottom: "24px",
              display: "flex",
            }}
          >
            사주보는 두루미
          </div>

          {/* VS 대결 */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "16px",
              marginBottom: "20px",
            }}
          >
            <span style={{ fontSize: "44px", fontWeight: "bold", color: "#FF6B6B" }}>
              {nameA}
            </span>
            <span style={{ fontSize: "32px", color: "#6B7280" }}>vs</span>
            <span style={{ fontSize: "44px", fontWeight: "bold", color: "#3B82F6" }}>
              {nameB}
            </span>
          </div>

          {/* 캐치카피 — 승자 미노출 */}
          <div
            style={{
              fontSize: "28px",
              color: "#E5E7EB",
              display: "flex",
            }}
          >
            사주 대결! 승자는?
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
