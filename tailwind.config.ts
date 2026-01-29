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
        // Legacy
        background: "var(--background)",
        foreground: "var(--foreground)",

        // Background
        "bg-primary": "var(--bg-primary)",
        "bg-secondary": "var(--bg-secondary)",
        "bg-tertiary": "var(--bg-tertiary)",

        // Text
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",

        // Primary
        primary: "var(--primary)",
        "primary-hover": "var(--primary-hover)",
        "primary-disabled": "#262626",

        // Border
        "border-default": "var(--border-default)",
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
