import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          primary: "rgb(var(--bg-primary) / <alpha-value>)",
          secondary: "rgb(var(--bg-secondary) / <alpha-value>)",
          tertiary: "rgb(var(--bg-tertiary) / <alpha-value>)",
        },
        text: {
          primary: "rgb(var(--text-primary) / <alpha-value>)",
          secondary: "rgb(var(--text-secondary) / <alpha-value>)",
          tertiary: "rgb(var(--text-tertiary) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          hover: "rgb(var(--primary-hover) / <alpha-value>)",
          kakao: "rgb(var(--c-kakao) / <alpha-value>)",
          "rank-s": "rgb(var(--c-rank-s) / <alpha-value>)",
          "rank-a": "rgb(var(--c-rank-a) / <alpha-value>)",
          "rank-b": "rgb(var(--c-rank-b) / <alpha-value>)",
          "rank-c": "rgb(var(--c-rank-c) / <alpha-value>)",
          "rank-d": "rgb(var(--c-rank-d) / <alpha-value>)",
        },
        border: {
          DEFAULT: "rgb(var(--border-default) / <alpha-value>)",
        },
        saju: {
          wood: "rgb(var(--c-saju-wood) / <alpha-value>)",
          fire: "rgb(var(--c-saju-fire) / <alpha-value>)",
          earth: "rgb(var(--c-saju-earth) / <alpha-value>)",
          metal: "rgb(var(--c-saju-metal) / <alpha-value>)",
          water: "rgb(var(--c-saju-water) / <alpha-value>)",
          "wood-muted": "rgb(var(--c-saju-wood-muted) / <alpha-value>)",
          "fire-muted": "rgb(var(--c-saju-fire-muted) / <alpha-value>)",
          "earth-muted": "rgb(var(--c-saju-earth-muted) / <alpha-value>)",
          "metal-muted": "rgb(var(--c-saju-metal-muted) / <alpha-value>)",
          "water-muted": "rgb(var(--c-saju-water-muted) / <alpha-value>)",
        },
      },
      keyframes: {
        slideUp: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      fontSize: {
        // Major Third 1.25 Scale
        'display': ['38px', { lineHeight: '1.2', fontWeight: '700' }],
        'title-1': ['30px', { lineHeight: '1.3', fontWeight: '600' }],
        'title-2': ['24px', { lineHeight: '1.35', fontWeight: '600' }],
        'title-3': ['19px', { lineHeight: '1.4', fontWeight: '600' }],
        'body-1': ['19px', { lineHeight: '1.6', fontWeight: '400' }],
        'body-2': ['15px', { lineHeight: '1.65', fontWeight: '400' }],
        'caption': ['12px', { lineHeight: '1.5', fontWeight: '400' }],
        'button-lg': ['19px', { lineHeight: '1', fontWeight: '600' }],
        'button-md': ['15px', { lineHeight: '1', fontWeight: '600' }],
        'button-sm': ['12px', { lineHeight: '1', fontWeight: '500' }],
        // Question text
        'question': ['28px', { lineHeight: '1.3', fontWeight: '600' }],
        // Step indicator
        'step': ['14px', { lineHeight: '1.4', fontWeight: '400' }],
      },
    },
  },
  plugins: [],
};
export default config;
