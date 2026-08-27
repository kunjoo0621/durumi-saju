# 두루미사주 (durumisaju.com)

한국 사주팔자 기반 운세 분석 웹서비스. 개인 사주 분석 + 두 사람 궁합 배틀 기능.

## 기술 스택

- **프레임워크**: Next.js 15 + React 18 + TypeScript
- **AI**: Gemini API (`@google/generative-ai`) — Claude API 아님
- **DB**: Supabase (PostgreSQL + RLS)
- **결제**: PortOne (구 아임포트) — 현재 Mock 결제 모드
- **인증**: NextAuth + Kakao OAuth
- **상태관리**: Zustand
- **스타일링**: Tailwind CSS
- **배포**: Vercel

## 핵심 명령어

```bash
npx next build          # 프로덕션 빌드 (배포 전 필수)
npx vercel --prod       # Vercel 프로덕션 배포
npx tsx scripts/...     # 테스트 스크립트 실행
```

## 주요 파일 & 파이프라인

### 사주 분석 파이프라인
```
사주 계산 → enrichment → scoring → grade → LLM 분석 → surgical rewrite
```

| 파일 | 역할 |
|------|------|
| `lib/utils/saju.ts` | 사주 계산 (천간지지, 만세력) |
| `lib/utils/saju-enrichment.ts` | 오행분포, 십성, 신살, 합충형 등 enrichment |
| `lib/utils/saju-scoring.ts` | 5개 카테고리 점수 + composite 계산, `SCORING_VERSION` 관리 |
| `lib/gradeSystem.ts` | 등급 경계 (`COMPOSITE_GRADE_CUTOFFS`), 백분위 계산 |
| `lib/analysis.ts` | Gemini LLM 호출 + 분석 결과 생성 (가장 큰 파일) |
| `lib/surgical-rewrite.ts` | LLM 출력 후처리 (반복 제거, 품질 개선) |

### 배틀 파이프라인
| 파일 | 역할 |
|------|------|
| `lib/battle-prompt.ts` | 배틀 프롬프트 구성 |
| `lib/utils/battle-compare.ts` | 두 사람 점수 비교 |
| `lib/battle-simulations.ts` | 시뮬레이션 시나리오 생성 |
| `lib/battle-postprocess.ts` | 배틀 결과 후처리 |

### 결제 & 인증
| 파일 | 역할 |
|------|------|
| `app/api/payment/complete/route.ts` | 결제 완료 처리 (PortOne 검증) |
| `app/checkout/page.tsx` | 결제 UI |
| `lib/auth.ts` | NextAuth + Kakao 설정 |
| `lib/guest-token.ts` | 비회원 토큰 관리 |
| `middleware.ts` | 인증 보호 라우트 |

## 협업 원칙
- 동의보다 반박을 먼저 한다. 근거가 약하면 즉시 지적
- 모르면 모른다고 한다. 추측을 사실처럼 말하지 않는다
- 제안 시: 현재 방식의 문제 → 대안 장단점 → "이게 더 낫고, 이유는 이거다" 형태
- 코드 변경 시 커밋 메시지에 "왜 바꿨는지"를 반드시 포함
- Gemini 프롬프트 수정 시 `prompts/history/`에 버전별 저장, 이전 버전과 차이점 비교 포함

## 작업 규칙

### 반드시 지킬 것
- ★**실행 환경 TZ는 반드시 `UTC`** (CI·로컬 스크립트 모두. 직관과 반대이니 주의). `@gracefullight/saju` 는 "한국 벽시계를 UTC 인 척 인코딩한" 공간에서 계산한다 — 어댑터가 `timeZone` 을 무시하고 **로컬 필드**를 읽고, 절기 탐색이 그 필드를 UTC 로 간주해 태양황경을 푼다. KST 로 돌리면 **절기가 9시간 밀려 절입 경계 출생자의 월주가 뒤집히고 대운수도 어긋난다**(실측: 1990-05-06 01:00 → UTC `庚辰`(정답, 입하 03:35 전) vs KST `辛巳`(오답)). 프로덕션(Vercel)은 이미 UTC이고 `instrumentation.ts` 가 명시 고정한다(★`TZ` 는 Vercel 예약 환경변수라 프로젝트 설정으론 못 넣는다). **감사 스크립트는 반드시 `TZ=UTC npx tsx scripts/...` 로 실행할 것** — 맥(KST)에서 그냥 돌리면 프로덕션과 다른 값이 나온다. 가드=`lib/saju-solar-terms.golden.test.ts`(발행 만세력 골든값 대조)
- `SCORING_VERSION` 변경 시 숫자를 올려야 DB 캐시가 무효화됨
- 배포 전 `npx next build` 성공 확인
- 등급 경계 변경 시 `PERCENTILE_PIECEWISE`도 함께 수정
- ★**표시 계층(화면)에서 사주 계산 금지** — 화면이 원국을 다시 계산하다 서버 분석값과 6개월간 갈라진 사고가 있었다(D-14, 유료 클레임). 원국·enrichment 는 **서버가 계산해 내려준 값**(`full_json.chart` 스냅샷 또는 `lib/actions/chart.ts` 서버 액션)만 그린다. `.eslintrc.json` 의 `no-restricted-imports` 가 이를 강제하고 위반 시 **빌드가 실패**한다. 표시 전용 헬퍼를 새로 만들어 화면에서 써야 하면 `.eslintrc.json` 의 `importNamePattern` 허용 목록에 이름을 추가할 것(계산 함수는 절대 추가 금지). 회귀 감시: `TZ=UTC npx tsx scripts/audit-hour-pillar-display.mts`(0건이어야 정상), `lib/result-chart.test.ts`
- API 에러 응답에 `error.message` 노출 금지 → 일반 한국어 메시지만 반환, 상세는 `console.error`
- 외부 SDK(PortOne 등) 연동 시 로드 실패 에러 핸들링 필수 — 한국어 메시지 + preload 적용

