"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0F0F14",
          color: "#E0E0E0",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: "0 24px",
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
          오류가 발생했습니다
        </h2>
        <p
          style={{
            fontSize: 15,
            color: "#999",
            marginBottom: 32,
            textAlign: "center",
          }}
        >
          예상치 못한 문제가 발생했어요. 다시 시도해 주세요.
        </p>
        <button
          onClick={() => reset()}
          style={{
            padding: "14px 32px",
            fontSize: 15,
            fontWeight: 600,
            color: "#fff",
            backgroundColor: "#6C5CE7",
            border: "none",
            borderRadius: 16,
            cursor: "pointer",
          }}
        >
          다시 시도
        </button>
      </body>
    </html>
  );
}
