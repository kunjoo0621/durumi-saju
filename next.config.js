/** @type {import('next').NextConfig} */
const nextConfig = {
  // ★lint 대상에 hooks/store/types 를 포함시킨다 — Next 기본값은 app/pages/components/lib/src 뿐이라
  //   그 밖 폴더에서 "표시 계층 계산 금지" 규칙이 조용히 빠진다(D-14 재발 방지 게이트).
  eslint: {
    dirs: ["app", "components", "lib", "hooks", "store", "types"],
  },
  // 서버리스 함수 번들에서 정적 스토리 이미지(hero·figure)를 제외한다.
  // hero-image-size.ts가 빌드 시 hero PNG를 fs로 읽어 Next 트레이서가
  // public/stories 전체(200MB+)를 함수에 포함시켜 250MB 한도를 넘겼음.
  // 이미지는 CDN이 정적 서빙하므로 함수 번들엔 필요 없다(빌드는 실제 파일을 그대로 읽음).
  outputFileTracingExcludes: {
    "*": ["public/stories/**"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30일
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  async headers() {
    return [
      {
        // 파비콘·아이콘류는 거의 안 바뀌므로 1년 immutable 캐시로 고정한다.
        // 기존엔 캐시 헤더가 없어 브라우저가 페이지 이동마다 조건부 재검증(304)을
        // 반복 → 엣지 요청 수가 크게 부풀려짐(2026-07-04 스파이크 때 favicon이 전체
        // 요청의 42% 차지). 재검증을 없애 엣지 요청 ~40% 절감 + 오탐 알림 방지.
        source: "/favicon.png",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig
