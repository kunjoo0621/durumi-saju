"use client";

import Spinner from "./Spinner";

interface InlineLoadingProps {
  message?: string;
  size?: "sm" | "md" | "lg";
}

export default function InlineLoading({
  message,
  size = "md",
}: InlineLoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-text-secondary">
      <Spinner size={size} />
      {message && (
        <p className="mt-4 text-[14px] text-text-secondary">{message}</p>
      )}
    </div>
  );
}
