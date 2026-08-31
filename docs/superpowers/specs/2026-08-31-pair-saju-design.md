# 질문형 사주 신상품 3종 — 설계 + 구현 계획

> 1·2번은 2인(20알) 페어 상품, 3번은 1인(10알) 단독 상품이다. 문서 파일명의 `pair`는 초안 시점 이름이라 3번에는 해당하지 않는다.

- 작성일: 2026-08-31
- 상태: **운영자 확정 반영본.** 확정 항목 — 상품 3종 정의 / couple·child 20알·2인 · past 10알·1인 / 등급은 개인사주 전용 / 강약·용신은 계산엔 쓰되 라벨·용어 미노출 / 동성 커플 분기 없이 표현 중립화 / 파(破) 제외 / 메뉴 미개편·홈 섹션 신설 / 출시순서 couple→past→child
- 표기 규약: **[확인]** = 코드/DB 마이그레이션에서 직접 실측한 사실, **[제안]** = 이 문서의 설계 제안
- 대전제: 신상품 3종은 **`SCORING_VERSION`(현행 v21, `lib/utils/saju-scoring.ts` 단일 출처)·composite 산식·등급 경계·grandfather 정책을 일절 건드리지 않는다.** 신규 테이블·신규 결정론 스케일만 추가한다. 기존 결제자 영향 0.

---

## 0. 브리프 전제의 실측 교정 (먼저 읽을 것)

운영자 브리프의 전제를 코드에서 재확인한 결과, 4건은 그대로 성립하고 3건은 교정이 필요하다.

1. **[확인] "두 원국의 관계를 보는 엔진은 아직 없다"는 부분적으로만 맞다.** `lib/utils/battle-compare.ts:43`(`compareBattle`, 109줄)는 실제로 5카테고리 점수만 비교한다. 그러나 **`lib/utils/battle-interaction.ts:43`(`calculateBattleInteraction`, 200줄)이 이미 두 EnrichedSaju를 받아** ①일간 천간합·천간충·오행 생극비화(6-11행 테이블, 90-123행), ②용신 상보(60-87행), ③오행 상보율(126-149행), ④대운 동기화(152-200행)를 결정론으로 산출해 배틀 파이프라인(`app/api/battle/analyze/route.ts:13`)에서 사용 중이다. **진짜 없는 것은 지지 전수 대조(합·충·형·파·해·원진·귀문 4×4 매트릭스)와 십성 상호작용(상대 일간이 내게 어떤 십성인가), 신살 교차, 결혼 타이밍 교차다.** 따라서 신설 엔진의 "흡수"는 battle-interaction의 4계산 이관 + 결손 축 신설을 뜻한다.
2. **[확인] "펫궁합의 주인 쪽은 생년만 받는다"는 코드와 다르다.** `lib/pet-compat-saju.ts:277-283`의 `extractPetCompatSignals`는 보호자 쪽에 **풀 `EnrichedSajuData`**를 받아 일간·일지·십성·강약을 전부 원국 기반으로 쓴다. 신뢰도 제한은 **펫 쪽**(4티어 fallback, 25-49행; tier 3·4 신호 중화, 376-391행)에 있다. 재사용 가치가 브리프 추정보다 크다 — 특히 tier 중화 패턴은 신상품의 "상대 시주 미상" 처리의 사내 선례다.
3. **[확인] 파(破)는 엔진에도 사전에도 없다.** `getPairRelation`(`lib/utils/saju-enrichment.ts:836-928`)의 타입은 hap/samhap/banghap/chung/hyung/wonjin/same/none 뿐이고, **해(害)도 엔진에 없다**(사전에는 6해 전부 있음 — `lib/dict/data/relation/{jami,chuko,insa,myojin,yusul,sinhae}-hae.ts`). 귀문도 엔진 미검출(사전 `lib/dict/data/sinsal/gwimun.ts`만 존재). → §2 Phase 0에서 해·귀문은 신설, 파는 스코프 결정(아래 명시).
4. **[확인] 격국 판정 기능은 없다.** `lib/analysis.ts:1990`이 "격국 명칭은 코드에 판정 기능이 없다"며 전 격국명을 프롬프트에서 금지 중이다. 사전에는 `lib/dict/data/gyeokguk/`(8정격+건록격+양인격) 엔트리가 있고, `saju-enrichment.ts:419` 희신 매핑이 이 사전과 정합을 맞춘 선례가 있다. → 상품 2의 "격국 기반"은 판정기 신설 없이는 불가하므로 Phase-gate 한다(§3-2).
5. **[확인] 클론 패턴 실재.** `bareStar`/`tenStarOf`는 `lib/marriage-facts.ts:42-49`·`lib/career-facts.ts:63-72`·`lib/wealth-facts.ts:58`에 3중 정의, `ADJACENT_PILLARS`는 `marriage-facts.ts:59`(주석에 "wealth-facts.ts의 ADJACENT_PILLARS와 동일 구조")·`career-facts.ts:156`, `STEM_WEIGHT`/`JIJANGGAN_POSITION_WEIGHT`/`collectWeightedHits`/`sumWeight`는 `career-facts.ts:81-123`, `deriveTiming`은 `marriage-facts.ts:283`·`career-facts.ts:353`에 각각 중복.
6. **[확인] 배틀에는 결정론 조합명 선례가 있으나 죽어 있다.** `lib/battle-chemistry.ts:79` `selectChemistryLabel`(관계유형×팽팽/일방 → 「주인과 강아지」류 라벨 풀)은 **현재 import 하는 곳이 0곳**(전수 grep)이고 `battle-prompt.ts:526`이 chemistry label 생성을 금지한다. ~~상품 3 조합명 설계의 참고 선례~~ — 3번이 1인 상품으로 바뀌어 조합명이 사라졌으므로 **이 항목은 이제 무관하다**(죽은 코드라는 사실만 기록으로 남긴다).
7. **[확인] 캐릭터 정적 자산은 사실상 없다.** `public/images/`에는 hub 포스터 5종·marriage/wealth/career 포스터·stories 인물 컷뿐이고 캐릭터는 `public/durumi-character.png` 하나다. 대신 **펫 일러스트 생성 파이프라인**(`lib/pet-compat-illustration.ts:10`, `gemini-2.5-flash-image`, Supabase Storage 저장)이 살아 있다 — past 유형 일러스트 12장을 1회성 배치로 뽑는 §5-2 재사용안의 실체.

---

## 1. 상품 정의

공통: teaser 무료 → analyze 과금(결혼운 결제 배치 미러, `app/api/marriage/start/route.ts:1-4` "teaser까지 무료, 과금은 analyze"). 가격 상수는 `lib/constants/coins.ts`에 추가(§4-4).

**★2026-08-31 운영자 변경: 3번 상품이 「동물 조합(2인·20알)」에서 「내 전생(1인·10알)」으로 바뀌었다.** 따라서 3종이 더 이상 균질하지 않다 — 1·2번만 2인·20알이고, 3번은 1인·10알이다. 이 문서에서 `duo`로 적힌 서술은 전부 폐기되었고 §1-3·§5-2·Phase 4가 그에 맞춰 교체되었다.

### 1-0. ★운영자 확정 — 등급은 개인사주 전용 (2026-08-31)

**pair 3종은 등급(표시 SS/S/A/B/C)을 화면에 노출하지 않는다.** 등급은 개인사주에서만 보여준다.

**왜 이 결정이 필요했나 (실측)**: grandfather 정책상 이미 언락된 결과는 산식이 올라가도 재계산하지 않는다. 저장된 `saju_results` 3,341건의 `full_json.scoringVersion` 분포를 실측하면 **v17 2,050건(61.4%) · v18 249 · v19 377 · v20 3 · v21 53건(1.6%) · 버전 없음 23**이다. 즉 현행 v21로 굳어 있는 결과는 1.6%뿐이다. 반면 pair 3종은 **신규 계산이라 항상 최신 버전**으로 산출된다. 그대로 두면 같은 사용자가 개인사주 화면에서는 v17 판정을, couple 화면에서는 v21 판정을 보게 된다 — CLAUDE.md 실측으로 v19→v20 하나만으로도 강약 8단계가 1,037/3,231명 바뀌고 강↔약 진영이 241명 뒤집혔다. "유료인데 두 화면이 다른 말을 한다"는 클레임의 직접 원천이다.

**따라서 구현 규칙**:
1. pair 3종의 teaser·결과·공유 카드·OG 이미지 어디에도 **등급 라벨을 렌더하지 않는다**. `displayGrade`·`COMPOSITE_GRADE_CUTOFFS` 소비 금지.
2. 내부 계산에서는 스코어링을 그대로 쓴다(판정 가중의 재료). **표면에 안 낼 뿐 계산은 한다.**
3. **두 사람 모두 최신 산식으로 계산한다.** 기존 개인사주 결과의 동결 스냅샷을 A쪽에만 재사용하면 "나는 옛 자, 상대는 새 자"로 재는 셈이라 비교 자체가 성립하지 않는다 — 스냅샷 재사용 금지.
4. **★강약·용신 — 확정 (2026-08-31, 운영자 반박 후 교정).** 초안은 "라벨로 못 박지 말 것"이라고만 적어 *사용*과 *표시*를 뭉뚱그렸다. 교정한다.
   - **계산에는 전부 쓴다.** 강약·용신 없이는 풀이가 성립하지 않는다 — 이건 정확도를 깎는 문제가 아니라 상품이 안 나오는 문제다.
   - **화면에 위젯을 다시 그리지 않는다.** [확인] 개인사주는 `components/saju/SajuChart.tsx:128-141`에서 강약 8단계 스펙트럼(극약→극왕)과 용신 배지를 실제로 렌더한다. couple이 같은 위젯을 그리면 두 화면이 나란히 다른 값을 보인다.
   - **서술에서도 명리 용어를 쓰지 않는다.** "신약이라서"가 아니라 "스스로 밀고 나가는 힘이 약해서 곁의 사람 영향을 크게 받아"처럼 **뜻으로** 쓴다. 이는 사내 용어 최소화 원칙과도 일치하며, 계산을 다 쓰므로 풀이 깊이는 손실이 없다.
   - **크기 근거**: CLAUDE.md 실측으로 v19→v20 한 번에 강약 8단계가 1,037/3,231명(32.1%) 바뀌었고 강↔약 진영이 241명(7.5%) 뒤집혔다. 저장 결과의 61.4%가 v17이므로 v17↔v21 격차는 이보다 크다.
   - 강제 수단: `couple-postprocess.ts` 금지어에 강약 8단계 명칭·용신·희신·기신을 포함(child·past도 동일).
