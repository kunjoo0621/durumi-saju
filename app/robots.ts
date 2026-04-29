import type { MetadataRoute } from "next";

const ALLOW = ["/", "/result/share/", "/battle/result/share/"];
const DISALLOW = ["/api/", "/result/", "/battle/result/", "/checkout/", "/my/", "/edit-profile/"];

// 명시적으로 환영하는 AI 검색봇 — 인용 가능성을 높이기 위해 자기 이름으로 Allow를 박는다.
const AI_BOTS = [
  "GPTBot",          // OpenAI ChatGPT 학습/검색
  "OAI-SearchBot",   // ChatGPT 검색 응답 생성
  "ChatGPT-User",    // ChatGPT 실시간 사용자 요청 fetch
  "ClaudeBot",       // Anthropic Claude
  "Claude-Web",      // Claude 검색
  "PerplexityBot",   // Perplexity AI 검색
  "Perplexity-User", // Perplexity 실시간
  "Google-Extended", // Google Bard/Gemini 학습
  "GoogleOther",     // Google AI 제품
  "Applebot-Extended", // Apple Intelligence
  "CCBot",           // Common Crawl (다수 LLM이 학습용으로 사용)
  "Bytespider",      // ByteDance/TikTok AI
  "DiffBot",         // 지식그래프
  "Meta-ExternalAgent", // Meta AI
  "FacebookBot",     // Meta 학습
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ALLOW, disallow: DISALLOW },
      ...AI_BOTS.map((bot) => ({
        userAgent: bot,
        allow: ALLOW,
        disallow: DISALLOW,
      })),
    ],
    sitemap: "https://www.durumisaju.com/sitemap.xml",
  };
}
