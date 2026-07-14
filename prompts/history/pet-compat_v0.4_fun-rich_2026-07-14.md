# 반려동물 궁합 프롬프트 v0.3 → v0.4 (재미 + 풍성)

날짜: 2026-07-14
대상: `lib/pet-compat.ts`(프롬프트) + `lib/pet-compat-scoring.ts`(pickLabelText) + `lib/pet-compat-postprocess.ts`(QA)
LLM: Gemini API (`gemini-2.5-flash`, temp 0.85)
계획서: `docs/superpowers/plans/2026-07-14-pet-content-fun-rich.md`
커밋: 24d00ad(T1 라벨) · 01ee3a7(T2~T5)

## 왜 바꿨나
Phase 2 레이아웃 리디자인 후 운영자 지적: (1) 타이틀 재미없음 — 라벨 밋밋 + 헤드라인에
"홍염살" 등 명리 용어가 박혀 안 읽히고 안 웃김. (2) 내용 부실해 보임(첫인상). 
추가 발견: S gap≤−25 라벨에 프롬프트 예시 이름 "쭈"가 하드코딩돼 모든 펫에 노출되던 버그.

## 무엇을 바꿨나 (v0.3 대비)
| # | 변경 |
|---|---|
| T1 | pickLabelText 19문자열 위트 재작성(분기·의미·아키타입 매핑 무변경): 밥 주는 사람과 귀여운 갑→간식 셔틀과 네 발 상전, 까칠한 룸메이트→츤데레 룸메이트, 집안 실세와 월급 없는 운영진→무급인데 평생직장, 쭈가 너 없으면…→공식 인증 껌딱지 인연 등. "쭈" 버그 해소 |
| T1 | 프롬프트 [라벨 룰] 정리: label은 서버 확정값 그대로(죽은 "골라라" + 트로프 유발 ruler 권력코드 룰 삭제) |
| T2 | headline·finalLine·label.text에 신살·12운성·오행·한자 등 명리 용어 이름 금지(제목은 쉬운 말·본문에서만 명리). 좋은/나쁜 예시 |
| T3 | petVerdict·ownerVerdict 4~6→5~7문장 + 오감·구체 장면 디테일 1개↑, 시뮬 디테일. maxOutputTokens 8192→10240 |
| T4 | validatePetCompatResult에 headline/finalLine 명리 용어 검출(재생성 루프 자동 편입). 신호 블록 ruler 가이드가 블랙리스트 용어("집안 실세") 권하던 모순 정리 |
| T5 | 결과화면 판정 SectionList 기본 펼침 2→전체 |

## 검증
grade-dist PASS(점수 회귀0), dev-test: 라벨 "간식 셔틀과 네 발 상전", 헤드라인 명리 용어 0·
위트 O("네가 충성하는 줄 알았지? 실은 두부가 네 머리 위에서 조종 중"), 판정 270자 풍성. tsc 0.
관측: 본문 트로프("집안 실세")가 QA 2차에도 잔존하는 stubborn 케이스 — 재생성률 관측 후 판단.

## 회귀 불변
Track A 성과(신호승격·앵커·fabrication0)·아키타입 매핑(라벨 분기)·share label_text·
SCORING_VERSION 4·Phase 2 레이아웃.