5. 회귀 감시: `grep -rn "displayGrade\|COMPOSITE_GRADE_CUTOFFS" app/{couple,past,child}` 가 0건이어야 한다(Phase 2·4·5 완료 판정에 포함).

| # | 상품 | slug **[제안]** | 라우트 | 입력 | 핵심 산출 |
|---|---|---|---|---|---|
| 1 | 우리 결혼해도 되는 사주일까 | `couple` | `/couple` | 나(대표사주 재사용 or 직접입력) + 상대(직접입력) | 4축 신호등 + 종합 판정 + 근거 서술 + 타이밍 교차 |
| 2 | 우리 아이는 어떤 일에 맞을까 | `child` | `/child` | 부모(나) + 아이 | 아이 "먹고사는 결" 3축 + 두각 시기 + 부모 서포트 가이드 |
| 3 | 나는 전생에 어떤 사람이었을까 | `past` | `/past` | **나 1명** | 업연 유형 판정 + 이번 생 과제 + 반복되는 패턴 (**10알**) |

### 1-1. couple — "우리 결혼해도 되는 사주일까"

기존 결혼운(10알, 1인, `lib/marriage-facts.ts`)은 **내 원국 안의 배우자궁·배우자성**만 본다. couple의 정확도 차별화 실체는 상대 원국이 들어와야만 계산 가능한 축들이다:

- **십성 교차**: 상대 일간이 **내 일간 기준 무슨 십성인가** — 여명에게 상대 일간이 정관이면 "배우자성이 사람으로 온" 구조(고전 궁합의 1축). 쌍방향 산출.
- **배우자궁 상호 대조**: 내 일지 ↔ 상대 일지의 합·충·형·해·원진·귀문 + 상대 일지 정기(BRANCH_INFO 본기)가 내 배우자성인지.
- **전수 지지 대조**: 4×4(시주 미상 시 3×3) 매트릭스 — 특히 원진·귀문 교차 개수.
- **용신 상보·오행 보완**: battle-interaction 로직 이관(§2).
- **타이밍 교차**: 양쪽 `deriveTiming`(marriage-facts:283)의 결혼 트리거 연도 **교집합** — "둘 다 열리는 해"는 1인 상품이 구조적으로 낼 수 없는 산출.

**판정 프레임 [제안]**: "결혼해라/하지 마라" 단정은 명리적으로도 CS적으로도 불가. 대신 **4축 신호등**(마음의 결(일간) / 생활의 결(일지·배우자궁) / 서로 채우는가(용신·오행) / 때가 맞는가(타이밍)) 각 3단계(順/평/逆) + **종합 판정 5단계**(결정론 가중합 매핑). 헤드라인은 판정 단계별 고정 스켈레톤에 LLM이 살을 붙이되, 단계·축 값 자체는 서버 결정론. 무배우자성·전축평탄 케이스의 "인연 약함" 단정 금지는 `marriage-prompt.ts:197` 규칙을 승계한다.

**성별·동성 커플 정책 ★운영자 논의 후 확정 (2026-08-31) — 분기를 만들지 않는다**

초안은 "동성이면 배우자성 축을 생략"이었다. **폐기한다.** 배우자성은 *각자 자기 성별로 자기 원국에서* 뽑는 값이고(여명=관성, 남명=재성), "상대 일간·상대 일지 정기가 내 배우자성 오행인가"의 대조는 상대 성별과 무관하게 그대로 성립한다. 즉 계산이 막히는 지점이 없다. 성별은 어차피 **무조건 받아야 한다** — 대운 순행/역행이 성별로 갈려 사주 계산 자체가 성별 없이는 불가능하다.

따라서 `spouseStarFrameApplicable` 같은 분기 플래그를 두지 않는다. 대신 **표현을 중립으로 통일**한다:
- ✗ "남편 자리", "아내 될 사람" → ✓ "짝을 나타내는 자리", "곁에 올 사람"
- 이 규칙은 이성 커플에도 그대로 적용한다(결혼 전인데 "남편"은 어색하다 — 일관성과 자연스러움이 같이 는다).
- 강제 수단: `couple-postprocess.ts`의 결정론 금지어(남편·아내·시댁·처가 등 혼인 신분어)로 스크럽. 프롬프트 지시만으로는 샌다는 것이 사내 선례(`pet-compat-saju.ts:439` 주석).

**[미측정]** 동성 커플 비중은 세지 못했다 — `saju_battles.full_result`에 성별 필드가 없다(`playerA`/`playerB`/`comparison`/`llmAnalysis`/`relationshipType`만 존재). 규모를 근거로 쓰지 말 것.

### 1-2. child — "우리 아이는 어떤 일에 맞을까"

2층 구조: **아이 명(命) 층**(아이 단독 원국)이 본체, **부모-아이 관계 층**(pair 엔진 서브셋)이 "어떻게 밀어줄까"를 담당.

- 아이 층: `career-facts.ts:81-123`의 가중 십성 강도(`collectWeightedHits`+`sumWeight`)를 공용 모듈로 일반화(§2-4)해 **식상(만드는/표현하는) vs 재성(파는/굴리는) vs 인성(가르치는/파는 지식)** 3축 + **관인 구조(조직형) vs 식상·재성 구조(독립형)** + **두각 시기 = 대운에서 주도 십성이 힘을 받는 구간**(deriveTiming 일반화)을 산출.
- 관계 층: 부모 오행이 아이 용신을 채우는가/기신을 자극하는가(용신 상보), 일간 생극(밀어주는 방향), 일지 합충(생활 마찰).
- **금지 프레임(운영자 확정)**: 직업 특정("의사·변호사가 된다") / 재물운 프레임 / 결혼운 프레임. → 결정론 postprocess 금지어 리스트로 강제(§3-2). `marriage-prompt.ts:127`의 영구 배제 신살 메커니즘과 동일 방식.
- 격국 명칭: 판정기(Phase 6) 검증 전까지 `analysis.ts:1990` 금지 유지. **격국명 없이도** 가중 십성 3축이 "무엇으로 먹고사는 결"을 커버한다.

### 1-3. past — "나는 전생에 어떤 사람이었을까" (1인 · 10알)

재미가 1순위(운영자 2회 요구 — 깎지 말 것). **pair 엔진을 쓰지 않는 유일한 상품**이며, 기존 1인 enrichment만으로 성립한다.

**★명리적 정직성 — 이 상품의 설계 제약 (운영자와 합의)**

전생은 자평 명리의 개념이 아니다. 팔자로 "전생에 무엇이었다"를 계산하는 방법은 없으며, 그대로 만들면 처음부터 끝까지 창작이 된다. 우리는 "정확한 사주"를 파는 브랜드라 이 격차를 그냥 넘길 수 없다.

**따라서 이 상품의 규칙: 계산은 진짜로 하고, 이름만 전생으로 붙인다.** 판정의 재료는 전부 원국에서 결정론으로 뽑히는 실재 사실이어야 하며, 그 사실을 "전생에서 넘어온 것"이라는 서사로 해석해 보여준다. 근거 없는 전생 설정(신분·직업·시대·성별·전생의 사건)은 **전면 금지**한다.

**[확인] 재료는 이미 엔진에 전부 있다** — 신설 계산이 사실상 없다:

| 재료 | 위치 | 서사에서의 역할 |
|---|---|---|
| 공망(空亡) + **위치**(년지·월지·시지) | `saju-enrichment.ts:1104`(지지 계산), `1305-1327`(검출·근거 문자열) | "원래 내 몫이 아니었던 자리" — 전생 서사의 1축 |
| 없는 오행(`deficient`) | `saju-enrichment.ts:169-177` | "평생 목마른 것 = 전생에 못 채우고 온 것" |
| 원진 | `saju-enrichment.ts:815`(WONJIN), 원국 내 `getPairRelation` | "이유 없이 꼬이는 자리 = 못 끝낸 관계" |
| 신살 전반(화개·역마·도화·백호·양인·천을귀인 등) | `saju-enrichment.ts` ShinsalResult | 업연 유형 분기의 보조 신호 |
| 강약·용신 | 기존 | 이번 생 과제의 방향 |

**[확인] 없는 것: 귀문.** 엔진 검출이 없고 사전(`lib/dict/data/sinsal/gwimun.ts`)에만 있다. → past에 쓰려면 §2-5의 사전 정합 절차로 신설해야 한다. **v1 스코프 결정 [제안]: 귀문 없이 출시.** 공망·결핍오행·원진·신살만으로 유형 판정이 성립하고, 귀문은 원진과 조합이 겹쳐 학파차가 있어(우리 사전이 이미 명문화) 검증 비용이 크다.

