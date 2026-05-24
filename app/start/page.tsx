"use client";

import { useRouter } from "next/navigation";
import SajuInputFlow from "@/components/saju-input/SajuInputFlow";

export default function StartPage() {
  const router = useRouter();
  return (
    <SajuInputFlow
      onComplete={() => router.push("/teaser")}
      callbackUrl="/teaser"
      backUrl="/menu"
      trackName="start"
    />
  );
}
