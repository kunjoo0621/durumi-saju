"use client";

import { Lock } from "@phosphor-icons/react";

type SectionBodyProps = {
  content?: string;
  locked?: boolean;
  onUnlock?: () => void;
  unlockLabel?: string;
};

const DEFAULT_UNLOCK_LABEL = "전체 결과 보기";
const SELECTED_ISSUE_PREFIX = "선택한 고민:";

function parseStructuredContent(content: string) {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 3) return null;

  const selectedLineIndex = lines.findIndex((line) => line.startsWith(SELECTED_ISSUE_PREFIX));
  if (selectedLineIndex <= 0) return null;

  const hookLine = lines[0];
  const selectedLine = lines[selectedLineIndex];
  const selectedIssue = selectedLine.replace(SELECTED_ISSUE_PREFIX, "").trim();
  const bodyLines = lines.filter((_, index) => index !== 0 && index !== selectedLineIndex);

  if (!hookLine || bodyLines.length === 0) return null;

  return {
    hookLine,
    selectedIssue: selectedIssue || "미선택",
    bodyLines,
  };
}

export default function SectionBody({ content, locked = false, onUnlock, unlockLabel }: SectionBodyProps) {
  if (!locked && typeof content === "string" && content.trim()) {
    const structured = parseStructuredContent(content);

    if (!structured) {
      return (
        <div className="max-w-prose space-y-6 text-[16px] text-text-primary leading-[1.75] whitespace-pre-wrap">
          {content.split(/\n\s*\n/).map((paragraph, index) => (
            <p key={index}>{paragraph.trim()}</p>
          ))}
        </div>
      );
    }

    return (
      <div className="max-w-prose space-y-6">
        <p
          className="text-title-2 text-text-primary line-clamp-2"
        >
          {structured.hookLine}
        </p>

        <div>
          <p className="text-caption text-text-tertiary tracking-[0.08em] uppercase">
            선택한 고민:
          </p>
          <p className="text-body-2 text-text-secondary mt-1">{structured.selectedIssue}</p>
        </div>

        <div className="space-y-6">
          {structured.bodyLines.map((line, index) => (
            <p key={`${line}-${index}`} className="text-[16px] text-text-primary leading-[1.75] whitespace-pre-wrap">
              {line}
            </p>
          ))}
        </div>
      </div>
    );
  }

  if (!locked) {
    return <p className="text-body-2 text-text-secondary">아직 내용이 없어.</p>;
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
          <Lock weight="duotone" size={16} aria-hidden="true" />
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