**산출 [제안]**
- **업연 유형** N종 중 1개 판정 — 결정론(공망 위치 × 결핍오행 × 원진 유무 × 대표 신살). 유형 수는 Phase에서 확정하되 **분포 감사로 특정 유형 쏠림 없음을 완료 조건에 넣는다**.
- **이번 생 과제** — 용신·희신 방향의 결정론 매핑.
- **반복되는 패턴** — 원진·공망 위치가 가리키는 생활 영역(년지=바깥·뿌리, 월지=일·사회, 시지=말년·자식).
- **서술** — LLM. 위 결정론 값만 근거로 쓰고, 전생 설정 창작은 postprocess가 스크럽(§3-3).

**공유**: 1인 상품이라 "너는 전생에 뭐였을까?" 카드가 카톡으로 나가기 좋다 — pair 상품보다 오히려 바이럴이 쉽다(상대 생년월일이 필요 없다).

---

## 2. 공용 관계 엔진 설계 — `lib/pair/`

### 2-1. 파일 구성 [제안]

```
lib/pair/
  relation-tables.ts        # 해(害)·귀문·(파) 신설 테이블 + 천간충 정본화. 지지 66쌍 전수 관계 산출
  pair-facts.ts             # derivePairFacts(a, b, { currentYear }) → PairFacts (결정론 코어)
                            # ★currentYear 는 반드시 인자로 받는다(new Date() 금지) — 아래 Phase 1 참조
  pair-input.ts             # PairPersonInput 정규화 + 두 원국 계산 번들 (battle의 playerToInputPayload 미러)
  couple-decision.ts        # 상품 1 판정 레이어
  child-path.ts             # 상품 2 판정 레이어 (Phase 6)
  (각 파일마다 동명 .test.ts)
lib/facts-core.ts           # bareStar·tenStarOf·PILLARS·ADJACENT_PILLARS·가중치·collectWeightedHits·sumWeight 공용화
```

**[확인] 주의**: `package.json:11`의 테스트 글롭이 `tsx --test lib/*.test.ts`라 **`lib/pair/` 하위 테스트가 npm test에 안 잡힌다.** Phase 0에서 `lib/**/*.test.ts`로 확장(또는 `lib/pair-*.test.ts` 평면 배치)을 함께 한다. 실행은 항상 `TZ=UTC npm test`.

### 2-2. 기존 자산 흡수·참조 방침 [제안]

| 자산 | 방침 | 근거 |
|---|---|---|
| `saju-enrichment.ts`의 `YUKAP:710`·`YUKCHUNG:726`·`HYUNG:735`·`WONJIN:815`·`SAMHAP:719`·`BANGHAP:824`·`getPairRelation:846` | **정본으로 그대로 import** (복사 금지) | 단일 진실원 — marriage-facts:211 주석이 이미 이 함수를 정본으로 쓰는 선례 |
| `lib/utils/battle-interaction.ts` 4계산 | **로직을 pair-facts.ts로 이관하되 원본은 v1에서 무수정 유지.** Phase 7(선택)에서 내부를 pair 엔진 호출로 교체 + 골든 동등성 테스트 | CLAUDE.md "사이드이펙트 있는 광범위 리팩토링 금지". 배틀은 매출 현역(30일 62건) |
| `lib/pet-compat-saju.ts:171-213`의 관계 테이블·helper | **신규 코드에서 참조 금지(superseded).** 파일 상단에 "신규는 lib/pair 사용" 주석 1줄만 추가(동작 무변경) | 사설 복사본 — saju-enrichment 정본과 이중화 |
| `lib/utils/battle-compare.ts` | 무관(점수 비교기) — 손대지 않음 | 배틀 전용 |
| `marriage-facts.ts`의 `deriveMarriageFacts`·`deriveTiming` | couple이 **함수 그대로 호출**해 1인 축(배우자궁 안정도 등)을 재사용 | 기존 결혼운 리포트와 값 모순 원천 차단(§7) |

### 2-3. `derivePairFacts` 산출 사실 [제안]

```ts
interface PairFacts {
  // 일간 관계 (battle-interaction 이관 + 확장)
  dayStemRelation: { type: "합"|"충"|"생"|"극"|"비화"; direction: "AtoB"|"BtoA"|null; label; hanjaLabel };
  // 일지(배우자궁) 상호
  dayBranchRelation: PairBranchRelation;          // 합충형해원진귀문·삼합반합·방합·동일 — 확장 getPairRelation
  // 전수 지지 대조 (4×4, 시주 미상 시 해당 행/열 제외)
  branchMatrix: Array<{ posA: Pillar; posB: Pillar; relation: PairBranchRelation }>;
  wonjinCount: number; gwimunCount: number; chungCount: number; hapCount: number;
  // 십성 교차
  tenStarExchange: { aSeesB: string; bSeesA: string };   // 내 일간 기준 상대 일간의 십성 (bare)
  spouseStarCross: {                                      // couple 전용 소비, 엔진이 산출
    // ★분기 플래그 없음(§1-1 운영자 확정). 성별 무관하게 무조건 양방향 산출한다.
    aHitByB: boolean; bHitByA: boolean;                   // 상대 일간·상대 일지 정기가 내 배우자성인가
  };
  // 신살 교차
  shinsalCross: { dohwaBoth: boolean; hongyeomBoth: boolean; cheoneulExchange: boolean };
  // 용신·오행 (battle-interaction 을 import 해서 채운다 — 복사 아님, §Phase 1-2)
  yongshinCompat: {...}; elementCoverage: {...};
  // 타이밍 교차
  fortuneCross: {
    daeunSync: {...} | null;                              // 이관
    timingOverlapYears: number[];                         // 양쪽 결혼 트리거 연도 교집합 (couple)
  };
  // 신뢰도
  reliability: { aTimeUnknown: boolean; bTimeUnknown: boolean; neutralizedAxes: string[] };
}
```

- **시주 미상 degradation [제안]**: 시주 파생 셀만 매트릭스에서 제외하고 일간·일지·년월 축은 전부 유지. 축 자체가 무력화되는 경우(예: 둘 다 시주 미상 + 판정 가중 재정규화)는 `neutralizedAxes`에 기록해 프롬프트 가드가 자동 작동 — 펫 tier 중화(`pet-compat-saju.ts:376-391`)와 동일한 "서버 절삭" 철학(지시-only 가드는 새는 것이 실측된 선례, 439행 주석).
- **대칭성 불변식**: `derivePairFacts(a,b)`와 `derivePairFacts(b,a)`는 방향 필드 미러 외 동일해야 한다(프로퍼티 테스트, §6 Phase 1).

### 2-4. `lib/facts-core.ts` — 클론 패턴 단절 [제안]

신규 3종만 사용한다. **기존 marriage/wealth/career-facts는 1줄도 안 바꾼다**(grandfather·회귀 리스크 0). 대신 **계약 테스트**(`lib/facts-core.test.ts`)가 골든 입력 N건에 대해 facts-core 산출 = 레거시 3파일 내 동일 로직 산출임을 대조해, 두 구현이 미래에 갈라지는 것을 감시한다. 레거시 통합(치환)은 이 계획의 스코프 밖으로 명시한다.

### 2-5. 관계 명리의 출처와 사전 정합 담보

- **채택 룰과 출처 [제안]**: 천간합 5조·천간충 4조(연해자평 통설, battle-interaction:6-11 기존 테이블 승계) / 지지 육합·육충·삼형·자형(자평진전·연해자평 통설, saju-enrichment 정본) / 육해(害) 6조(子未·丑午·寅巳·卯辰·申亥·酉戌 — **사전 6엔트리와 1:1 대조**) / 원진 6조(고전 원전이 아닌 후대 통설임을 인지, 기존 WONJIN:815 승계) / 귀문 — 원진과 조합이 겹치되 학파차가 있음을 **우리 사전이 이미 명문화**(`lib/dict/data/sinsal/wonjin.ts:53`, `lib/stories/data/wonjin-sal.ts:130-153`): 사전 `gwimun.ts`의 조합 표기를 그대로 코드 테이블화한다(사전=하우스 정본 원칙, v21 때 "엔진만 사전을 못 따라가던 상태"를 교정한 선례의 역방향 적용).
- **파(破) 스코프 — ★운영자 확정 (2026-08-31): 넣지 않는다.** 근거: ①엔진·사전 양쪽 모두 부재(§0-3)라 추가 시 사전 신규 집필이 선행돼야 정합 원칙이 성립, ②현대 한국 실무 통설에서 파의 실전 비중이 합충형해원진 대비 낮고 해석 일관성도 약함, ③couple 판정 정확도에 기여하는 축이 아니라 노이즈 축. 나중에 넣기로 뒤집는다면 Phase 0에 `dict/data/relation/*-pa.ts` 6건 집필이 선행돼야 한다(사전=정본 원칙).
- **정합의 기계적 담보**: `lib/pair/relation-tables.test.ts`가 ①지지 66쌍(12C2+자기쌍 12) 전수 스냅샷, ②육해·귀문 테이블 ↔ `lib/dict/data/relation/*-hae.ts`·`sinsal/gwimun.ts`의 슬러그·조합 존재 대조, ③기존 `getPairRelation`과의 우선순위 비충돌(합>충 순서 등, saju-enrichment:855-921 순서 준수)을 계약으로 강제.

---

## 3. 상품별 판정 레이어

### 3-1. `couple-decision.ts` [제안]

