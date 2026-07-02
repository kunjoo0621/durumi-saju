/** @type {import('next').NextConfig} */
const nextConfig = {
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
