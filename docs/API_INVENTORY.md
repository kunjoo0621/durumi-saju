# 두루미 API 인벤토리

**두루미가 어떤 외부 API를 쓰고 있고, 뭘 안 쓰고 있고, 없는 건 어떻게 받는지**를 한 곳에 모은다.

새 API를 붙이거나 키를 발급받으면 **이 문서를 먼저 갱신한다.** 갱신 안 하면 다음에 또
"이거 이미 했나?"를 코드 전수검색으로 확인해야 한다 (2026-08-20에 실제로 그랬다 —
GSC 키가 6월부터 있는 걸 모르고 "새로 붙이자"고 제안했다).

**최종 갱신: 2026-08-21**

> ⚠️ **이 문서에 키 값을 절대 쓰지 않는다.** 변수 이름과 발급처만 적는다.
> 값은 `.env.local`(git 제외)과 Vercel 환경변수에만 둔다.
> 단, 클라이언트 코드에 이미 노출되는 공개 식별자(Google Ads 전환 ID 등)는 예외로 적는다.

---

## 1. 보유 — 실제로 쓰고 있음

| API | 용도 | 자격증명 (이름만) | 발급처 |
|---|---|---|---|
| **Gemini** | 사주 분석 LLM (핵심) | `GEMINI_API_KEY` · `GEMINI_MODELS` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **Supabase** | DB · 인증 | `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` | Supabase 대시보드 → Project Settings → API |
| **Kakao 로그인** | 유일한 로그인 수단 | `KAKAO_CLIENT_ID` · `KAKAO_CLIENT_SECRET` · `NEXT_PUBLIC_KAKAO_JS_KEY` · `KAKAO_ADMIN_KEY` | [developers.kakao.com](https://developers.kakao.com) → 내 애플리케이션 |
| **PortOne** | 결제 (카카오페이 채널) | `NEXT_PUBLIC_PORTONE_STORE_ID` · `NEXT_PUBLIC_PORTONE_CHANNEL_KEY` · `PORTONE_API_SECRET` | [admin.portone.io](https://admin.portone.io) → 결제연동 → 연동 관리 |
| **네이버 검색광고** | 광고 실적·키워드 조회·키워드/소재 등록 | `NAVER_SEARCHAD_ACCESS_LICENSE` · `NAVER_SEARCHAD_SECRET_KEY` · `NAVER_SEARCHAD_CUSTOMER_ID` | [ads.naver.com](https://ads.naver.com) → 도구 → API 사용 관리 |
| **Vercel** | 배포 · Web Analytics 조회 | `VERCEL_TOKEN` · `VERCEL_OIDC_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) |
| **YouTube Data v3** | 채널·영상·트래픽소스 실측 | `client_secret.json` + `token.json` (OAuth) — `~/projects/durumi-yt-stats/` | [console.cloud.google.com](https://console.cloud.google.com) → API 및 서비스 → 사용자 인증 정보 → OAuth 클라이언트 |
| **Google Ads (gtag)** | 결제 전환 추적 | 전환 ID `AW-18186268670` (클라이언트 공개) | [ads.google.com](https://ads.google.com) → 도구 → 전환 |
| **네이버 애널리틱스** | PV 계측 | `wa` = `2557da4fbf17080` (클라이언트 공개) | [analytics.naver.com](https://analytics.naver.com) |
| **네이버 검색광고 전환** | 결제·가입 전환(`wcs.trans`) | 공통키 `s_3318034d348d` (클라이언트 공개) | ads.naver.com → 도구 → 전환추적 |
| **Google Search Console** | 자연검색 검색어·순위·CTR | `gsc-key.json` (서비스계정) | [console.cloud.google.com](https://console.cloud.google.com) → 서비스 계정 → 키 · 상세는 §2 |

### 쓰는 곳

```
scripts/naver-ad-stats.mts     네이버 광고 캠페인·그룹별 일자 실적
scripts/naver-kw-stats.mts     키워드별 실적 + 브랜드 검색량 (2026-08-20 신설)
scripts/naver-kw-research.mts  /dict 용어 검색량 리서치
scripts/vercel-analytics.mts   방문자·PV·유입처·페이지·시간대
scripts/live-dashboard.mts     Supabase 종합 대시보드
scripts/channel-roi.mts        채널별 가입→결제 손익 (2026-08-20 신설)
scripts/gsc-queries.mts        GSC 검색어·페이지 실적 + CTR/순위 기회 발굴 (2026-08-21 신설)
components/NaverAnalytics.tsx  네이버 PV + 전환(wcs.trans)
hooks/useCharge.ts             Google Ads 전환 firing
middleware.ts                  네이버 광고 NaPm → utm 변환 (자체 유입추적)
~/projects/durumi-yt-stats/    유튜브 실측 도구 모음
```

---

## 2. Google Search Console — 2026-08-21 연결 완료

| | |
|---|---|
| 파일 | `gsc-key.json` (프로젝트 루트, `.gitignore` 49행) |
| 종류 | service_account |
| 계정 | `gsc-reader@gen-lang-client-0372874613.iam.gserviceaccount.com` |
| 키 발급일 | 2026-06-05 |
| **권한 부여일** | **2026-08-21** (Search Console → 설정 → 사용자 및 권한 → 전체) |
| 속성 | `sc-domain:durumisaju.com` (**도메인형** — API 호출 시 `sc-domain:` 접두어 필수) |
| 스크립트 | `scripts/gsc-queries.mts` |

**첫 조회 결과 (28일, 2026-07-21~08-18):** 노출 84,303 · 클릭 2,691 · CTR 3.19% · 평균순위 7.3

⚠️ **주의 사항 (재삽질 방지)**
- 키만 있고 **Search Console에 사용자로 추가돼 있지 않으면 403이 아니라 `sites.list`가 빈 배열**을 준다. 헷갈리기 쉽다.
- **데이터가 2~3일 지연**된다. 어제 데이터는 없다. 스크립트는 끝날짜를 3일 전으로 잡는다.
- **90일치만 보관**한다. 장기 추이가 필요하면 주기적으로 받아 저장해야 한다.
- 의존성 없이 서비스계정 JWT를 직접 만들어 토큰을 받는다(`googleapis` 패키지 불필요).

---

## 3. 미보유 — 발급 방법

### 네이버 오픈API (데이터랩 + 검색) — 무료

`NAVER_SEARCHAD_*`(검색광고)와 **완전히 별개**다. Client ID/Secret을 새로 받아야 한다.

**발급:** [developers.naver.com](https://developers.naver.com) → Application → 애플리케이션 등록 →
사용 API 선택(검색 / 데이터랩) → `NAVER_CLIENT_ID` · `NAVER_CLIENT_SECRET` 발급

| 세부 API | 용도 | 한도 |
|---|---|---|
| 데이터랩 검색어트렌드 | 시즌성(신년운세 시점)·**성별/연령대별 분해** | 1,000회/일 |
| 검색 — 지식iN | **질문 수요 조사** → 다음에 쓸 글 주제 발굴 | 25,000회/일 |
| 검색 — 블로그/카페 | 경쟁 콘텐츠·후기 현황 파악 | 25,000회/일 |

**데이터랩 특징:** 5개 검색어 그룹 × 각 20개 키워드 비교, PC/모바일·성별·연령대 조건 지정 가능.
두루미 타깃(35~54세 여성) 가설을 검색 데이터로 검증할 수 있는 유일한 무료 수단.

> ❌ **글 작성 API는 없다.** 네이버 오픈API 목록은 검색 · 로그인 · 회원프로필 · 데이터랩(트렌드/쇼핑) ·
> 캡차 · 캘린더 · 카페 · 공유하기가 전부다. **지식iN 답변, 블로그 포스팅 API는 제공되지 않는다.**
> 카페 API는 **본인이 운영하는 카페**에만 쓸 수 있다.
>
> 자동 답변 봇은 ①네이버 약관(자동화 프로그램 금지) ②지식iN 스팸 정책
> ③공정위 추천·보증 심사지침(사업자 관계 미표시 = 기만적 광고) 세 겹으로 막힌다. 하지 말 것.

### 카카오 알림톡 — 대행사 경유 필수

**카카오에 직접 API를 쏠 수 없다.** 공식 인증 대행사(솔라피, 알리고, NHN클라우드 등, 2026-07 기준 15개사)를 거쳐야 한다.

**절차 3단계:**
1. 카카오톡 채널 개설 → **비즈니스 채널 인증** (채널 개설·관리자페이지·프로필 설정 모두 **무료**)
2. 알림톡 **템플릿 등록 및 심사 승인** (내용 변경 시마다 재심사)
3. 대행사 계약 → API 키 발급

**비용:** 발송 건당 약 7~9원. 솔라피는 월 기본료·API 사용료 무료(건당 과금).
일부 대행사는 월 기본료 1~5만원.

**두루미에 왜 필요한가:** 재방문 유도 장치가 코드상 **0건**이다.
`today`(오늘의 운세, 5알)는 매일 볼 수 있는 유일한 상품인데 **7일간 판매 0건**이었다.
그리고 **이용약관 제7조에 "알 유효기간 만료 30일 전 알림" 의무가 이미 적혀 있다** — 어차피 만들어야 한다.

### 네이버 서치어드바이저

**검색 실적 조회용 공개 API는 확인되지 않았다.** 웹 UI 위주로 봐야 한다.
색인 요청은 **IndexNow 프로토콜**(2023-07~)로 자동화 가능.

**등록:** [searchadvisor.naver.com](https://searchadvisor.naver.com) → 웹마스터 도구 → 사이트 등록 → 소유확인

네이버 유입이 전체의 39.5%(Vercel 기준 최대 유입처)인데 실적을 안 보고 있다.
API가 없더라도 웹 UI로는 주기 점검이 필요하다.

### Threads API — 무료

**발급:** [developers.facebook.com](https://developers.facebook.com) → 앱 만들기 → Threads API 제품 추가 → Threads 계정 연결
**자동 게시 가능.** 사전·연예인 콘텐츠 재활용 파이프라인에 쓸 수 있다.

### Instagram Graph API — 무료

**선행조건:** 인스타 계정을 **프로 계정(비즈니스/크리에이터)** 으로 전환 + 페이스북 페이지 연결
**발급:** developers.facebook.com → 앱 만들기 → Instagram Graph API 추가
**자동 게시 가능.** 현재 `@durumi_saju` 계정은 있으나 API 연동 없음 (프로필 링크만 존재).

### X(트위터) API — 유료

월 $100~ 구간부터 실용적. 현 매출 규모 대비 부담이 커서 **보류 권장**.

---

## 4. 보유했으나 미사용

| API | 자격증명 | 메모 |
|---|---|---|
| **PostHog** | `NEXT_PUBLIC_POSTHOG_KEY` · `NEXT_PUBLIC_POSTHOG_HOST` · `POSTHOG_PERSONAL_API_KEY` | 실사용 안 함. 새 트래킹은 Supabase 자체 테이블로 간다 |

---

## 5. 우선순위 (2026-08-21 기준)

| 순위 | 항목 | 왜 |
|---|---|---|
| ~~1~~ | ~~GSC 연결~~ | ✅ **2026-08-21 완료** |
| 1 | **네이버 오픈API** (`NAVER_CLIENT_ID`) | 하나 받으면 데이터랩+검색 둘 다 열림. 발급 5분 |
| 2 | **카카오 알림톡** | 리텐션 0. 약관 제7조 알림 의무이기도 함 |
| 3 | 네이버 서치어드바이저 | 유입 1위 채널 점검 |
| 4 | Threads / Instagram Graph | 콘텐츠 재활용 자동화 |

---

## 6. 보안 규칙

- **키 값은 이 문서에 절대 쓰지 않는다.** 이름과 발급처만.
- `.env.local` · `gsc-key.json` · `client_secret.json` · `token.json` 은 전부 `.gitignore` 대상.
  새 자격증명 파일을 추가하면 **먼저 `.gitignore`에 넣고** 커밋한다.
- 서버 전용 키(`SUPABASE_SERVICE_ROLE_KEY`, `KAKAO_ADMIN_KEY`, `PORTONE_API_SECRET`, `GEMINI_API_KEY`)는
  **절대 `NEXT_PUBLIC_` 접두사를 붙이지 않는다** — 붙이면 브라우저 번들에 그대로 실린다.
- 유출 의심 시: 발급처에서 즉시 폐기(revoke) → 재발급 → Vercel 환경변수 교체 → 재배포.