- 입력: `PairFacts` + 양쪽 `MarriageFacts`(기존 `deriveMarriageFacts` 재사용 — 내 쪽 값은 기존 결혼운 리포트와 **함수 단위로 동일**).
- **★궁위 가중은 이 판정 레이어에서 준다 — 사실 레이어(PairFacts)는 raw 로 둔다.** 년·월·일·시는 자리마다 뜻이 다르고(년=뿌리·집안, 월=사회, 일=배우자궁, 시=말년·자식) 특히 일지↔일지가 가장 무겁다. 그런데 가중을 PairFacts 에 넣으면 "사실"이 판정 파라미터에 오염된다. `branchMatrix` 가 `posA`/`posB` 를 들고 있으므로 판정 레이어가 위치를 보고 재계산한다. 평탄 카운트(`wonjinCount` 등)는 판정 입력에서 빼거나 참고치로 격하한다.
  - 배율 [제안, Phase 2 경계 캘리브레이션에서 확정]: 동일 궁위 쌍(년↔년·월↔월) 기본 가중, **월지 관여 셀 ×1.5**(`career-facts.ts:84` `MONTH_BRANCH_MULTIPLIER` 미러), 원거리 교차(년↔시) 할인(`marriage-facts.ts:59` `ADJACENT_PILLARS` 의 원거리 절삭 철학의 2인 버전). 고전은 겉궁합(년지)↔속궁합(일지)의 경중 차등 자체는 지지하지만 **구체 배율은 고전에 없다** — 자사 선례 배율을 초기값으로 쓰고 분포로 조정하는 것이 정직하다.
- 4축 점수(각 −2~+2 정수): 일간 축(합 +2, 생 +1, 비화 0, 극 −1, 충 −2) / 일지 축(합·삼합반합 양수, 충·형·원진·귀문 음수, 궁위 가중 매트릭스 보정) / 상보 축(용신 상호 +2 ~ 기신 상호 −2, 오행 커버리지 보정) / 타이밍 축(교집합 연도 유무·근접도).
- 종합 판정 5단계: 가중합의 고정 경계 매핑. 경계값은 MC 실측(§6 Phase 1) 후 확정하되 **경계 확정 절차 자체를 완료 판정에 포함**(빈칸 아님 — 확정 전 출시 불가 게이트).
- consistency 규칙(`couple-consistency.ts`): ①내 배우자궁 안정도가 기존 결혼운 결과(있다면)와 동일한 함수 산출인지, ②배우자성 서술에 혼인 신분어(남편·아내·시댁·처가)가 없을 것(§1-1 중립 표현 확정), ③판정 단계와 축 합계의 단조성. `marriage-consistency.ts`(17줄) 패턴 미러.

### 3-2. `child-path.ts` [제안]

- 아이 층: facts-core의 가중 십성으로 `주도결`(식상/재성/인성/관인/비겁 중 최댓값+격차), `조직-독립 스펙트럼`(관인 vs 식재 가중 비율), `두각 시기`(대운 pillar의 십성이 주도결 그룹에 드는 구간 — career-facts deriveTiming:353 일반화). 아이가 미성년이면 세운 트리거는 표시 범위를 학업·진로 이벤트 연령대(초등 이후)로 클램프.
- 부모 층: 용신 상보 방향 + 일간 생극 방향을 "밀어주는 방식"(지켜봐주기/불 지펴주기/제동 걸어주기) 3형으로 결정론 매핑.
- **금지어 postprocess**: 직업 고유명사 리스트(의사·판사·연예인 등 확장 가능 배열) + 재물·결혼 프레임 어휘를 결정론 스크럽. `report-scrub.ts`·`qa-regen.ts`(가드 위반 시 1회 재생성) 기존 인프라 재사용.
- 격국 판정기(선택 Phase 6): 월지 정기 투간 기준 8정격 + 건록·양인 — `lib/dict/data/gyeokguk/*` 10엔트리와 교차 검증 + 전수 감사(`TZ=UTC npx tsx scripts/audit-gyeokguk.mts`, v20의 518,400 원국 전수 선례). **판정기 검증 통과 전에는 격국명 금지를 유지**하므로 상품 2 출시가 격국에 블로킹되지 않는다.

### 3-3. `lib/past-karma.ts` [제안] (pair 엔진 밖 — 1인 모듈)

- **유형 판정**: `공망 위치(4종+없음) × 결핍오행(6종: 목화토금수·없음) × 원진 유무 × 대표 신살` 의 결정론 매핑. 전 칸이 채워진 테이블이어야 하며(빈칸 = LLM이 지어내는 자리), 같은 원국은 항상 같은 유형.
- **금지어 postprocess가 이 상품의 핵심 가드다.** 전생 신분·직업·시대·국가·성별·구체적 사건은 결정론 스크럽. 예: "왕이었다", "조선시대", "스님이었다", "누군가를 배신했다" 류. `report-scrub.ts`·`qa-regen.ts`(가드 위반 시 1회 재생성) 재사용.
- 허용되는 표현은 **원국 사실의 은유**까지다 — "원래 네 몫이 아니었던 자리"(공망), "평생 목마른 것"(결핍오행), "이유 없이 꼬이는 사이"(원진). 이 경계를 프롬프트와 테스트 양쪽에 명문화한다.
- 유형·과제·패턴은 `full_json`에 서버 확정값으로 저장, LLM은 서술만. postprocess는 **fabrication만 자르고 문체는 건드리지 않는다**(재미 보존 원칙, §7).

---

## 4. DB · API · 화면

### 4-1. DB [제안] — marriage 미러 + 2인 스냅샷

`supabase/migrations/2026MMDD_couple_results.sql` (child 동일 골격 / **past는 2인 스냅샷 컬럼이 없는 1인 골격 — 결혼운 테이블을 그대로 미러**):

- `couple_results`: `marriage_results`(`supabase/migrations/20260718_marriage_results.sql`) 골격 + **B(상대) 입력 스냅샷 컬럼**(`partner_name, partner_birth_date, partner_birth_time, partner_calendar_type, partner_gender, partner_region, partner_unknown_birth_time`) + `pair_facts_json jsonb`(결정론 사실 스냅샷 — 화면이 이것만 그린다) + `verdict text`(couple 5단계) / child는 `path_axis, org_vs_indep, peak_daeun` 결정론 컬럼. `teaser_json`/`full_json`/`guest_token_hash` 관례 유지.
- `couple_result_unlocks`: `marriage_result_unlocks` 완전 미러(unique(user_id, input_hash), unique(order_id)).
- `input_hash` = 기존 `buildInputHash(A입력)` + B입력 정규화 직렬화의 결합 해시. **A·B 순서는 "요청자=A" 고정**이라 순서 정규화 불요(past는 1인이라 해당 없음 — 기존 `buildInputHash` 그대로).
- 배틀 선례(`20260226_saju_battles_consolidated.sql`: `full_result JSONB` 단일 컬럼 + guest 컬럼 + `battle_owner_check`)와 달리 **결과·언락 분리형(marriage형)을 따른다** — teaser 무료/analyze 과금 구조와 orphan-환불 멱등 로직이 언락 테이블을 전제하기 때문.

### 4-2. API [제안] — marriage 3라우트 미러

상품마다 `app/api/{slug}/`:

- `start/route.ts` — 무료 teaser: 두 원국 계산 → `derivePairFacts` → 등급/판정 결정론 확정 → `{slug}_results` upsert. rate limit(`lib/server/rateLimit`) 적용(2인 계산이라 1인 teaser보다 비용 큼).
- `analyze/route.ts` — 과금: `app/api/marriage/analyze/route.ts`의 검증된 순서를 그대로 이식 — 멱등 체크 → orphan 3분 유예 409(61행 `ORPHAN_GRACE_MS`) → 멱등 환불 헬퍼(66-100행 "unlock 삭제 = 원자적 승자") → **결제 전 판정 게이트**(230-266행 미러: teaser 저장 판정 ≠ 현재 재계산 판정이면 409 — 그 사이 대표사주 재분석으로 원국이 바뀐 경우 잘못된 판정으로 과금 금지) → `spend_coins`(20알) → unlock insert(23505 = loser 환불, 311행 패턴) → consistency → `generateWithQaRegen`(Gemini + 가드 재생성, 441-452행) → 저장 → 실패 시 refund+cleanup. **에러 응답은 일반 한국어만, `error.message` 노출 금지**(CLAUDE.md:72).
- `results/[id]/route.ts` — 조회(소유 스코프).

### 4-3. 화면 [제안]

- `app/{slug}/{page,input,result,teaser}` — marriage 디렉터리 구성(`app/marriage/`: page, input, result, teaser, self, MarriageEntryClient) 미러. `self` 대응은 pair에선 기본 경로가 이미 직접입력이라 불요.
- 2인 입력 UX: `store/useBattleStore.ts:5-57`의 검증된 패턴(A는 "기존 사주 재사용/새 입력" 토글 `playerAMode`, B는 풀 입력) 재사용 — `store/usePairStore.ts` 신설, `BattlePlayerInput` 타입 미러(`types/battle.ts`).
- **표시 계층 사주 계산 금지**: 화면은 `full_json` + `pair_facts_json` 스냅샷만 그린다. `.eslintrc.json:24-43` `no-restricted-imports`가 빌드에서 강제 — pair 표시 헬퍼가 필요하면 허용 목록에 **표시 전용 이름만** 추가.
- 공유: `lib/share-{slug}.ts`(share-marriage 미러) + `app/api/og` 동적 카드. past는 업연 유형 카드(유형 일러스트 + 유형명)가 바이럴 코어이며, 1인 상품이라 상대 생년월일 없이도 공유가 성립한다(§5-3).

### 4-4. 진입·가격 단일 출처 반영

