import type { KoreanElement } from "@/lib/utils/saju-enrichment";

export const ELEMENT_HEX: Record<KoreanElement, string> = {
  목: "#22C55E",
  화: "#EF4444",
  토: "#EAB308",
  금: "#D1D5DB",
  수: "#3B82F6",
};

export const ELEMENT_TINT: Record<KoreanElement, string> = {
  목: "rgba(34, 197, 94, 0.10)",
  화: "rgba(239, 68, 68, 0.10)",
  토: "rgba(234, 179, 8, 0.08)",
  금: "rgba(209, 213, 219, 0.06)",
  수: "rgba(59, 130, 246, 0.10)",
};

export const ELEMENT_HANJA: Record<KoreanElement, string> = {
  목: "木",
  화: "火",
  토: "土",
  금: "金",
  수: "水",
};
