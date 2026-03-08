"use client";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: { wh: 16, strokeWidth: 2, radius: 6, dasharray: "15 23" },
  md: { wh: 32, strokeWidth: 2.5, radius: 13, dasharray: "32 50" },
  lg: { wh: 48, strokeWidth: 3, radius: 20, dasharray: "50 76" },
};

export default function Spinner({ size = "md", className = "" }: SpinnerProps) {
  const { wh, strokeWidth, radius, dasharray } = SIZES[size];
  const center = wh / 2;
  return (
    <svg
      width={wh}
      height={wh}
      viewBox={`0 0 ${wh} ${wh}`}
      className={`animate-spinner ${className}`}
      role="status"
      aria-label="로딩 중"
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="rgb(var(--primary))"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={dasharray}
      />
    </svg>
  );
}