- `lib/constants/coins.ts`: `COUPLE_COST = 20; DUO_COST = 20; CHILD_COST = 20;`
- `components/hub/services.ts:8` `HubServiceId`에 3종 추가 + `HUB_SERVICE_THUMB` 포스터, `components/hub/useServiceActions.ts` 라우팅, `components/hub/ServiceRail.tsx` 카드, `app/menu/page.tsx` 행 추가.

---

## 5. 미결 3건 권고

### 5-1. 배틀과의 계층 분리 — **권고: 흡수하지 않는다(지금은). 톤·메뉴·연결로 가른다.**

- **[확인] 사실관계**: 배틀은 20알·2인·누적 255/최근 62 — 현역 매출원. 산출은 "승부"(`overall_winner`, `compareBattle`)이고 관계 사실은 battle-interaction 4계산이 프롬프트 재료로만 쓰인다.
- **권고 근거**: ①배틀 파이프라인(1064줄 battle-prompt + 시뮬레이션 + 멱등)을 신규 엔진 위로 옮기는 것은 "사이드이펙트 광범위 리팩토링"에 해당하고 얻는 것은 코드 중복 제거뿐, 매출 리스크가 비대칭적으로 크다. ②톤 분리는 산출 프레임이 이미 가른다: **배틀=승부(누가 강한가), couple=판정(같이 가도 되는가)** — 같은 질문이 아니다.
- **★3번 상품이 「내 전생」(1인·10알)으로 바뀌면서 카니발라이제이션 우려는 크게 줄었다.** 원래 걱정은 duo(2인·20알·재미)가 배틀(2인·20알·재미)과 정면으로 겹치는 것이었는데, past는 혼자 보는 상품이라 배틀과 시장이 겹치지 않는다.
- **★메뉴 이원화는 폐기 — 운영자 확정 (2026-08-31): `/menu` 구조는 건드리지 않고 홈(`app/page.tsx`)에 신상품 섹션을 하나 더 판다.** 초안은 메뉴를 "혼자 보는 것/둘이 보는 것"으로 가르자는 안이었으나, 기존 메뉴를 재편하면 이미 팔리는 상품들의 진입 동선까지 흔들린다. 홈에 섹션을 추가하는 쪽이 **기존 동선 무손실 + 신상품 노출 확보**를 동시에 얻는다. 섹션 구성은 §5-3 ⑥ 참조.
- **엔진 관계**: Phase 7(선택)에서 `battle-interaction.ts` 내부만 pair 엔진 호출로 교체하되 **출력 골든 동등성 테스트**(기존 N케이스 스냅샷 일치)를 통과할 때만 머지. 배틀의 즉석 재계산 특성(grandfather 미적용, CLAUDE.md:109)이라 결과 불변이 검증되면 안전.

### 5-2. ~~duo 동물 조합 이미지 제작비~~ → **폐기. 대체 미결: past 업연 유형 수와 이미지**

동물 조합 상품이 「내 전생」으로 교체되면서 N² 이미지 병목 문제 자체가 사라졌다(1인 상품이라 조합이 없다). 대신 새 미결이 생긴다.

- **업연 유형 수 [제안]: 12종.** 근거: ①공망 위치(년·월·시·없음 4) × 결핍오행 유무를 축으로 삼으면 자연스러운 자릿수가 10~12이고, ②12는 "12유형 중 #7" 같은 표기가 밈으로 돌기 좋은 크기이며(MBTI 16, 띠 12의 학습된 친숙함), ③유형당 실사용자 분포가 3,341명 기준 평균 278명이라 유형별 서술을 다르게 쓸 가치가 있다. 유형 수는 **분포 감사로 확정**한다 — 전수 시뮬에서 한 유형이 30%를 넘거나 1%를 밑돌면 축을 재설계한다(Phase 4 완료 조건).
- **이미지 [제안]: 유형당 1장 = 12장.** 조합이 없으므로 완전 선형이다. 제작은 `lib/pet-compat-illustration.ts:86-118`의 픽사풍 스타일 락 프롬프트 + `gemini-2.5-flash-image` 호출부를 **1회성 배치 스크립트**(`scripts/generate-past-types.mts`)로 재사용해 후보 다수 생성 → 사람이 12장 큐레이션 → 정적 자산 커밋(`public/images/past/`). 런타임 생성은 기각 — 지연·실패모드에 더해 **비결정론**(같은 유형이 사람마다 다른 그림)이라 유형 정체성이 안 선다.
- **[미결] 두루미 캐릭터를 쓸지**: 기존 브랜드 캐릭터(`public/durumi-character.png`)를 전생 유형 일러스트에 섞으면 세계관은 이어지지만 12유형의 시각적 구분이 약해진다. 운영자 판단 필요.

### 5-3. 진입동선 — **권고: "결혼운 결과 업셀"을 1순위 동선으로, 펫의 실패 원인 4가지를 역설계.**

**펫궁합 1건의 원인 (코드 실측)**:
1. **결제 선행, 무료 미리보기 없음**: `app/api/pet-compat/analyze/route.ts:6` 흐름 주석 — `/pet/input → /checkout?type=pet → 알 차감 → analyze`. 돈을 내기 전까지 아무 산출물이 없다. 대조: 결혼운은 무료 teaser 선행(`app/api/marriage/start/route.ts:1-4`)이고 **결과 생성 207 → 언락 175(누적 84.5%)**, 최근 30일로는 145 → 122(84.1%). 티저를 먼저 보여주고 잠그는 구조가 실제로 전환된다.
2. **노출 부재**: 히어로 캐러셀은 사주·배틀·올해 3종뿐(`components/hub/services.ts:17-21`), 펫은 레일 4번째 카드와 메뉴 행(`app/menu/page.tsx:217`), `my/results` 업셀 카드(1400행)가 전부.
3. **크로스링크 0**: 결과 화면 간 연결 실측 — marriage 결과→배틀(MarriageResultClient.tsx:490,549), wealth 결과→yearly(WealthResultClient.tsx:493,559)는 있는데 **펫으로 가는 링크는 결과 화면 어디에도 없다**. stories CTA는 전부 `/menu`로 통일(docs/STORIES_CHECKLIST.md "CTA 라우팅 일치")이라 매거진→펫 직행도 없다.
4. 타깃 협소(반려인만) + 입력 마찰(펫 생일 티어 + 사진 업로드).

**신규 3종 동선 설계 [제안]** (메뉴 배치는 기본값일 뿐, 아래가 본체):
- **① 결혼운 결과 → couple 업셀 (최우선)**: 결혼운 언락자 122명(심층 3종 중 커리어+재물 합 82보다 많음)은 "상대와의 결혼"이 궁금한 최고 구매의도 세그먼트. `MarriageResultClient` 결과 하단 + `timingFlow` 블록 직후에 "네 쪽은 봤다. **상대 사주까지 넣으면** 이 판정이 어떻게 달라지는지 볼 수 있어" 카드. 기존 결혼운 입력을 A로 자동 프리필(대표사주 재사용 경로).
- **② 배틀 결과 → couple**: `relationship_type`이 이미 저장돼 있으므로(`saju_battles.relationship_type`) lover인 경우에 한해 couple 카드를 띄운다(그 외 관계는 억지 업셀이 되므로 노출하지 않는다). 배틀 30일 62건이 그대로 상단 퍼널.
- **③ past 공유 카드 = 자가 증식 루프 (가장 강한 동선)**: 카카오 공유(`lib/kakao-share.ts`·share-reward 인프라)로 받은 사람이 "넌 전생에 뭐였을까?"로 바로 진입한다. **상대 생년월일이 필요 없어 pair 상품보다 마찰이 낮다** — past를 먼저 내자는 안 B(§출시 순서)의 핵심 근거. 공유 보상 알 정책은 기존 `share-reward-kinds.ts` 확장.
- **④ dict 딥링크**: `/dict/relation/*` 35개 엔트리(합·충·형·해 등)는 "두 사람 관계" 검색 유입 그 자체 — 각 엔트리 하단에 "내 사주와 그 사람 사주에 이 합이 실제로 있는지 확인" → couple CTA(관계) / past CTA(공망·원진 등 1인 엔트리). STORIES_CHECKLIST의 `/menu` 통일 원칙과 충돌하므로, **relation 카테고리에 한해 예외를 명시 개정**(관계 엔트리에서 개인 사주 CTA는 오배정)하는 결정을 Phase 3 완료 조건에 포함.
- **⑤ stories 신규 2편**(궁합 보는 법/원진 커플 실제 사례)을 STORY_WRITING_GUIDE 기준으로 발행, ctaAfter를 자기진단 모먼트 뒤에 배치.
- **⑥ ★홈에 신상품 섹션 신설 (운영자 확정 2026-08-31)**: `/menu` 구조는 건드리지 않는다. 홈(`app/page.tsx:70-72`)의 현재 순서는 `HubHeroCarousel → ServiceRail → CelebrityRail → DictList → MagazineList → HubFaq` 이고, 여기에 **신상품 전용 섹션 컴포넌트를 하나 추가**한다.
  - 위치 [제안]: `ServiceRail` **바로 아래**. 히어로는 대표 3종의 자리라 건드리지 않고, 기존 서비스 레일을 본 직후가 "새로 나온 것" 인지가 가장 잘 되는 자리다. `CelebrityRail` 아래로 내리면 스크롤 깊이에 묻힌다.
  - 컴포넌트 [제안]: `components/hub/NewServiceSection.tsx` — `ServiceRail`의 카드 마크업·`HUB_PRESS` 인터랙션을 재사용하되 섹션 헤더("새로 나온 검사" 등)를 갖는다. 신상품이 하나뿐일 때도 섹션이 어색하지 않아야 한다(couple 단독 출시가 첫 상태).
  - 수명 [제안]: "새로 나온"이라는 라벨은 시간이 지나면 거짓말이 된다. past·child가 다 나오고 신선도가 떨어지면 섹션을 접고 `ServiceRail`에 합류시킬지 판단하는 시점을 정해 둘 것(기본 제안: 3종 전부 출시 + 마지막 출시 후 8주).
  - 기존 `components/hub/services.ts` 등록은 그대로 한다(메뉴·라우팅·가격 단일 출처이므로).
