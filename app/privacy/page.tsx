import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보 처리방침 | 사주보는 두루미",
  description: "사주보는 두루미 개인정보 처리방침",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[rgb(var(--c-dark-bg))] text-white flex flex-col">
      {/* 헤더 */}
      <header className="sticky top-0 z-[100] bg-[rgb(var(--c-dark-bg))]/80 backdrop-blur-md border-b border-white/[0.06]">
        <div className="mx-auto max-w-[640px] flex items-center h-14 px-5">
          <Link
            href="/"
            className="text-[rgb(var(--c-text-sub))] hover:text-white transition-colors text-sm"
          >
            ← 홈으로
          </Link>
        </div>
      </header>

      {/* 본문 */}
      <main className="flex-1 px-5">
        <article className="mx-auto max-w-[640px] py-10">
          <h1 className="text-2xl font-bold mb-2">개인정보 처리방침</h1>
          <p className="text-[13px] text-[rgb(var(--c-text-muted))] mb-10">
            시행일: 2025년 1월 1일
          </p>

          <p className="text-[15px] text-[rgb(var(--c-text-sub))] leading-[1.8] mb-10">
            두루미 원정대(이하 &ldquo;회사&rdquo;)는 개인정보보호법에 따라
            이용자의 개인정보를 보호하고, 이와 관련한 고충을 신속하고 원활하게
            처리하기 위하여 다음과 같이 개인정보 처리방침을 수립·공개합니다.
          </p>

          <div className="space-y-10 text-[15px] text-[rgb(var(--c-text-sub))] leading-[1.8]">
            {/* 제1조 */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">
                제1조 (개인정보의 수집·이용 목적)
              </h2>
              <p className="mb-3">
                회사는 다음 목적을 위해 개인정보를 수집·이용합니다.
              </p>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  <strong className="text-white">사주 분석 서비스 제공:</strong>{" "}
                  이용자의 생년월일, 출생시간 등 정보를 기반으로 AI 사주 분석
                  결과를 생성·제공
                </li>
                <li>
                  <strong className="text-white">회원 관리:</strong> 카카오 계정
                  기반 회원 식별, 로그인 인증, 서비스 이용 이력 관리
                </li>
                <li>
                  <strong className="text-white">결제 처리:</strong> 유료 서비스
                  결제 및 환불 처리
                </li>
                <li>
                  <strong className="text-white">서비스 개선:</strong> 서비스 오류
                  대응 및 품질 개선
                </li>
              </ol>
            </section>

            {/* 제2조 */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">
                제2조 (수집하는 개인정보 항목)
              </h2>

              <div className="mb-4">
                <h3 className="text-white font-medium mb-2">
                  필수 수집 항목
                </h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>사주 분석 입력 정보: 이름, 생년월일, 출생시간, 성별</li>
                  <li>
                    카카오 로그인 시: 카카오 계정 식별자, 닉네임, 이메일 주소
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-white font-medium mb-2">
                  선택 수집 항목
                </h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>출생지역</li>
                  <li>연애상태</li>
                  <li>직업상태</li>
                  <li>핵심고민</li>
                </ul>
              </div>
            </section>

            {/* 제3조 */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">
                제3조 (개인정보의 보유·이용 기간)
              </h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  <strong className="text-white">회원 정보:</strong> 회원 탈퇴 시
                  즉시 파기합니다.
                </li>
                <li>
                  <strong className="text-white">비회원 분석 결과:</strong>{" "}
                  결과 생성 후 24시간 보관 후 자동 삭제됩니다.
                </li>
                <li>
                  <strong className="text-white">결제 기록:</strong>{" "}
                  전자상거래법에 따라 5년간 보관합니다.
                </li>
                <li>
                  <strong className="text-white">
                    서비스 이용 관련 분쟁 기록:
                  </strong>{" "}
                  소비자 보호 관련 법령에 따라 3년간 보관합니다.
                </li>
              </ol>
            </section>

            {/* 제4조 */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">
                제4조 (개인정보의 제3자 제공)
              </h2>
              <p className="mb-3">
                회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다.
                다만, 다음의 경우에 한해 제3자에게 제공됩니다.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] border-collapse">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 pr-4 text-white font-medium">
                        제공받는 자
                      </th>
                      <th className="text-left py-3 pr-4 text-white font-medium">
                        제공 목적
                      </th>
                      <th className="text-left py-3 text-white font-medium">
                        제공 항목
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-white/[0.06]">
                      <td className="py-3 pr-4">카카오</td>
                      <td className="py-3 pr-4">회원 인증(OAuth)</td>
                      <td className="py-3">카카오 계정 식별자</td>
                    </tr>
                    <tr className="border-b border-white/[0.06]">
                      <td className="py-3 pr-4">토스페이먼츠</td>
                      <td className="py-3 pr-4">결제 처리</td>
                      <td className="py-3">결제 관련 정보</td>
                    </tr>
                    <tr className="border-b border-white/[0.06]">
                      <td className="py-3 pr-4">Google (Gemini API)</td>
                      <td className="py-3 pr-4">AI 사주 분석</td>
                      <td className="py-3">
                        사주 분석 입력 정보 (이름 제외, 익명화 처리)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 제5조 */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">
                제5조 (개인정보 처리 위탁)
              </h2>
              <p className="mb-3">
                회사는 서비스 운영을 위해 다음과 같이 개인정보 처리를
                위탁하고 있습니다.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] border-collapse">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 pr-4 text-white font-medium">
                        수탁업체
                      </th>
                      <th className="text-left py-3 text-white font-medium">
                        위탁 업무
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-white/[0.06]">
                      <td className="py-3 pr-4">Supabase Inc.</td>
                      <td className="py-3">데이터베이스 호스팅 및 관리</td>
                    </tr>
                    <tr className="border-b border-white/[0.06]">
                      <td className="py-3 pr-4">Vercel Inc.</td>
                      <td className="py-3">웹 애플리케이션 호스팅</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 제6조 */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">
                제6조 (이용자의 권리)
              </h2>
              <p className="mb-3">
                이용자는 언제든지 다음의 권리를 행사할 수 있습니다.
              </p>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  <strong className="text-white">열람 요구:</strong> 자신의
                  개인정보 처리 현황을 열람할 수 있습니다.
                </li>
                <li>
                  <strong className="text-white">정정·삭제 요구:</strong>{" "}
                  개인정보의 오류 정정 또는 삭제를 요청할 수 있습니다.
                </li>
                <li>
                  <strong className="text-white">처리정지 요구:</strong>{" "}
                  개인정보 처리의 정지를 요청할 수 있습니다.
                </li>
                <li>
                  <strong className="text-white">회원 탈퇴:</strong> 카카오 계정
                  연동 해제를 통해 회원 탈퇴할 수 있으며, 탈퇴 시 개인정보는 즉시
                  파기됩니다.
                </li>
              </ol>
              <p className="mt-3">
                권리 행사는 durumi.crew@gmail.com로 요청해주시기 바랍니다.
              </p>
            </section>

            {/* 제7조 */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">
                제7조 (쿠키 사용)
              </h2>
              <p className="mb-3">
                회사는 서비스 운영에 필수적인 쿠키만 사용하며, 마케팅 또는 추적
                목적의 쿠키는 사용하지 않습니다.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] border-collapse">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 pr-4 text-white font-medium">
                        쿠키명
                      </th>
                      <th className="text-left py-3 pr-4 text-white font-medium">
                        목적
                      </th>
                      <th className="text-left py-3 text-white font-medium">
                        만료
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-white/[0.06]">
                      <td className="py-3 pr-4 font-mono text-[12px]">
                        guest_token
                      </td>
                      <td className="py-3 pr-4">비회원 식별</td>
                      <td className="py-3">7일</td>
                    </tr>
                    <tr className="border-b border-white/[0.06]">
                      <td className="py-3 pr-4 font-mono text-[12px]">
                        next-auth.session-token
                      </td>
                      <td className="py-3 pr-4">로그인 세션 유지</td>
                      <td className="py-3">30일</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 제8조 */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">
                제8조 (개인정보의 파기 절차)
              </h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  회원 탈퇴 시 해당 이용자의 개인정보는 즉시 파기합니다.
                </li>
                <li>
                  비회원의 분석 결과는 24시간 경과 후 자동으로 삭제됩니다.
                </li>
                <li>
                  법령에 따라 보관이 필요한 정보(결제 기록 등)는 해당 기간 경과 후
                  지체 없이 파기합니다.
                </li>
                <li>
                  전자적 파일 형태의 개인정보는 복구 및 재생이 불가능한 방법으로
                  파기합니다.
                </li>
              </ol>
            </section>

            {/* 제9조 */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">
                제9조 (개인정보 보호 책임자)
              </h2>
              <p className="mb-3">
                회사는 개인정보 처리에 관한 업무를 총괄하는 개인정보 보호
                책임자를 다음과 같이 지정합니다.
              </p>
              <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-5 space-y-1">
                <p>
                  <strong className="text-white">성명:</strong> 신건주
                </p>
                <p>
                  <strong className="text-white">직위:</strong> 대표
                </p>
                <p>
                  <strong className="text-white">이메일:</strong>{" "}
                  durumi.crew@gmail.com
                </p>
              </div>
              <p className="mt-4">
                개인정보 침해에 대한 신고나 상담이 필요한 경우 아래 기관에
                문의하실 수 있습니다.
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-[13px]">
                <li>개인정보침해 신고센터 (privacy.kisa.or.kr / 118)</li>
                <li>대검찰청 사이버수사과 (spo.go.kr / 1301)</li>
                <li>경찰청 사이버수사국 (ecrm.police.go.kr / 182)</li>
              </ul>
            </section>

            {/* 제10조 */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">
                제10조 (시행일)
              </h2>
              <p>본 개인정보 처리방침은 2025년 1월 1일부터 시행합니다.</p>
            </section>
          </div>
        </article>
      </main>
    </div>
  );
}
