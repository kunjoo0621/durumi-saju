"use client";

interface SkeletonBarProps {
  className?: string;
}

export default function SkeletonBar({ className = "h-5 w-24" }: SkeletonBarProps) {
  return (
    <div
      className={`rounded ${className} animate-shimmer`}
      style={{
        backgroundImage:
          "linear-gradient(90deg, rgb(63 63 70) 0%, rgb(82 82 91) 50%, rgb(63 63 70) 100%)",
        backgroundSize: "200% 100%",
      }}
    />
  );
}