### 하지 말 것
- 사이드이펙트 있는 광범위한 리팩토링 금지
- 이 프로젝트는 Gemini API 사용 — Claude API로 착각하지 말 것
- 응답 끝에 불필요한 요약 붙이지 말 것

## 현재 설정값 (v21)

- **SCORING_VERSION**: 21 — ★단일 출처는 `lib/utils/saju-scoring.ts`. 이 문서·스크립트에 숫자를 하드코딩하면 반드시 낡는다(2026-08-06, 대시보드가 v18에 고정돼 v18/v19를 합쳐 보여준 사고)
- **등급 경계 (내부, `COMPOSITE_GRADE_CUTOFFS`)**: S≥85, A≥80, B≥70, C≥50, D<50
- **화면 표기 라벨 격상**: 내부 S/A/B/C/D → 표시 SS/S/A/B/C (`displayGrade`). DB 저장값은 여전히 S/A/B/C/D
- **분포 (2214명 전수 재시뮬, v18)**: 최하등급(표시 C) 약 10%. 라벨 격상 후 SS~C 완만 분포
- **중립 기준점**: `SCORING_NEUTRAL = 58` / **composite 천장**: 95
- **시간 미입력 보정**: isBalanced 완화(≥3), deficientCount 0.75 스케일링, composite −1
- **v17→v18 변경**:
  - ① 비겁 개수 정상화: `calculateTenStarsFull`(중복포함) 추가 → "비겁 과다(≥3)" 감점 데드코드 복구 (기존 `calculateTenStars`는 Set 중복제거라 개수 소실). 표시/배틀/LLM은 유니크 `tenStars` 유지
  - ② axisAdj 단조성: `clamp(-15,15)` 대칭 제한(기존 `|diff|>15` 평균-반감이 순서역전 유발 → 제거)
  - ③ C컷 52→50 (①②로 인한 최하등급 증가 상쇄) + `PERCENTILE_PIECEWISE` 경계 동반 조정
