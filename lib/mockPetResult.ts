// 🚨 DEV ONLY — 펫 결과 화면 리디자인 검증용 mock (app/dev/pet-result-ui)
// 실제 API 응답 모양(ApiResponse["result"])과 동일. prod 번들에 영향 없음(dev 페이지만 import).

import type { PetCompatResult, LabelGrade } from "./pet-compat";

export interface PetResultData {
  id: string;
  label_grade: LabelGrade;
  label_text: string;
  composite_score: number;
  sync_score: number;
  ruler_score: number;
  lover_score: number;
  loyalty_score: number;
  conflict_score: number;
  illustration_key: string | null;
  illustration_url: string | null;
  full_result: PetCompatResult;
  scoring_version: number;
  created_at: string;
  pet: { id: string; name: string; species: "dog" | "cat"; breed: string | null; gender: string | null; birth_tier: number };
}

const DEMO_ILLUST =
  "https://cfkijdafranpkgwnosfq.supabase.co/storage/v1/object/public/pet-illustrations/demo/dubu-throne.png";

// 개 · A(표시 S)등급 · 보호자가 더 매달림 · 펫 우위
export const MOCK_PET_DOG_A: PetResultData = {
  id: "mock-dog-a",
  label_grade: "A",
  label_text: "간식 셔틀과 네 발 상전",
  composite_score: 79,
  sync_score: 55,
  ruler_score: 71,
  lover_score: 77,
  loyalty_score: 45,
  conflict_score: 22,
  illustration_key: "demo",
  illustration_url: DEMO_ILLUST,
  scoring_version: 4,
  created_at: "2026-07-14T00:00:00.000Z",
  pet: { id: "p1", name: "두부", species: "dog", breed: "시츄", gender: "male", birth_tier: 1 },
  full_result: {
    label: { grade: "A", text: "간식 셔틀과 네 발 상전", headline: "네가 챙기는 줄 알았지? 실은 두부 스케줄에 네 하루가 맞춰지는 사이" },
    scores: { composite: 79, sync: 55, ruler: 71, lover: 77, loyalty: 45, conflict: 22 },
    manual: {
      name: "두부",
      spec: "6세, 시츄, 子(쥐)띠 水 기운",
      recommendedEnv: "두부는 뜨거운 화 기운을 타고났어. 늘 시원하고 조용한 구석 하나는 비워 둬. 제 페이스가 흐트러지면 눈에 띄게 예민해진다.",
      warnings: "일지 방합으로 네 리듬에 두부가 스르륵 합류하는 구조야. 그래서 네가 무심코 다 맞춰주다 지친다. 선을 먼저 그어야 오래간다.",
      chargeMethod: "잔소리보다 시원한 물 한 그릇, 짧은 산책이 두부를 움직이게 해. 부드럽지만 단호한 태도가 충전 스위치야.",
      errorSignals: "이유 없이 짖거나 우다다가 심해지면 관심이 필요하다는 신호야. 다만 구토·기력 저하 같은 진짜 아픈 신호면 사주가 아니라 병원 먼저.",
      ownerMode: "두부에게 휘둘리기 쉬운 구조라, 가끔은 단단하게 '안 돼'라고 말하는 연습이 필요해.",
    },
    ownerVerdictTitle: "두부 바라기 건주",
    ownerVerdict:
      "너와 두부는 일지 방합으로 묶인 사이야. 같은 계절 기운이라 함께 있으면 한없이 편한데, 문제는 그 편안함이 늘 두부 페이스로 흐른다는 거지. 산책 시간도, 간식 타이밍도, 심지어 소파 자리까지 어느새 두부 기준으로 정해져 있을 거야. 신약한 네 사주는 좋아하는 대상 앞에서 기준이 무너지기 쉬운 구조라, 두부에게 쏟는 만큼 정작 너를 챙기는 데는 소홀해진다. 그래도 이게 널 갉아먹는 관계는 아니야. 두부도 네 곁이 세상에서 제일 편한 자리니까. 그냥 네가 조금 더 내주는 팔자, 그뿐이다.",
    petVerdictTitle: "애교 만점 잔머리꾼",
    petVerdict:
      "두부는 타고난 매력으로 세상 사람을 홀리는 기술을 장착하고 나왔어. 특히 좋아하는 사람 앞에서는 꼬리 흔들기부터 배 뒤집기까지 풀코스 애교를 펼치지. 하지만 그게 다가 아니야. 신강한 사주라 겉으론 네게 찰싹 붙어 있어도, 속으론 제 루틴과 공간을 확실히 지키는 소신파거든. 네 애정 공세가 살짝 과하다 싶으면 슬그머니 한 발 물러나 거리를 두는 밀당의 고수이기도 해. 뜨거운 화 기운이 강해서 심심한 건 못 참고, 눈 마주치면 '나 지금 심심해'라는 표정으로 온 집을 탐험하러 나설 거야.",
    simulations: [
      { scene: "현관 앞 두부의 침묵 시위", prediction: "네가 현관으로 걸어가면 두부의 눈이 레이저처럼 변한다. 조용히 네 뒤를 쫓아와 현관문 앞에 척 앉아 버리지. 꼬리는 흔들지 않아. 그저 앉아서 '지금부터 산책이야, 알아들었지?' 하는 무언의 압력을 보낸다. 네가 신발을 신는 순간, 갑자기 '낑낑!' 하고 짧게 소리를 내며 온몸으로 기쁨을 표현할 거야. 그러고는 네가 목줄을 채우기도 전에 벌써 문밖으로 몸을 반쯤 내밀고 서 있다. 네가 신발 끈을 묶을 여유도 주지 않을 걸." },
      { scene: "초인종과 애교 필살기", prediction: "딩동! 초인종이 울리자마자 두부는 현관으로 달려가 '누구냐!' 짖으며 경계를 시작한다. 낯선 사람 냄새가 나면 일단 으르렁거리는 시늉을 하지. 하지만 손님이 문을 열고 들어오는 순간, 두부의 눈빛이 스르륵 풀리며 꼬리를 흔들기 시작한다. '어머, 예쁘다!' 소리를 듣는 순간부터 발라당 배를 뒤집고 '만져라, 만져라' 하며 애교 필살기를 시전한다. 방금 전 짖었던 건 기억도 안 나는 듯, 손님 무릎에 척 앉아 콧소리를 낸다. 완벽한 태세 전환에 손님도 너도 웃음만 나올 거야." },
      { scene: "간식 앞 전리품 사수", prediction: "네가 간식 봉투를 흔드는 순간, 두부는 온 신경을 곤두세우고 너를 주시한다. 간식을 한 조각 던져주면, 잽싸게 물고는 네가 뺏어갈까 봐 두 발로 꼭 쥐고 구석으로 달려간다. '내 거야, 이건 내 거!' 하는 비장한 표정으로 재빨리 먹어치우지. 다 먹고 나면 아무 일 없었다는 듯 돌아와 다시 너를 빤히 쳐다보며 다음 간식을 요구한다. 다음 간식이 나올 때까지 네 주위를 맴돌며 시선을 끊지 않을 걸." },
    ],
    futureLineTitle: "함께 쌓아갈 너희 연대기",
    futureLine:
      "지금 두부는 12운성 제왕의 기운을 타고 있어. 가장 자기 주장이 강하고 활발한 때야. 2~3년 뒤엔 조금 느긋해지겠지만, 너를 향한 애정은 여전할 거야. 함께 쌓는 하루하루가 둘만의 언어가 된다.",
    finalLine: "네가 조금 더 내주는, 그래서 더 단단해지는 사이야.",
    disclaimer: "",
  },
};