- **⑦ teaser 무료 원칙 고정**: 3종 모두 판정 헤드라인 일부를 무료 티저로 보여주고 잠근다(펫 실패의 직접 교훈).

---

## 6. 단계별 구현 계획

각 Phase는 완료 판정(Definition of Done)과 검증 방법을 갖는다. 모든 감사·테스트는 `TZ=UTC` 필수(CLAUDE.md:67), 모든 UI Phase는 `npx next build` 성공이 완료 조건(eslint no-restricted-imports가 빌드 게이트).

**Phase 0 — 관계 명리 정본 확장** (엔진 기반 공사) — ✅ **완료 (2026-08-31, 커밋 136a6a8·bf78d6e·104ec11)**

> 완료 시 실측 기록:
> - `lib/pair/relation-tables.ts` 신설. 육합·삼합(반합)·방합(반방합)·동일·충·형(자형)·해·원진·귀문 **9종을 전부** 배열로 반환. 신설 테이블은 육해·귀문 둘뿐이고 나머지는 `saju-enrichment` 정본을 import.
> - ★설계 근거로 드러난 것: 기존 `getPairRelation`은 우선순위(합>충>형>원진>삼합>방합>동일) 때문에 **巳申에서 형을 통째로 버린다**(육합+삼형이 겹치는 형합 자리). 丑未(충+형)·子丑(육합+방합)·寅巳(해+형)·丑午(해+원진+귀문)도 같은 손실을 겪는다. 다중 반환이 정확도와 직결되는 실증.
> - ★삼합·방합 반합은 기존 `getPairRelation`의 "그룹 안 두 글자면 성립"을 그대로 따랐다. 왕지(子午卯酉) 포함을 요구하는 학파가 있으나 여기서 바꾸면 같은 사실이 두 모듈에서 갈린다 — **미결로 남긴 학파 선택**이며 바꾸려면 사전·기존 상품과 함께 바꿔야 한다.
> - `lib/facts-core.ts` 신설. **couple이 실제로 쓰는 `bareStar`·`tenStarOf`·`PILLARS`만** 뽑았다. 가중 십성 모델은 child가 소비할 때 옮긴다(소비자 없는 코드 금지). 기존 marriage/wealth/career-facts는 한 줄도 안 바꿨다.
> - 검증: 신규 **19개**(relation-tables 13 + facts-core 6) + 전체 **431개 통과**, lint 에러 0, `npx next build` 성공.
> - 잠금 테스트: 78쌍 전수 종류별 개수(육합6·삼합12·방합12·동일12·충6·형11·해6·원진6·귀문6) / 인자 순서 대칭성 78쌍 / 사전 정합 3종(육해↔`relation` -hae 6엔트리의 **슬러그 + name·hanja 값**, 귀문↔`sinsal/gwimun` highlight "조합"). ★슬러그만 대조하면 卯辰을 卯巳로 잘못 적어도 통과하므로 값까지 잠갔다 / facts-core↔`calculateTenStarsFull` 천간 100조합 전수 대조.
> - ⚠️ 계약 테스트의 한계: 레거시 3파일의 헬퍼는 module-private라 **직접 대조가 불가능**하다. 대신 엔진 본체(`calculateTenStarsFull`)와 대조했다. 레거시가 엔진과 갈라지는 경우는 이 테스트가 못 잡는다.
- 작업: `lib/pair/relation-tables.ts`(해 6조·귀문 테이블 신설, 천간충 정본화, 파 제외 결정 반영), `lib/facts-core.ts` 추출, `package.json` 테스트 글롭 확장.
- 완료 판정: 지지 66쌍 전수 관계 스냅샷 테스트 통과, 사전 정합 테스트(육해·귀문 ↔ `lib/dict/data/relation/*-hae.ts`·`sinsal/gwimun.ts`) 통과, facts-core 계약 테스트(골든 입력에서 레거시 3파일 산출과 일치) 통과.
- 검증: `TZ=UTC npm test` (lib/pair/relation-tables.test.ts, lib/facts-core.test.ts), `npx next build`.

**Phase 1 — pair-facts 엔진 (couple 필요 범위)** — ✅ **완료 (2026-08-31, 커밋 832ff5c·4c4f683·b75dd1c·02f2f92·f4aee8f)**

> 완료 기록:
> - `lib/pair/pair-facts.ts` — `derivePairFacts(a, b, { currentYear, sexA, sexB, timingA, timingB })`. 산출: `reliability`(시주 미상 중화) / `dayStemRelation` / `yongshinCompat`(summary 제외) / `elementCoverage` / `branchMatrix`(궁위 보존) / `tenStarExchange`(양방향) / `spouseStarCross`(분기 없음) / `fortuneCross.timingOverlapYears`(isPast 제외) / `shinsalCross`.
> - `lib/utils/battle-interaction.ts` — 순수 3계산에 `export` 추가(로직 diff 0). `calcFortuneSync` 는 `new Date()` 의존이라 export 하지 않음. **최초의 동작 테스트 15개**를 붙이기 전에 먼저 깔았다.
> - 검증: 전체 **470개 통과**, eslint 0, `npx next build` 성공, `grep displayGrade|COMPOSITE_GRADE_CUTOFFS lib/pair` **0건**(§1-0 준수).
> - **역검증(일부러 깨뜨려 이름까지 확인)**: summary 재탑재→프로즈 차단 테스트 실패 / `currentYear`→`new Date()` 변경→결정론 테스트 실패 / `isPast` 필터 제거→타이밍 테스트 실패 / 배우자성이 상대 성별을 쓰게→이성커플+144전수 실패 / 매트릭스 궁위 평탄화→궁위 3종+144전수 실패. 배틀 쪽도 천간표 변조→4개(자사 계약 테스트 2 포함), 결핍 임계 변조→경계 테스트.
> - ⚠️ **역검증에서 내 안전망 구멍이 하나 나왔다**: 배틀 특성화 테스트의 픽스처에 오행 개수 1(경계값)이 없어서 결핍 임계를 `va===0`→`va<=1` 로 바꿔도 안 잡혔다. 경계 픽스처를 추가해 메웠다.
> - ⚠️ 테스트 기대값이 틀린 경우가 하나 있었다: "A만 시주 미상이면 시주 칸이 하나도 없어야 한다"는 과도한 절삭이었다(B의 시지는 멀쩡히 알고 있으므로 정당한 비교다). 구현이 아니라 기대값을 고쳤다.
> - **남은 것**: `pair-input.ts`(두 사람 입력 → 두 원국 계산 번들)는 Phase 2 에서 API 라우트와 함께 붙인다 — 지금 만들면 소비자가 없다.

<details>
<summary>초안(이관+골든+MC)을 왜 버렸는지 — 코드 근거 6건</summary>

> **왜 초안을 버렸나 (전부 코드로 확인)**
> - **[확인] 이관은 우리가 없애려던 클론 그 자체였다.** 계산 4종 중 3종(`calcYongshinCompat:60`·`calcDayStemRelation:90`·`calcElementCoverage:126`)은 `EnrichedSajuData` 둘만 받는 순수 함수다. 밖에서 못 부르는 이유는 배틀 전용 의미론이 아니라 **`export` 키워드가 없어서**일 뿐이다. 복사하지 말고 export 를 붙여 그대로 쓰면 정본이 한 벌로 유지되고, "대량 스냅샷 → 골든 100% → 롤백" 의식 전체가 불필요해진다(그 의식은 복사했기 때문에 생기는 비용이었다). Phase 0의 "정본 import, 복사 금지"와도 이제 일관된다.
> - **[확인] 이관 대상이 비결정론이다.** `battle-interaction.ts:161` 이 `new Date().getFullYear()` 를 읽고, `saju-fortune.ts:177` 의 세운 윈도우도 wall-clock 기준이다. 그대로 쓰면 초안의 완료 판정 ①"결정론"이 **정의상 성립할 수 없다**. 더 심각한 건 결제다 — couple 은 marriage analyze 의 "결제 전 판정 게이트"를 미러하므로, 12/31 teaser → 1/1 analyze 면 해가 바뀌며 판정이 밀려 **정당한 결제가 409로 튕긴다**. 배틀은 즉석 재계산이라 이 문제가 없었을 뿐이다. → `currentYear` 를 인자로 주입하고 `pair_facts_json` 에 저장, 게이트 재계산도 저장된 연도로 한다. 선례: `deriveTiming(…, currentYear)` (`marriage-facts.ts:283`).
> - **[확인] MC 발화율은 정보량이 0이고 이론값도 틀렸다.** 잡으려던 것(테이블 정확성)은 Phase 0 의 78쌍 전수 카운트가 **이미 완전히** 잠갔다. 게다가 초안의 "육합 ≈ 6/66"은 한 원국 안에서 두 글자를 뽑는 모델이라 두 사람에는 안 맞는다 — 서로 독립이므로 순서쌍 12×12=144, 육합은 **12/144 ≈ 8.33%**이고 66-모델은 동일 지지 쌍을 아예 배제한다. 만세력 랜덤 원국은 년지가 출생연도에 종속돼 어떤 균일 이론값과도 어긋난다. → **삭제.** 배관 검증은 **144 순서쌍 전수**(만세력 불필요)와 절입 경계 골든이 정확히 잡는다. 현실 생년 분포 MC 는 Phase 2 판정 경계 확정의 도구이지 여기가 아니다.
> - **[확인] `summary` 는 배틀 전용 프로즈다.** `battle-interaction.ts:73·77·118` 이 "A가 B의 용신(금)을 채워주지만…", "기신을 자극하는 조합" 처럼 **용신·기신 라벨과 A/B 표기**를 문자열에 박는다. §1-0 확정(용신·기신 용어 미노출)과 충돌하므로 PairFacts 는 **구조 필드만** 소비하고 summary 는 배틀 표현 계층에 남긴다.
> - **[확인] `battle-interaction` 에는 동작 테스트가 0개다**(`battle-interaction.test.ts` 부재. 존재하는 건 천간표 상수를 소스 파싱으로 비교하는 계약 테스트뿐 — `saju-facts-engine.test.ts`). export 한 단어를 붙이는 diff 라도 **회귀 테스트를 먼저 깔고** 만진다.
> - **[확인] 천간표는 이미 두 벌이다** — `battle-interaction.ts:6` 과 `yearly-interaction.ts:15` 의 `CHEONGAN_HAP`. 소스 파싱 계약 테스트가 이 둘만 감시한다. §2-1 이 약속한 "천간충 정본화"를 Phase 0 이 하지 않았으므로(지지만 했다) 여기서 회수한다 — 세 번째 사본을 만들지 않는 것이 최소 조건이다.
> - **[확인] 시주 미상 degradation 이 절반만 정의돼 있었다.** 초안은 "4×4 → 3×3"만 말했는데, `calcElementCoverage:126` 은 `va === 0` 으로 결핍을 판정하므로 6글자 원국은 결핍이 구조적으로 더 뜨고 → 상대가 "채워준다"는 **가짜 양(+) 신호**가 커진다. 못 본 축이 "관계 없음"이 아니라 "상보 있음"으로 조작되는 방향이라, 지키려던 원칙을 정확히 배반한다. elementCoverage·용신 축의 중화 정의를 함께 넣는다.

