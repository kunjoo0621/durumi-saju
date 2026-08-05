// 심층 검사 3종(결혼운·재물운·커리어운) 결과 조회 컬럼 목록 — 단일 출처.
//
// 같은 목록을 두 곳이 쓴다.
//   ① 로그인 본인 조회: app/api/{marriage,wealth,career}/results/route.ts (user_id 포함 — 소유권 스코프에 필요)
//   ② 공개 share 조회: lib/share-{marriage,wealth,career}.ts (user_id 제외 — 링크 받은 제3자에게 줄 이유가 없다)
//
// 두 목록을 각 파일이 따로 들고 있으면 컬럼을 하나 추가할 때 한쪽만 고치게 되고,
// supabaseAdmin이 무타입이라 빠뜨린 쪽은 컴파일도 테스트도 잡지 못한 채 그 필드만
// 조용히 undefined로 렌더된다. 로그인 화면은 멀쩡하고 공유 링크에서만 비어 보이므로
// 발견이 늦다. 그래서 core를 한 번만 적고 두 변형을 여기서 파생시킨다.
//
// ★share 목록에 개인 식별정보(name·birth_date·birth_time·gender·saju_text·source_result_id)를
//  넣지 말 것. 공개 라우트로 그대로 나간다.

const MARRIAGE_CORE =
  "marital_status, marriage_grade, spouse_star_type, gwansal_honjap, spouse_star_absent, spouse_palace_stability, teaser_json, full_json, created_at";

const WEALTH_CORE =
  "interest, wealth_grade, jaeseong_type, jaeda_shinyak, sikssang_saengjae, gunggeob_jaengjae, jae_grip, teaser_json, full_json, created_at";

const CAREER_CORE =
  "situation, career_grade, gwanseong_type, gwanda_sinyak, gwanin_sangsaeng, sanggwan_gyeongwan, career_grip, teaser_json, full_json, created_at";

/** 공개 share 페이지용 — user_id 없음 */
export const MARRIAGE_SHARE_COLUMNS = `id, ${MARRIAGE_CORE}`;
export const WEALTH_SHARE_COLUMNS = `id, ${WEALTH_CORE}`;
export const CAREER_SHARE_COLUMNS = `id, ${CAREER_CORE}`;

/** 로그인 본인 조회용 — user_id 포함 */
export const MARRIAGE_RESULT_COLUMNS = `id, user_id, ${MARRIAGE_CORE}`;
export const WEALTH_RESULT_COLUMNS = `id, user_id, ${WEALTH_CORE}`;
export const CAREER_RESULT_COLUMNS = `id, user_id, ${CAREER_CORE}`;
