"use client";

import { useRouter } from "next/navigation";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background-primary px-6">
      <div className="max-w-[640px] w-full text-center">
        <h2 className="text-title-2 text-text-primary mb-4">
          오류가 발생했습니다
        </h2>
        <p className="text-body-2 text-text-secondary mb-8">
          예상치 못한 문제가 발생했어요. 다시 시도해 주세요.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => reset()}
            className="btn-primary w-full px-8 py-4 rounded-2xl text-button-md transition-colors"
          >
            다시 시도
          </button>
          <button
            onClick={() => router.push("/")}
            className="w-full px-8 py-4 rounded-2xl text-button-md text-text-secondary transition-colors hover:text-text-primary"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}