- **v18→v19 변경 (2026-07-28, 034a4f4)**: 홍염살 검출에 일지 포함(`saju-enrichment`). 홍염은 통설상 일주로 정의되는 신살인데 일지를 빼고 있어 교과서적 홍염 일주를 통째로 놓쳤다. 검출률 21.8%→28.8%. 등급 영향은 상한이 계산으로 막혀 있다 — 연애운 가중 0.20 × 홍염 +6 = **composite 최대 +1.2점**
- **v19→v20 변경 (2026-08-26)**: 명리 사실 오류 2건 + 기신 산식 교체.
  - ① **천덕·월덕귀인이 일주를 탐색에서 빼고 있었다.** 두 신살의 기준점은 월지인데 일간 기반 신살용 제외 집합(`otherBranchSet`/`otherStemSet`)을 빌려 써서, 삼명통회 「論天月德」이 으뜸으로 치는 자리(`須要日上見`)만 골라 못 봤다. 전수 518,400 원국 중 **11.76%(60,938건)**의 검출 결과가 달라진다
  - ② **강약 4득에서 12운성 생왕지 경로 제거 + 통근 전층 인정.** 기존 하이브리드는 "12운성이 장생·관대·건록·제왕이면 오행과 무관하게 득"으로 쳤는데, 그렇게 추가되던 13개 조합이 **전부 일간을 돕지 않는 십성**이었다(칠살 4·식상 6·재성 3). 칠살월을 득령으로 세는 셈이라 왕상휴수와 방향이 반대. 대신 득지·득시는 지장간 전층 통근으로 넓혔다(자평진전 "就使逢庫, 亦為有根"). ★두 변경은 **한 쌍**이다 — 12운성만 빼면 중화신약이 3.5%로 붕괴한다
  - ③ **기신이 육효(六爻) 공식이었다.** `findElementThatControls(용신)` = "용신을 극하는 오행"은 육효의 정의이고, 자평 억부에서는 인과가 거꾸로다(적천수 "忌神者, 損害體用之神也" — 병이 먼저고 용신이 거기서 도출). 신강+관성 용신인 **819명(25%)**에게 식상이 기신으로 나갔는데, 식상은 방금까지 동급 용신 후보였다. 억부 진영 매핑으로 교체 + 불변식 assert 3개 추가
  - ④ 지장간 寅 가중치 7/3/3(합 13) → 5/3/2. 12지지 중 寅만 합이 10이 아니었다
  - 실사용자 실측: 8단계가 **1,037/3,231명** 변동, 강↔약 진영 뒤집힘 241명. **grandfather 유지로 기존 결제자 하향 0** — 신규 분석에만 적용
  - ★남은 과제(이번 스코프 밖, 감사로 확인): 득세에 년지가 안 들어감 · 시주 미상 이중 편향(극왕·신강 도달 불가) · 극왕≠종왕인데 관살 0 명식에 관성 용신이 확정 출력 · 조후용신과 기신이 같은 오행으로 동시 출력(282명)
- **v20→v21 변경 (2026-08-27)**: 극왕에 관살이 없으면 관성이 **구조적으로** 용신이 되던 문제.
  - 신강 분기가 후보 {관성·식상·재성}을 분포 오름차순 정렬하므로, 관살 0 = 최저값 = 반드시 선택. 실측 극왕 146명 중 관살 0인 **54명 전원**이 관성 용신을 받고 있었다
  - 그런데 적천수천미 從象은 그 명식을 종왕(從旺)으로 보고 관살운을 **"犯旺, 凶禍立至"**라 한다. 자사 사전 `gangyak/geukwang.ts:41`도 이미 "종격이면 용신은 정반대로 비겁·인성"이라 적어 **엔진만 사전·고전을 못 따라가던 상태**
  - ★"관살 0"만으로 종왕을 선언하지 않는다. 요건은 셋 — "四柱皆比劫, 無官殺之制, 有印綬之生". 재성이 있으면 四柱皆比劫이 아니고 임철초가 **"遇財星, 群劫相爭, 九死一生"**이라 한 배치다. 실측 54명 중 재성 보유 25명
  - 갈래 둘: **종왕**(극왕+관살0+재성0+인수≥1, 29명) → 용신 비겁·희신 인성·기신 관성 / **관성 제외**(나머지 25명) → {식상·재성} 중 최저
  - 실측: 용신 변경 54명, **그 밖에서 바뀐 인원 0명**(변경 국소성 전수 증명), composite 상승 35·**하락 0**·동일 19(평균 +1.06), 등급 상승 1·**하락 0**
  - ★스코프 밖: 태강(요건이 "旺之極") · 종강/종아/종재/종살 · 화격
- **grandfather (결제자 보호)**: 이미 언락된 결과는 stale이어도 재계산 안 함(하향 방지). `payment/complete`·`intake/session`의 재계산 지점을 재사용으로 변경 (단 `_error`/null 결과는 재분석 유지). 수정 산식은 신규 분석에만 적용. 배틀/today/yearly는 즉석 재계산이라 grandfather 미적용(즉시 반영)
- 상세 이력: memory/project_durumi_scoring_bugs.md, project_durumi_scoring.md

## 디자인 시스템

→ **`docs/DESIGN_SYSTEM.md`** 참조 (컬러, 타이포그래피, 컴포넌트 상세)

## 프로젝트 구조

```
app/
  api/          # API 라우트 (analyze, battle, payment, results 등)
  checkout/     # 결제 페이지
  result/       # 결과 표시
  battle/       # 배틀 입력/결과
  my/           # 내 결과 목록
components/     # React 컴포넌트 (위 디자인 시스템 참고)
lib/            # 비즈니스 로직 (위 파이프라인 테이블 참고)
store/          # Zustand 스토어 (useInputStore, useBattleStore)
scripts/        # 테스트/유틸 스크립트 (Monte Carlo, 등급 시뮬레이션 등)
supabase/       # 마이그레이션 SQL
```
