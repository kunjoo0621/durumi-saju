import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용약관 | 사주보는 두루미",
  description: "사주보는 두루미 서비스 이용약관",
};

export default function TermsPage() {
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
          <h1 className="text-2xl font-bold mb-2">이용약관</h1>
          <p className="text-[13px] text-[rgb(var(--c-text-muted))] mb-10">
            시행일: 2025년 1월 1일
          </p>

          <div className="space-y-10 text-[15px] text-[rgb(var(--c-text-sub))] leading-[1.8]">
            {/* 제1조 */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">
                제1조 (목적)
              </h2>
              <p>
                본 약관은 두루미 원정대(이하 &ldquo;회사&rdquo;)가 운영하는
                &ldquo;사주보는 두루미&rdquo;(이하 &ldquo;서비스&rdquo;)의 이용
                조건 및 절차, 회사와 이용자의 권리·의무 및 책임사항을 규정함을
                목적으로 합니다.
              </p>
            </section>

            {/* 제2조 */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">
                제2조 (정의)
              </h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  &ldquo;서비스&rdquo;란 회사가 제공하는 AI 기반 사주 분석 및
                  사주 배틀 등의 콘텐츠를 말합니다.
                </li>
                <li>
                  &ldquo;회원&rdquo;이란 카카오 계정으로 로그인하여 서비스를
                  이용하는 자를 말합니다.
                </li>
                <li>
                  &ldquo;비회원&rdquo;이란 회원 가입 없이 게스트 토큰을 통해
                  서비스를 이용하는 자를 말합니다.
                </li>
                <li>
                  &ldquo;유료 서비스&rdquo;란 결제를 통해 이용할 수 있는 사주
                  분석 및 사주 배틀 서비스를 말합니다.
                </li>
              </ol>
            </section>

            {/* 제3조 */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">
                제3조 (약관의 효력 및 변경)
              </h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  본 약관은 서비스 내에 게시하거나 기타의 방법으로 이용자에게
                  공지함으로써 효력이 발생합니다.
                </li>
                <li>
                  회사는 관련 법령에 위배되지 않는 범위에서 약관을 개정할 수
                  있으며, 개정 시 적용일자 및 개정 사유를 명시하여 최소 7일 전에
                  공지합니다.
                </li>
                <li>
                  변경된 약관에 동의하지 않는 이용자는 서비스 이용을 중단하고
                  탈퇴할 수 있습니다.
                </li>
              </ol>
            </section>

            {/* 제4조 */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">
                제4조 (서비스 내용)
              </h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  <strong className="text-white">개인 사주 분석:</strong> 이용자의
                  생년월일, 출생시간 등 정보를 기반으로 AI가 사주 분석 결과를
                  제공합니다.
                </li>
                <li>
                  <strong className="text-white">사주 배틀:</strong> 두 사람의 사주
                  정보를 비교 분석하여 궁합 및 대결 결과를 제공합니다.
                </li>
                <li>
                  본 서비스는 <strong className="text-white">오락 목적</strong>의
                  콘텐츠이며, 과학적·학술적 근거에 기반한 것이 아닙니다. 서비스
                  결과를 중요한 의사결정의 근거로 사용하지 마시기 바랍니다.
                </li>
              </ol>
            </section>

            {/* 제5조 */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">
                제5조 (이용 계약 체결)
              </h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  회원: 카카오 OAuth를 통한 로그인으로 이용 계약이 체결됩니다.
                </li>
                <li>
                  비회원: 서비스 이용 시 게스트 토큰(guest_token) 발급으로 이용
                  계약이 체결되며, 토큰 만료(7일) 시 계약이 종료됩니다.
                </li>
              </ol>
            </section>

            {/* 제6조 */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">
                제6조 (유료 서비스 및 이용권)
              </h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  유료 서비스는 &ldquo;알&rdquo;(이용권)을 사용하여
                  이용합니다. 1알 = 100원이며, 서비스별 필요 알은 다음과
                  같습니다.
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>개인 사주 분석: 10알 (1,000원 상당)</li>
                    <li>사주 배틀: 20알 (2,000원 상당)</li>
                  </ul>
                </li>
                <li>
                  알은 서비스 내 충전 페이지에서 패키지 단위로 구매할 수
                  있으며, 결제는 포트원(PortOne)을 통해 처리됩니다. 이용
                  가능한 결제 수단은 카카오페이 등 포트원이 지원하는 방식에
                  따릅니다.
                </li>
                <li>
                  알 패키지 가격 및 보너스 구성은 다음과 같습니다.
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>기본: 1,000원 (10알)</li>
                    <li>인기: 3,000원 (30알 + 보너스 5알)</li>
                    <li>알뜰: 5,000원 (50알 + 보너스 12알)</li>
                  </ul>
                </li>
                <li>
                  회사는 알 패키지의 가격 및 구성을 변경할 수 있으며, 변경 시
                  사전에 공지합니다. 변경 전 충전 건에는 변경 전 구성이
                  적용됩니다.
                </li>
              </ol>
            </section>

            {/* 제7조 */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">
                제7조 (알 환불 정책)
              </h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  <strong className="text-white">미사용 알 환불:</strong>{" "}
                  충전일로부터 7일 이내에 충전한 알을 전혀 사용하지 않은 경우,
                  전액 환불이 가능합니다.
                </li>
                <li>
                  <strong className="text-white">일부 사용 후 환급:</strong>{" "}
                  충전한 알의 60% 이상을 사용한 경우, 잔여 알에 해당하는 금액을
                  환급받을 수 있습니다. 보너스로 지급된 알은 환급 대상에서
                  제외됩니다.
                </li>
                <li>
                  <strong className="text-white">환불 방식:</strong> 환불은
                  원래 결제 수단과 동일한 방식(카드 취소 등)으로 처리됩니다.
                  처리 기간은 결제 수단에 따라 영업일 기준 3~7일 소요될 수
                  있습니다.
                </li>
                <li>
                  <strong className="text-white">유효기간:</strong> 충전한 알은
                  충전일로부터 1년간 유효합니다. 유효기간이 만료된 알은 자동
                  소멸되며, 소멸된 알에 대해서는 환불이 불가합니다.
                </li>
                <li>
                  <strong className="text-white">만료 사전 통지:</strong>{" "}
                  회사는 알 유효기간 만료 30일 전에 회원의 카카오 계정에
                  등록된 이메일로 만료 예정 안내를 발송합니다.
                </li>
                <li>
                  <strong className="text-white">시스템 오류 환불:</strong>{" "}
                  결제 후 시스템 오류로 알이 정상 충전되지 않은 경우 또는 알
                  사용 후 서비스가 정상 제공되지 않은 경우, 해당 알은 자동
                  환불됩니다. 자동 환불이 이루어지지 않은 경우
                  kunjoo0621@gmail.com으로 접수해주시기 바랍니다.
                </li>
                <li>
                  환불 요청은 kunjoo0621@gmail.com으로 접수하며, 접수 후
                  영업일 기준 3일 이내에 처리됩니다.
                </li>
              </ol>
            </section>

            {/* 제8조 */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">
                제8조 (이용자의 의무)
              </h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  이용자는 서비스 이용 시 허위 정보를 입력해서는 안 됩니다.
                </li>
                <li>
                  이용자는 서비스를 이용하여 얻은 정보를 회사의 사전 동의 없이
                  상업적으로 이용하거나 제3자에게 제공해서는 안 됩니다.
                </li>
                <li>
                  이용자는 서비스의 운영을 방해하는 행위를 해서는 안 됩니다.
                </li>
              </ol>
            </section>

            {/* 제9조 */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">
                제9조 (서비스 중단 및 변경)
              </h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  회사는 시스템 점검, 장비 교체, 기타 불가피한 사유가 있는 경우
                  서비스 제공을 일시적으로 중단할 수 있습니다.
                </li>
                <li>
                  회사는 서비스의 내용, 운영 방식, 기술적 사항 등을 변경할 수
                  있으며, 중요한 변경 사항은 사전에 공지합니다.
                </li>
              </ol>
            </section>

            {/* 제10조 */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">
                제10조 (면책)
              </h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  본 서비스는{" "}
                  <strong className="text-white">
                    AI 기반 오락 목적의 콘텐츠
                  </strong>
                  이며, 의학, 법률, 재무 등 전문적 조언을 제공하지 않습니다.
                </li>
                <li>
                  서비스 결과에 대한 해석 및 활용은 전적으로 이용자의 책임이며,
                  회사는 서비스 결과의 정확성이나 신뢰성을 보증하지 않습니다.
                </li>
                <li>
                  천재지변, 시스템 장애 등 불가항력으로 인한 서비스 중단에 대해
                  회사는 책임을 지지 않습니다.
                </li>
                <li>
                  이용자가 서비스 결과를 근거로 내린 판단이나 행동으로 인해 발생한
                  손해에 대해 회사는 책임을 지지 않습니다.
                </li>
              </ol>
            </section>

            {/* 제11조 */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">
                제11조 (지적 재산권)
              </h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  서비스에 포함된 디자인, 텍스트, 이미지, AI 분석 결과물 등 모든
                  콘텐츠에 대한 저작권 및 지적 재산권은 회사에 귀속됩니다.
                </li>
                <li>
                  이용자는 개인적·비상업적 용도로만 서비스 결과를 이용할 수
                  있습니다.
                </li>
              </ol>
            </section>

            {/* 제12조 */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">
                제12조 (분쟁 해결)
              </h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  서비스 이용과 관련하여 분쟁이 발생한 경우, 회사와 이용자는
                  원만한 해결을 위해 성실히 협의합니다.
                </li>
                <li>
                  협의로 해결되지 않을 경우, 관할 법원은 회사 소재지를 관할하는
                  법원으로 합니다.
                </li>
              </ol>
            </section>

            {/* 제13조 */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">
                제13조 (시행일)
              </h2>
              <p>본 약관은 2025년 1월 1일부터 시행합니다.</p>
            </section>
          </div>
        </article>
      </main>
    </div>
  );
}
