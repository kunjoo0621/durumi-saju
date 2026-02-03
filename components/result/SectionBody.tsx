"use client";

type SectionBodyProps = {
  content?: string;
  locked?: boolean;
  onUnlock?: () => void;
  unlockLabel?: string;
};

const DEFAULT_UNLOCK_LABEL = "1,000원으로 전체 결과 보기";

export default function SectionBody({ content, locked = false, onUnlock, unlockLabel }: SectionBodyProps) {
  if (!locked && typeof content === "string") {
    return (
      <p className="text-body-2 text-text-primary leading-relaxed whitespace-pre-wrap">
        {content}
      </p>
    );
  }

  return (
    <div className="relative rounded-xl bg-background-primary/40 p-4">
      <div className="space-y-2 blur-sm select-none pointer-events-none">
        <div className="h-4 bg-background-tertiary/80 rounded w-full" />
        <div className="h-4 bg-background-tertiary/80 rounded w-5/6" />
        <div className="h-4 bg-background-tertiary/80 rounded w-4/5" />
      </div>
      <div className="absolute inset-0 flex flex-col items-start justify-center gap-2 rounded-xl bg-black/45 px-4">
        <div className="flex items-center gap-2 text-[13px] text-text-primary">
          <span aria-hidden="true">🔒</span>
          여기부터는 상세 해설
        </div>
        {onUnlock && (
          <button
            type="button"
            onClick={onUnlock}
            className="rounded-lg bg-primary px-3 py-2 text-[12px] font-semibold text-text-primary"
          >
            {unlockLabel || DEFAULT_UNLOCK_LABEL}
          </button>
        )}
      </div>
    </div>
  );
}
