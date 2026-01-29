import { type NextAuthOptions } from "next-auth";
import KakaoProvider from "next-auth/providers/kakao";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const authOptions: NextAuthOptions = {
  providers: [
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID || "",
      clientSecret: process.env.KAKAO_CLIENT_SECRET || "",
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const kakaoProfile = profile as {
          id?: string | number;
          properties?: { nickname?: string; profile_image?: string };
          kakao_account?: { email?: string };
        };
        token.kakaoId = kakaoProfile.id?.toString();
        token.name = kakaoProfile.properties?.nickname || token.name;
        token.picture = kakaoProfile.properties?.profile_image || token.picture;
        token.email = kakaoProfile.kakao_account?.email || token.email;

        const kakaoId = token.kakaoId;
        const nickname = token.name || null;
        if (kakaoId) {
          const { data, error } = await supabaseAdmin
            .from("users")
            .upsert(
              { kakao_id: kakaoId, nickname },
              { onConflict: "kakao_id" }
            )
            .select("id")
            .single();

          if (!error && data?.id) {
            token.supabaseUserId = data.id;
          }
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
