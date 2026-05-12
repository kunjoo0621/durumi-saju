import Link from "next/link";

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
          <a href="/terms" className="text-[rgb(var(--c-text-sub))] hover:text-white transition-colors">
            이용약관
          </a>
          <span>·</span>
          <a href="/privacy" className="text-[rgb(var(--c-text-sub))] hover:text-white transition-colors">
            개인정보처리방침
          </a>
        </div>

        <details className="mt-4 group">
          <summary className="cursor-pointer list-none flex items-center gap-1 text-[12px] text-[rgb(var(--c-text-muted))] hover:text-[rgb(var(--c-text-sub))] transition-colors">
            사업자 정보
            <svg className="w-3 h-3 transition-transform group-open:rotate-180" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </summary>
          <div className="mt-2 text-[11px] leading-[180%] text-[rgb(var(--c-text-muted))]/60">
            <p>상호: 두루미 원정대 | 대표: 신건주</p>
            <p>사업자등록번호: 801-02-03874</p>
            <p>통신판매업 신고번호: 제 2026-용인수지-1950 호</p>
            <p>업태: 도매 및 소매업 | 종목: 전자상거래 소매업</p>
            <p>주소: 경기 용인시 수지구 용구대로2790번길 7, 302호 S218</p>
            <p>고객센터: 0502-1913-6990 | 이메일: kunjoo0621@gmail.com</p>
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
        </details>

        <p className="mt-4 text-[12px] text-[rgb(var(--c-text-muted))]">
          © 2026 두루미 원정대. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
