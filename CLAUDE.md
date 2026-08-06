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
- API 에러 응답에 `error.message` 노출 금지 → 일반 한국어 메시지만 반환, 상세는 `console.error`
- 외부 SDK(PortOne 등) 연동 시 로드 실패 에러 핸들링 필수 — 한국어 메시지 + preload 적용

### 하지 말 것
- 사이드이펙트 있는 광범위한 리팩토링 금지
- 이 프로젝트는 Gemini API 사용 — Claude API로 착각하지 말 것
- 응답 끝에 불필요한 요약 붙이지 말 것

## 현재 설정값 (v18)

- **SCORING_VERSION**: 18
- **등급 경계 (내부, `COMPOSITE_GRADE_CUTOFFS`)**: S≥85, A≥80, B≥70, C≥50, D<50
- **화면 표기 라벨 격상**: 내부 S/A/B/C/D → 표시 SS/S/A/B/C (`displayGrade`). DB 저장값은 여전히 S/A/B/C/D
- **분포 (2214명 전수 재시뮬, v18)**: 최하등급(표시 C) 약 10%. 라벨 격상 후 SS~C 완만 분포
- **중립 기준점**: `SCORING_NEUTRAL = 58` / **composite 천장**: 95
- **시간 미입력 보정**: isBalanced 완화(≥3), deficientCount 0.75 스케일링, composite −1
- **v17→v18 변경**:
  - ① 비겁 개수 정상화: `calculateTenStarsFull`(중복포함) 추가 → "비겁 과다(≥3)" 감점 데드코드 복구 (기존 `calculateTenStars`는 Set 중복제거라 개수 소실). 표시/배틀/LLM은 유니크 `tenStars` 유지
  - ② axisAdj 단조성: `clamp(-15,15)` 대칭 제한(기존 `|diff|>15` 평균-반감이 순서역전 유발 → 제거)
  - ③ C컷 52→50 (①②로 인한 최하등급 증가 상쇄) + `PERCENTILE_PIECEWISE` 경계 동반 조정
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
