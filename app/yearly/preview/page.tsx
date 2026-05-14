/**
 * dev 전용 — /yearly/preview
 * public/__dev__/yearly-sample.json 을 로드해 결과 페이지를 결제·DB 없이 렌더링.
 * 운영자가 로컬에서 yearly 디자인·본문을 검토할 때 사용.
 *
 * 생성: NODE_OPTIONS="--conditions=import" npx tsx scripts/yearly-save-sample.mts
 * 접근: http://localhost:3000/yearly/preview  (dev 서버 + NEXT_PUBLIC_FEATURE_YEARLY=1)
 *
 * production에서는 NODE_ENV !== "development" 이면 notFound() 처리.
 */
import { notFound } from "next/navigation";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import PreviewClient from "./PreviewClient";

export default function YearlyPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  const samplePath = resolve(process.cwd(), "public/__dev__/yearly-sample.json");
  if (!existsSync(samplePath)) {
    return (
      <div className="min-h-screen bg-background-primary text-text-primary flex items-center justify-center px-6">
        <div className="max-w-[640px] text-center space-y-4">
          <h1 className="text-title-2">샘플 JSON 없음</h1>
          <p className="text-body-2 text-text-secondary">
            먼저 샘플을 생성해줘:
          </p>
          <pre className="rounded-xl bg-background-secondary border border-white/5 p-4 text-[12px] text-text-secondary overflow-x-auto text-left">
{`NODE_OPTIONS="--conditions=import" npx tsx scripts/yearly-save-sample.mts`}
          </pre>
        </div>
      </div>
    );
  }

  const raw = readFileSync(samplePath, "utf-8");
  const result = JSON.parse(raw);
  return <PreviewClient result={result} />;
}
