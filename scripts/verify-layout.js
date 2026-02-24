#!/usr/bin/env node
/**
 * 레이아웃 규칙 검증 스크립트
 * - h-[100dvh] 페이지: overflow-hidden 필수, main에 min-h-0 필수
 * - min-h-screen 페이지: Header에 sticky prop 필수
 * - globals.css: overflow-x: hidden 금지 (clip만 허용)
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
let warnings = 0;

function warn(file, msg) {
  console.warn(`⚠  ${path.relative(ROOT, file)}: ${msg}`);
  warnings++;
}

// 1. h-[100dvh] 페이지 검증
const dvhPages = [
  "app/start/page.tsx",
  "app/battle/input/page.tsx",
  "app/edit-profile/page.tsx",
];

for (const rel of dvhPages) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, "utf8");

  if (src.includes("h-[100dvh]") && !src.includes("overflow-hidden")) {
    warn(file, "h-[100dvh] 루트에 overflow-hidden 누락");
  }

  if (/flex-1.*overflow-y-auto/.test(src) && !src.includes("min-h-0")) {
    warn(file, "flex-1 main에 min-h-0 누락");
  }
}

// 2. min-h-screen 페이지 — Header에 sticky 필수
const stickyPages = [
  "app/result/ResultClient.tsx",
  "app/battle/result/BattleResultClient.tsx",
  "app/my/results/page.tsx",
];

for (const rel of stickyPages) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, "utf8");

  if (src.includes("min-h-screen")) {
    const headerCalls = src.match(/<Header[^>]*>/g) || [];
    for (const call of headerCalls) {
      if (!call.includes("sticky")) {
        warn(file, `Header에 sticky prop 누락: ${call.trim()}`);
      }
    }
  }
}

// 3. globals.css — overflow-x: hidden 금지
const cssFile = path.join(ROOT, "app/globals.css");
if (fs.existsSync(cssFile)) {
  const css = fs.readFileSync(cssFile, "utf8");
  const lines = css.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/overflow-x\s*:\s*hidden/.test(lines[i])) {
      warn(cssFile, `L${i + 1}: overflow-x: hidden 사용 금지 (clip 사용할 것)`);
    }
  }
}

// 결과
if (warnings > 0) {
  console.warn(`\n레이아웃 검증: ${warnings}건 경고\n`);
} else {
  console.log("✓ 레이아웃 검증 통과");
}
