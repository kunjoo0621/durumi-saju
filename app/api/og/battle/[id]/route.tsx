import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

let craneBase64: string | null = null;

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

export async function GET() {
  const craneSrc = getCraneImage();

  if (!craneSrc) {
    return new Response("Image not found", { status: 500 });
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: "#0D0D0D",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={craneSrc}
          width={1200}
          height={630}
          style={{ objectFit: "cover", width: "100%", height: "100%" }}
          alt=""
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    }
  );
}
