import { type NextAuthOptions } from "next-auth";
import KakaoProvider from "next-auth/providers/kakao";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 가입 후 이 시간 안에는 세션이 `isNewSignup: true` 를 내려보낸다(네이버 sign_up 전환용).
 * 넉넉히 잡아도 안전한 이유: 실제 발동은 클라이언트 localStorage 가드가 유저당 1회로 묶는다.
 * 짧게 잡으면 OAuth 왕복이 느린 기기(카톡 인앱 등)에서 창을 놓쳐 전환이 새는 쪽이 더 위험하다.
 */
const SIGNUP_CONVERSION_WINDOW_MS = 10 * 60 * 1000;

type ReferrerData = {
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  landing_path: string | null;
};

// middleware가 저장한 dm_ref 쿠키를 읽어 referrer 정보 추출. 실패 시 모두 null.
async function readReferrerCookie(): Promise<ReferrerData | null> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("dm_ref")?.value;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      referrer: typeof parsed.referrer === "string" ? parsed.referrer.slice(0, 200) : null,
      utm_source: typeof parsed.utm_source === "string" ? parsed.utm_source.slice(0, 100) : null,
      utm_medium: typeof parsed.utm_medium === "string" ? parsed.utm_medium.slice(0, 100) : null,
      utm_campaign: typeof parsed.utm_campaign === "string" ? parsed.utm_campaign.slice(0, 100) : null,
      landing_path: typeof parsed.landing_path === "string" ? parsed.landing_path.slice(0, 200) : null,
    };
  } catch {
    return null;
  }
}

async function upsertUserWithRetry(
  kakaoId: string,
  nickname: string | null,
  email: string | null,
  referrer: ReferrerData | null = null,
): Promise<{ id: string; created: boolean }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    // 기존 사용자 여부 확인 (created 판별용)
    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("kakao_id", kakaoId)
      .maybeSingle();

    // 신규 가입자만 referrer 컬럼 채움. 기존 사용자는 referrer 덮어쓰지 않음 (첫 채널 보존)
    const upsertPayload: Record<string, unknown> = { kakao_id: kakaoId, nickname, email };
    if (!existing && referrer) {
      if (referrer.referrer) upsertPayload.referrer = referrer.referrer;
      if (referrer.utm_source) upsertPayload.utm_source = referrer.utm_source;
      if (referrer.utm_medium) upsertPayload.utm_medium = referrer.utm_medium;
      if (referrer.utm_campaign) upsertPayload.utm_campaign = referrer.utm_campaign;
      if (referrer.landing_path) upsertPayload.landing_path = referrer.landing_path;
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .upsert(upsertPayload, { onConflict: "kakao_id" })
      .select("id")
      .single();

    if (!error && data?.id) return { id: data.id, created: !existing };

    if (attempt === 0) {
      console.warn(`[auth] upsert attempt 1 failed, retrying in 500ms:`, error?.message);
      await sleep(500);
    }
  }

  throw new Error(`[auth] Supabase user upsert failed for kakao_id=${kakaoId}`);
}

async function grantSignupBonusIfNeeded(userId: string, kakaoId: string) {
  const { data, error } = await supabaseAdmin.rpc("grant_signup_bonus", { p_user_id: userId });
  if (error) {
    console.error(`[auth] signup_bonus RPC error (user=${userId}, kakao=${kakaoId}):`, error.message);
    return;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (row?.success) {
    console.info(`[auth] signup_bonus granted: user=${userId} kakao=${kakaoId} +${row.bonus_amount}알 (잔고 ${row.new_balance})`);
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID!,
      clientSecret: process.env.KAKAO_CLIENT_SECRET!,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30일
  },
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const kakaoProfile = profile as {
          id?: string | number;
          properties?: { nickname?: string; profile_image?: string };
          kakao_account?: {
            email?: string;
            profile?: { nickname?: string; profile_image_url?: string };
          };
        };
        token.kakaoId = kakaoProfile.id?.toString();
        token.name =
          kakaoProfile.kakao_account?.profile?.nickname ||
          kakaoProfile.properties?.nickname ||
          token.name;
        token.picture =
          kakaoProfile.kakao_account?.profile?.profile_image_url ||
          kakaoProfile.properties?.profile_image ||
          token.picture;
        token.email = kakaoProfile.kakao_account?.email || token.email;

        const kakaoId = token.kakaoId as string | undefined;
        const nickname = (token.name as string) || null;
        const email = (token.email as string) || null;
        if (kakaoId) {
          const referrer = await readReferrerCookie();
          const { id: userId, created } = await upsertUserWithRetry(kakaoId, nickname, email, referrer);
          token.supabaseUserId = userId;
          if (created) {
            // ★네이버 sign_up 전환용 — **불리언 플래그가 아니라 타임스탬프**를 쓴다.
            // 처음엔 `isNewSignup=true` 를 켜고 account 없는 다음 요청에서 지우려 했는데,
            // next-auth 는 `/api/auth/session` 한 요청 안에서 jwt 콜백의 **반환 토큰을 그대로**
            // session 콜백에 넘긴다(core/routes/session.js:53-70). 즉 지운 그 요청에서 바로
            // 읽히므로 클라이언트는 **영원히 false 만** 받는다(전환 전량 0, 무음 손실).
            // 유예 창 방식도 위험하다 — 서버컴포넌트/미들웨어의 getServerSession 한 번이
            // 그 1회를 먹어버린다. 시간 기반이면 누가 몇 번 읽든 결과가 같다.
            (token as { signupAt?: number }).signupAt = Date.now();
            await grantSignupBonusIfNeeded(userId, kakaoId);
            if (referrer) {
              console.info(`[auth] referrer captured for new user ${userId}:`, referrer);
            }
          }
        }
      }

      // supabaseUserId가 누락된 경우 kakaoId로 DB에서 복구
      if (token.kakaoId && !token.supabaseUserId) {
        const { data } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("kakao_id", token.kakaoId)
          .single();
        if (data?.id) {
          token.supabaseUserId = data.id;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.name = token.name ?? session.user.name;
        session.user.email = token.email ?? session.user.email;
        session.user.image = token.picture ?? session.user.image;
        const kakaoId = typeof token.kakaoId === "string" ? token.kakaoId : undefined;
        const supabaseUserId = typeof token.supabaseUserId === "string" ? token.supabaseUserId : undefined;
        (session.user as { id?: string; supabaseId?: string }).id = kakaoId || token.sub;
        (session.user as { supabaseId?: string }).supabaseId = supabaseUserId;
        // 네이버 sign_up 전환 발동용. 가입 시각에서 SIGNUP_CONVERSION_WINDOW_MS 안이면 true.
        // 반복 발동은 클라이언트 localStorage 가드가 막는다(NaverSignupConversion.tsx).
        const signupAt = (token as { signupAt?: number }).signupAt;
        (session.user as { isNewSignup?: boolean }).isNewSignup =
          typeof signupAt === "number" &&
          Date.now() - signupAt < SIGNUP_CONVERSION_WINDOW_MS;
      }
      return session;
    },
  },
};