// 고양이 · B등급 · 대체로 균형
export const MOCK_PET_CAT_B: PetResultData = {
  id: "mock-cat-b",
  label_grade: "B",
  label_text: "까칠한 룸메이트",
  composite_score: 68,
  sync_score: 41,
  ruler_score: 58,
  lover_score: 60,
  loyalty_score: 52,
  conflict_score: 34,
  illustration_key: null,
  illustration_url: null,
  scoring_version: 4,
  created_at: "2026-07-14T00:00:00.000Z",
  pet: { id: "p2", name: "나비", species: "cat", breed: "코숏", gender: "female", birth_tier: 2 },
  full_result: {
    label: { grade: "B", text: "까칠한 룸메이트", headline: "일지 충으로 리듬이 어긋나도 결국 같은 소파를 쓰는 사이" },
    scores: { composite: 68, sync: 41, ruler: 58, lover: 60, loyalty: 52, conflict: 34 },
    manual: {
      name: "나비",
      spec: "5세, 코숏, 巳(뱀)띠 火 기운",
      recommendedEnv: "나비는 높은 곳에서 내려다볼 자리가 필요해. 창가나 캣타워 하나면 하루가 평온하다.",
      warnings: "일지 충이라 생활 리듬이 자주 엇갈려. 네가 놀자 할 때 나비는 쉬고 싶고, 그 반대도 잦다. 타이밍을 나비에 맞춰.",
      chargeMethod: "억지로 안기보다, 나비가 다가올 때까지 기다렸다 짧게 반응해 줘. 거리 존중이 나비의 충전법이야.",
      errorSignals: "꼬리를 크게 치거나 하악질이 늘면 공간이 필요하다는 뜻이야. 밥을 거르거나 숨어서 안 나오면 그땐 병원 먼저.",
      ownerMode: "나비의 '싫음'을 존중하는 연습. 밀당에서 한 발 물러서는 쪽이 너면 관계가 편해진다.",
    },
    ownerVerdict:
      "너와 나비는 일지 충으로 만났어. 리듬이 정면으로 엇갈리는 자리라, 서로 좋은데도 타이밍이 자주 어긋난다. 네가 다가가는 만큼 나비가 물러서는 날이 있을 거야. 그래도 결국 같은 공간을 나눠 쓰는 걸 보면, 이 어긋남조차 너희 방식이다.",
    petVerdict:
      "나비는 화 기운이 또렷한 아이야. 자기 기분과 온도에 민감해서, 좋을 땐 무릎을 내주다가도 선을 넘으면 바로 자리를 뜬다. 겉은 시크해도 네가 어디 있는지는 늘 곁눈으로 확인하는 타입이지.",
    simulations: [
      { scene: "창밖 감시", prediction: "새 한 마리만 지나가도 나비의 꼬리가 파르르 떨린다. 사냥 본능이 켜지는 순간, 세상 진지한 얼굴이 된다." },
      { scene: "낯선 사람", prediction: "손님이 오면 일단 사라진다. 그러다 분위기가 안전하다 싶으면 슬쩍 나타나 멀찍이서 관찰한다." },
      { scene: "혼자 있을 때", prediction: "네가 없는 동안은 제 세상이다. 돌아오면 기다린 티는 안 내지만, 굳이 네 동선 앞을 가로질러 존재감을 알린다." },
    ],
    futureLine:
      "지금 나비는 12운성 관대의 기운 속에 있어. 자기 색이 또렷해지는 때야. 2~3년 뒤 너에게도 변화가 오는데, 그때 나비는 조용한 안식처가 되어 줄 거야. 어긋나면서도 붙어 있는 시간이 쌓여 간다.",
    finalLine: "박자는 어긋나도, 끝내 같은 자리로 돌아오는 사이.",
    disclaimer: "",
  },
};

export const MOCK_PET_CASES = { dogA: MOCK_PET_DOG_A, catB: MOCK_PET_CAT_B };
