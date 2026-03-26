import { type NextAuthOptions } from "next-auth";
import KakaoProvider from "next-auth/providers/kakao";
import CredentialsProvider from "next-auth/providers/credentials";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function upsertUserWithRetry(kakaoId: string, nickname: string | null): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabaseAdmin
      .from("users")
      .upsert(
        { kakao_id: kakaoId, nickname },
        { onConflict: "kakao_id" }
      )
      .select("id")
      .single();

    if (!error && data?.id) return data.id;

    if (attempt === 0) {
      console.warn(`[auth] upsert attempt 1 failed, retrying in 500ms:`, error?.message);
      await sleep(500);
    }
  }

  throw new Error(`[auth] Supabase user upsert failed for kakao_id=${kakaoId}`);
}

export const authOptions: NextAuthOptions = {
  providers: [
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID || "",
      clientSecret: process.env.KAKAO_CLIENT_SECRET || "",
    }),
    ...(process.env.REVIEW_ACCOUNT_EMAIL
      ? [
          CredentialsProvider({
            name: "이메일",
            credentials: {
              email: { label: "이메일", type: "email" },
              password: { label: "비밀번호", type: "password" },
            },
            async authorize(credentials) {
              const email = process.env.REVIEW_ACCOUNT_EMAIL;
              const password = process.env.REVIEW_ACCOUNT_PASSWORD;
              if (!email || !password) return null;
              if (credentials?.email !== email || credentials?.password !== password) return null;

              const reviewKakaoId = `review-${email}`;
              const userId = await upsertUserWithRetry(reviewKakaoId, "심사계정");

              return {
                id: reviewKakaoId,
                name: "심사계정",
                email,
                supabaseId: userId,
              };
            },
          }),
        ]
      : []),
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
    async jwt({ token, account, profile, user }) {
      // Credentials 로그인 (심사용)
      if (account?.provider === "credentials" && user) {
        const u = user as { id: string; name?: string; email?: string; supabaseId?: string };
        token.kakaoId = u.id;
        token.name = u.name;
        token.email = u.email;
        token.supabaseUserId = u.supabaseId;
        return token;
      }

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
        if (kakaoId) {
          const userId = await upsertUserWithRetry(kakaoId, nickname);
          token.supabaseUserId = userId;
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
      }
      return session;
    },
  },
};