</details>

**1-1. PairFacts 인터페이스 + 입력 정규화** (degradation·결정론을 처음부터)
- 작업: `pair-input.ts` + PairFacts 타입 확정. `currentYear` 명시 인자, `reliability.neutralizedAxes` 에 지지 매트릭스 + elementCoverage + 용신 축의 시주 미상 의미론 포함, 요약 카운트를 궁위 보존형으로(평탄 카운트가 판정 입력이 되면 년↔시 원진과 월↔월 원진이 같은 1이 된다).
- 완료 판정: 시주 미상 A/B/양쪽 3케이스의 축별 산출·중화가 테스트로 명세됨.
- 검증: `TZ=UTC npm test` (lib/pair/pair-facts.test.ts).

**1-2. battle-interaction 연결 (import — 이관 아님)**
- 작업: ①먼저 `battle-interaction` 최초의 동작 테스트를 깐다. ②순수 3계산에 `export` 추가(동작 무변경). ③`calcFortuneSync` 만은 주입 연도를 받는 소형 재작성(골든 동등성이 성립할 수 없는 함수다). ④천간표 정본 위치를 정하고 파싱 계약 테스트를 확장해 3벌 드리프트 차단. ⑤summary 는 소비하지 않고 구조 필드만 매핑.
- 완료 판정: 순수 3계산 diff = `export` 키워드뿐. fortuneSync 는 "동일 연도 주입 시 기존과 동일" 단위 테스트 통과. **기존 배틀 관련 테스트 전량 통과.**
- 검증: `TZ=UTC npm test`, `npx next build`.

**1-3. 신설 축 TDD** — 지지 4×4 매트릭스 / 십성 교차(양방향) / 배우자성 교차(분기 없이 무조건 양방향) / 신살 교차 / 타이밍 교차
- 타이밍 교차는 **`isPast` 필터 필수** — `timingWindows` 는 `currentYear − 1` 부터 담기므로(`marriage-facts.ts:300`) 단순 교집합이면 작년이 "둘 다 열리는 해"로 나간다.
- 신살 교차 재료는 enrichment 에 존재(도화·천을·홍염).
- 완료 판정: 축별 골든 + 절입 경계 원국쌍 골든 통과. 검증: `TZ=UTC npm test`.

**1-4. 전수 검증 잠금**
- ①결정론: 연도 고정 스냅샷(주입 후에야 성립한다), ②**144 순서쌍 전수** 대칭 프로퍼티(방향 필드 미러 외 동일), ③MC 발화율 삭제 — Phase 2 경계 캘리브레이션으로 이동.
- 완료 판정 + 검증: `TZ=UTC npm test` 전량, `npx next build`, `grep -rn "displayGrade\|COMPOSITE_GRADE_CUTOFFS" lib/pair` 0건.

**Phase 2 — 상품 1 couple 전체 파이프라인**
- 작업: `couple-decision.ts`(+판정 경계 확정), `couple-{prompt,consistency,postprocess,grade}.ts`, 마이그레이션, `/api/couple/{start,analyze,results}`, `app/couple/*`, `usePairStore`, coins·services·menu 반영, share-couple.
- 완료 판정: ①판정 경계가 MC 분포 실측으로 확정·문서화(5단계 분포가 특정 단계 >50% 쏠림 없음), ②결제 멱등 시나리오 테스트(중복 요청 loser 환불·orphan 유예·환불 1회 불변식 — marriage 패턴 케이스 이식), ③내 쪽 축이 기존 결혼운과 동일 함수 산출임이 consistency 테스트로 강제, ④teaser 무료·analyze 20알 차감 e2e 확인, ⑤`npx next build` 성공.
- 검증: `TZ=UTC npm test`(couple-* 5개 테스트 파일), `TZ=UTC npx tsx scripts/couple-report-probe.mts`(신설 — `scripts/career-report-probe.ts` 미러: 실 프롬프트→Gemini→가드 통과 리포트 N건 생성·수동 검수), 스테이징 결제 1건 실사.

**Phase 3 — 진입동선 (couple 출시와 동시)**
- 작업: §5-3의 ①②④⑥⑦ (결혼운 결과 업셀, 배틀 결과 분기 카드, dict relation CTA 예외 개정, 히어로 슬라이드, 티저 노출), analytics 이벤트(`lib/analytics.ts`)에 유입 소스 파라미터.
- 완료 판정: 각 동선에서 couple input까지 클릭 도달이 실기기에서 확인되고, 유입 소스별 이벤트가 기록됨. STORIES_CHECKLIST 개정 커밋 포함.
- 검증: `npx next build`, 수동 QA 체크리스트(동선 7경로), 출시 2주 후 소스별 teaser 생성 수 리뷰(펫의 "만들고 0건" 재발 감시 지표).

**Phase 4 — 상품 3 past (내 전생, 1인·10알)**

★**이 Phase는 Phase 0~1(pair 엔진)에 의존하지 않는다.** 재료가 전부 기존 1인 enrichment에 있으므로(§1-3 표) 언제든 독립 실행 가능하다 — 출시 순서를 앞당길 수 있는 유일한 상품이다(§ 출시 순서 참조).

- 작업: `lib/past-karma.ts`(업연 유형 결정론 테이블 + 이번 생 과제 + 반복 패턴), `past-{prompt,postprocess}.ts`(전생 창작 금지어 스크럽이 핵심), 일러스트 12장 배치 생성·큐레이션(`scripts/generate-past-types.mts`), past 파이프라인 일습(마이그레이션·API·화면·OG 카드·카카오 공유). **pair 엔진 미사용.**
- 완료 판정: ①유형 판정 전수 스냅샷 테스트(같은 원국 → 항상 같은 유형), ②**유형 분포 감사** — 실사용자 3,341명 전수 재현에서 한 유형 30% 초과 또는 1% 미만이 없을 것(초과 시 축 재설계), ③**전생 창작 가드** — probe N건에서 신분·직업·시대·국가·성별·구체 사건 등장 **0건**, ④결정론 값 외 명리 fabrication 0건, ⑤12장 자산 커밋 + OG 렌더 확인, ⑥`npx next build`.
- 검증: `TZ=UTC npm test`(past-karma.test.ts, past-postprocess.test.ts), `TZ=UTC npx tsx scripts/past-type-dist.mts`(유형 분포 전수), `TZ=UTC npx tsx scripts/past-report-probe.mts`(실 프롬프트→Gemini→가드 검수), OG 카드 스크린샷 검수.

**Phase 5 — 상품 2 child**
- 작업: `child-path.ts`(가중 십성 3축+조직/독립+두각 시기), 금지어 postprocess, child 파이프라인 일습. 커리어운 결과 → child 업셀("내 커리어는 봤고, 아이는?") 크로스링크.
- 완료 판정: ①금지어 가드 테스트(직업 고유명사·재물·결혼 프레임 스크럽 0누락 — probe N건), ②주도결 판정 MC 분포(5그룹 쏠림 없음), ③두각 시기 산출이 대운 실측과 일치(골든 케이스), ④`npx next build`.
- 검증: `TZ=UTC npm test`(child-path.test.ts 등), `TZ=UTC npx tsx scripts/child-report-probe.mts`.

**Phase 6 (선택) — 격국 판정기**
- 작업: 월지 정기 투간 기준 판정기 + `dict/data/gyeokguk` 교차 검증 + 전수 감사. 통과 시에만 child 프롬프트에서 격국명 금지 해제(analysis.ts:1990 본체 금지는 유지 — 개인사주는 무관).
- 완료 판정: 전수 감사에서 사전 정의와 모순 0건, 판정 불가 케이스의 명시적 null 처리.
- 검증: `TZ=UTC npx tsx scripts/audit-gyeokguk.mts`(신설).

