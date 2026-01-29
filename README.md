# 두루 - 사주풀이 서비스

복을 배달하는 두루미와 함께하는 사주풀이 서비스입니다.

## 시작하기

### 의존성 설치

```bash
npm install
```

### 환경 변수 설정

1. [Anthropic Console](https://console.anthropic.com/)에서 API 키를 발급받으세요.
2. `.env.local` 파일을 열고 API 키를 입력하세요:

```bash
ANTHROPIC_API_KEY=your_api_key_here

# Mock Mode (선택 사항)
USE_MOCK=false  # 개발 시 true로 설정하면 API 비용 절약
```

#### Mock 모드 (개발용)

디자인 작업이나 테스트 시 API 비용을 절약하려면 `.env.local`에서 `USE_MOCK=true`로 설정하세요.

- `USE_MOCK=true`: 실제 API 호출 없이 가짜 데이터 반환 (무료)
- `USE_MOCK=false`: 실제 Claude API 호출 (크레딧 소모)

### 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 열어 결과를 확인하세요.

## 기능

- 단계별 사주 정보 입력 (이름, 생년월일, 출생시간, 출생지역, 성별, 연애/결혼 상태)
- Claude API를 활용한 AI 사주 분석
- 냉철하고 직설적인 운명 데이터 분석 (S/A/B/C/F 등급 시스템)
- 토스/당근마켓 스타일의 깔끔한 UI
- 모바일 우선 반응형 디자인
- 부드러운 전환 효과
- 진행 상황 표시

## 기술 스택

- Next.js 15 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Anthropic Claude API (Claude 3.5 Sonnet)
