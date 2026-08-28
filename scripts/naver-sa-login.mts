/**
 * 네이버 서치어드바이저 로그인 — 영구 프로필 seed (1회성, 대화형).
 *
 * ★왜 storage_state 가 아니라 영구 프로필인가
 *   네이버는 접속할 때마다 세션 쿠키(NID_AUT/NID_SES)를 새 값으로 회전시킨다.
 *   storage_state(json 스냅샷)는 읽기 전용이라 회전분을 못 따라가고 **하루도 못 간다**
 *   (2026-08-27 실측: 21:46 로그인 → 다음날 00:19 이미 로그인 폼으로 튕김).
 *   user_data_dir 는 실제 브라우저 프로필이라 갱신된 쿠키가 폴더에 바로 기록된다.
 *   → 네이버 세션 자체가 만료될 때(수 주~수 개월)까지 재로그인 불필요.
 *
 * ★프로필은 레포 밖에 둔다 — 로그인 세션이 들어있어 절대 커밋되면 안 된다.
 *
 * 실행: npx tsx scripts/naver-sa-login.mts
 *   브라우저가 뜨면 네이버 로그인 → '로그인 상태 유지' 켜두면 더 오래 간다.
 *   서치어드바이저 접근까지 확인되면 자동 종료.
 *
 * 이후 조회: npx tsx scripts/naver-sa-stats.mts
 */
import { chromium } from "playwright";
import { homedir } from "os";
import { join } from "path";

export const PROFILE_DIR = join(homedir(), ".durumi-naver-profile");
const SITE = "https://www.durumisaju.com";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

async function main() {
  console.log(`\n프로필 위치: ${PROFILE_DIR}`);
  console.log("브라우저를 띄웁니다. 네이버 로그인 후 기다려주세요 (최대 10분).");
  console.log("\n  \x1b[1m★ 로그인 화면에서 '로그인 상태 유지'를 반드시 켜주세요.\x1b[0m");
  console.log("     끄면 네이버가 NID_AUT/NID_SES 를 **세션 쿠키**(만료시각 없음)로 주는데,");
  console.log("     크롬은 세션 쿠키를 창 닫을 때 버려서 프로필에 아무것도 안 남습니다.");
  console.log("     (2026-08-28 실측: 체크 없이 로그인 → 프로필에 NID_JST·nid_slevel 만 남고 인증 쿠키 유실)\n");

  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1400, height: 950 },
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    userAgent: UA,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const enc = encodeURIComponent(SITE);
  await page.goto(`https://searchadvisor.naver.com/console/site/summary?site=${enc}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  // 로그인 완료 감지 — 콘솔 화면에 도달하면 성공.
  let ok = false;
  for (let i = 0; i < 120; i++) {
    await page.waitForTimeout(5_000);
    const url = page.url();
    if (url.includes("searchadvisor.naver.com/console") && !url.includes("auth/login")) {
      const body = await page.innerText("body").catch(() => "");
      if (body.includes("웹마스터 도구") && !body.includes("비밀번호")) {
        ok = true;
        break;
      }
    }
    if (i % 6 === 0) console.log(`  대기 중… (${i * 5}초)  현재: ${url.slice(0, 70)}`);
  }

  // ★"로그인됐다"로 끝내면 안 된다 — 인증 쿠키가 **영구(persistent)** 인지까지 봐야 한다.
  // 세션 쿠키로 발급되면 브라우저를 닫는 순간 사라져서, 성공 메시지만 뜨고 다음 실행은 실패한다.
  let persisted = false;
  if (ok) {
    const cookies = await ctx.cookies();
    const auth = cookies.filter((c) => c.name === "NID_AUT" || c.name === "NID_SES");
    // Playwright 는 세션 쿠키의 expires 를 -1 로 준다.
    persisted = auth.length >= 2 && auth.every((c) => typeof c.expires === "number" && c.expires > 0);
    if (!persisted) {
      console.error("\n\x1b[31m❌ 로그인은 됐지만 '로그인 상태 유지'가 꺼져 있습니다.\x1b[0m");
      console.error(`   인증 쿠키(NID_AUT/NID_SES)가 세션 쿠키라 브라우저를 닫으면 사라집니다.`);
      console.error(`   찾은 인증 쿠키: ${auth.map((c) => `${c.name}(expires=${c.expires})`).join(", ") || "없음"}`);
      console.error("\n   \x1b[1m'로그인 상태 유지'를 켜고 다시 실행해주세요.\x1b[0m\n");
    }
  } else {
    console.error("\n❌ 시간 내 로그인이 확인되지 않았습니다. 다시 실행해주세요.\n");
  }

  if (ok && persisted) {
    console.log("\n✅ 로그인 확인 + 인증 쿠키 영구 저장 확인.");
    console.log("   이제 조회는 아래 한 줄이면 됩니다 (브라우저 안 뜸):");
    console.log("   npx tsx scripts/naver-sa-stats.mts\n");
  }
  await ctx.close();
  process.exit(ok && persisted ? 0 : 1);
}

main();
