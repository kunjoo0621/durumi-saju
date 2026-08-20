import Link from "next/link";
import { InstagramLogo, YoutubeLogo } from "@phosphor-icons/react/dist/ssr";
import { SOCIAL_LINKS } from "@/lib/social-links";

export default function BusinessFooter({
  footerClassName = "border-t border-white/[0.06] bg-[rgb(var(--c-dark-bg))]",
  innerClassName = "mx-auto max-w-[640px] px-5 sm:px-0 pt-10 pb-12 text-[13px] leading-[180%] text-[rgb(var(--c-text-muted))]",
}: {
  footerClassName?: string;
  innerClassName?: string;
}) {
  return (
    <footer className={footerClassName}>
      <div className={innerClassName}>
        <div className="flex items-center gap-2 text-[13px] flex-wrap">
          <Link href="/dict" className="text-[rgb(var(--c-text-sub))] hover:text-white transition-colors">
            사주 사전
          </Link>
          <span>·</span>
          <Link href="/stories" className="text-[rgb(var(--c-text-sub))] hover:text-white transition-colors">
            두루미 매거진
          </Link>
          <span>·</span>
          <a href="/terms" className="text-[rgb(var(--c-text-sub))] hover:text-white transition-colors">
            이용약관
          </a>
          <span>·</span>
          <a href="/privacy" className="text-[rgb(var(--c-text-sub))] hover:text-white transition-colors">
            개인정보처리방침
          </a>
        </div>

        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <a
            href={SOCIAL_LINKS.instagram}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="두루미사주 인스타그램"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.04] text-[rgb(var(--c-text-sub))] hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <InstagramLogo size={18} weight="regular" />
          </a>
          <a
            href={SOCIAL_LINKS.youtube}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="두루미사주 유튜브"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.04] text-[rgb(var(--c-text-sub))] hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <YoutubeLogo size={18} weight="regular" />
          </a>
          <a
            href={SOCIAL_LINKS.naverBlog}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-[rgb(var(--c-text-sub))] hover:text-white transition-colors"
          >
            Naver Blog
          </a>
        </div>

        {/* 사업자 정보는 항상 노출한다. 전자상거래법 제10조가 초기화면 표시를 요구하고,
            PG 입점 심사의 홈페이지 자동 점검이 '렌더링된 화면에서 보이는 텍스트'를 긁는다.
            이전엔 <details> 접힘 블록이라 스크래퍼가 못 읽고 사업자번호를 000-00-00000 으로
            잡아 보류 사유가 됐다 (2026-06 네이버페이 사전점검). 접지 말 것. */}
        <div className="mt-4">
          <p className="text-[12px] text-[rgb(var(--c-text-muted))]">사업자 정보</p>
          <div className="mt-2 text-[11px] leading-[180%] text-[rgb(var(--c-text-muted))]/60">
            <p>상호: 두루미 원정대 | 대표: 신건주</p>
            <p>사업자등록번호: 801-02-03874</p>
            <p>통신판매업 신고번호: 제 2026-용인수지-1950 호</p>
            <p>업태: 도매 및 소매업 | 종목: 전자상거래 소매업</p>
            <p>주소: 경기 용인시 수지구 용구대로2790번길 7, 302호 S218</p>
            <p>고객센터: 0502-1913-6990 | 이메일: durumi.crew@gmail.com</p>
            <p>호스팅 서비스 제공자: Vercel Inc.</p>
            <a
              href="https://www.ftc.go.kr/bizCommPop.do?wrkr_no=8010203874"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-1 underline hover:text-[rgb(var(--c-text-sub))] transition-colors"
            >
              사업자정보확인
            </a>
          </div>
        </div>

        <p className="mt-4 text-[12px] text-[rgb(var(--c-text-muted))]">
          © 2026 두루미 원정대. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