**Phase 7 (선택) — 배틀 interaction 통합**
- 작업: `battle-interaction.ts` 내부를 pair 엔진 호출로 교체.
- 완료 판정: 기존 산출 골든 동등성 테스트 100% 일치(불일치 1건이라도 있으면 롤백 — 배틀은 즉석 재계산이라 사용자 결과가 즉시 바뀐다).
- 검증: `TZ=UTC npm test`, 실 배틀 재생성 3건 전후 비교.

### 출시 순서 — **★3번이 1인 상품으로 바뀌면서 재검토 필요 (운영자 결정)**

원래 권고는 `couple → duo → child` 였다. duo가 pair 엔진을 필요로 했기 때문에 엔진 공사(Phase 0~1)가 무조건 선행이었다.

**past는 pair 엔진이 필요 없다.** 그래서 선택지가 둘로 갈린다.

- **안 A — `couple → past → child`** (기존 순서 유지)
  근거: 결혼운 30일 언락 122 vs 커리어+재물 82로 관계 수요가 확실히 앞선다. 매출 기대가 가장 큰 것부터 낸다.
  대가: 첫 출시까지 Phase 0~1(관계 명리 정본 확장 + pair 엔진)을 다 지어야 해서 가장 오래 걸린다.

- **안 B — `past → couple → child`** (전생 먼저)
  근거: past는 기존 엔진만으로 만들 수 있어 **엔진 공사 없이 바로 출시 가능**하다. 1인 상품이라 상대 생년월일이 필요 없어 진입 마찰이 가장 낮고, 공유 카드가 카톡으로 가장 잘 돈다 — 즉 **couple이 나올 때쯤 유입을 미리 데워 놓는 상단 퍼널**이 된다. 펫이 1건에 그친 원인이 동선 부재였으니(§5-3), 동선을 만들어 줄 상품을 먼저 내는 것이 그 실패에 대한 직접적인 대응이다.
  대가: 10알 상품이라 건당 매출이 절반이고, 관계 수요라는 검증된 시장을 뒤로 미룬다.

**★운영자 확정 (2026-08-31): 안 A — `couple → past → child`. "결혼부터, 제대로."**

문서 초안의 권고는 안 B(past 먼저)였다. 개발이 싸고 빠르다는 이유였다. 운영자는 안 A를 택했고, 그 판단의 근거는 이렇게 읽는다 — **검증된 수요(결혼운 30일 122건)를 먼저 먹고, 첫 상품의 완성도를 깎지 않는다.** past를 먼저 내면 첫인상이 10알짜리 재미 상품이 되고, 뒤에 나올 couple의 "결혼운보다 정확한 20알 심층"이라는 포지션이 흐려질 수 있다.

**따라서 이 결정의 실무적 함의**:
1. **Phase 0~2를 건너뛸 수 없다.** 관계 명리 정본 확장(해·귀문 신설) → pair 엔진 → couple 파이프라인을 순서대로 다 짓는다. 첫 출시까지의 시간을 줄이려고 엔진을 얇게 가는 선택은 이 결정과 모순된다.
2. **"제대로"의 구체적 기준은 각 Phase의 완료 판정(§6)이다.** 특히 Phase 1의 대칭성·골든 동등성·MC 발화율 4종과 Phase 2의 판정 경계 실측 확정은 **통과 못 하면 출시하지 않는다**. 경계값을 감으로 정하고 넘어가는 것이 "제대로"의 반대다.
3. **Phase 3(진입동선)은 Phase 2와 같은 배포에 묶는다.** 펫이 1건에 그친 원인이 동선 부재였고(§5-3), 안 A는 past라는 바이럴 상단 퍼널 없이 출시하므로 동선을 뒤로 미룰 여유가 더 없다.

past는 2번째, child는 마지막이다 — child는 신규 세그먼트(부모) 개척이고 격국 기반 공사(Phase 6)가 얽혀 있다.

**Phase 실행 순서(확정)**: 0 → 1 → 2 + 3(동시 출시) → 4(past) → 5(child) → 6·7(선택)

---

## 7. 리스크 · 회귀 감시

| 리스크 | 감시/방어 |
|---|---|
| 기존 등급 산식 오염 | **신상품은 `SCORING_VERSION`·composite·`COMPOSITE_GRADE_CUTOFFS`를 읽기만 하고 쓰지 않는다.** couple 판정·past 유형은 독립 스케일. 회귀 감시: `saju-scoring.ts` diff 0, 기존 테스트 전량 통과 |
| grandfather | 신규 테이블만 추가하므로 기존 결제자 재계산 지점 없음. 단 couple이 대표사주를 A로 재사용할 때 **결제 전 판정 게이트**(marriage analyze 230-266행 미러)로 stale 판정 과금을 차단 |
| **산식 버전 드리프트로 두 화면이 다른 말** | 저장 결과의 98.4%가 구버전(v17 61.4%)인데 pair는 항상 최신으로 계산된다. **§1-0 결정으로 등급 노출을 차단**해 대조 표면을 없앤다. 회귀 감시: `app/{couple,past,child}` 에서 `displayGrade`·`COMPOSITE_GRADE_CUTOFFS` grep 0건 |
| TZ | 신설 스크립트 전부 `TZ=UTC npx tsx` 표기 강제. 절입 경계 원국쌍을 pair 골든 테스트에 포함(`lib/saju-solar-terms.golden.test.ts` 선례) |
| 표시 계층 계산 | pair 결과 화면은 `pair_facts_json`/`full_json` 스냅샷만. 회귀 감시: `npx next build`(eslint 게이트) + `TZ=UTC npx tsx scripts/audit-hour-pillar-display.mts` 0건 유지 |
| LLM fabrication | 3종 모두 "facts 블록 외 근거 금지" 규칙(marriage-prompt:124-134 승계) + `generateWithQaRegen` 재생성 루프 + 상품별 영구 금지어(child 직업명, couple 공포 신살 — marriage-prompt:127 선례) |
| 이중 과금/무한 환불 | marriage analyze의 "차감 1=리포트 1=환불 최대 1" 불변식 로직을 그대로 이식(자체 재발명 금지) + 멱등 시나리오 테스트 |
| 상대 사주 = 제3자 개인정보 | 배틀 선례(비회원 guest token, 소유 스코프 조회 — battle analyze route 27-31행 주석)를 따르되, partner 스냅샷 컬럼은 이름·생일 최소 수집, 결과 조회는 요청자 소유 스코프 강제, `result_deletions` 삭제 경로(20260722 마이그레이션 선례)에 신규 3테이블 포함 |
| 기존 결혼운과의 모순 클레임 | couple의 "내 쪽" 축은 `deriveMarriageFacts` 동일 함수 호출로 값 자체가 같음 + consistency 테스트로 강제 |
| past 재미 훼손 | postprocess는 fabrication(전생 창작·근거 없는 명리)만 스크럽하고 문체·수위는 비개입임을 코드 주석과 테스트(원문 보존율)로 명문화. 유형 분포 감사(Phase 4 ②)가 "다들 같은 유형" 회귀를 감시 |
| 배틀 카니발라이제이션 | 출시 후 30일 배틀 언락 추이를 METRICS 루틴에 추가 — 배틀 감소분이 couple 증가분을 넘으면 메뉴 섹션·카피 재조정 |
| 만들고 0건(펫 재발) | Phase 3를 couple과 **동시 출시**로 묶고(별도 후속 아님), 유입 소스별 teaser 생성 이벤트를 출시일부터 계측 |

---

## 부록 A. 구현 시 먼저 열어볼 파일

- `lib/utils/battle-interaction.ts` — 이관할 기존 2원국 계산 4종의 원본
- `lib/utils/saju-enrichment.ts` — 지지 관계 정본 테이블·`getPairRelation`·`EnrichedSajuData`(엔진의 단일 진실원)
- `lib/marriage-facts.ts` — couple이 재사용할 1인 결혼 사실 엔진 + facts-core 추출 대상 헬퍼
- `app/api/marriage/analyze/route.ts` — 과금·멱등·환불·판정 게이트의 이식 원본
- `components/hub/services.ts` — 진입·가격 단일 출처(신상품 노출 지점)

## 부록 B. 이 계획의 근거가 된 실측 이용량 (언락 기준, 2026-08-31)

| 검사 | 누적 | 최근 30일 |
|---|---:|---:|
| 개인사주 | 3,297 | 400 |
| 올해 운세 | 436 | 56 |
| 사주 배틀 | 255 | 62 |
| 결혼운·애정운 | 175 | 122 |
| 커리어운 | 71 | 56 |
| 재물운 | 50 | 26 |
| 오늘의 운세 | 72 | 5 |
| 사주 배틀 ※ | 255 | 62 |
| 반려동물 궁합 ※ | 1 | 1 |

※ 배틀·펫은 언락 테이블이 없어 **결과 row 기준**이다(다른 행과 척도가 다르므로 직접 비교 시 주의).

심층 3종 중 결혼운이 커리어+재물 합보다 많다(30일 언락 122 vs 82) → 관계 수요 우위, couple 우선 출시의 근거. 펫궁합 1건 → §5-3 동선 설계의 근거.

참고로 **결과 row 기준** 수치는 따로다 — 개인사주 3,341/400 · 결혼운 207/145 · 재물운 62/35 · 커리어운 80/62. 언락과 결과 row를 섞어 나누면 전환율이 아니라 아무 의미 없는 숫자가 나온다.
