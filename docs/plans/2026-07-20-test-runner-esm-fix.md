# 유닛 테스트 러너 복구 계획 — `@gracefullight/saju` ESM-only exports 문제

- 작성일: 2026-07-20
- 브랜치: `feat/career-luck-test` (worktree, origin/main 기준)
- 범위: **레포 개발 살림(dev tooling)**. 커리어운 기능 로직과 무관. 웹 앱(next build/dev)은 정상.
- 결론 먼저: **이건 "큰 문제"가 아니다.** 원인은 한 곳(의존성 exports 맵에 `default` 조건 없음)이고, dist 파일을 건드리지 않고 exports에 `default` 한 줄만 더해주면 **코드/설정 변경 0으로 전체 테스트가 통과**한다. vitest 대이동·ESM 전환 불필요. **예상 규모: 1시간 이내.**

---

## 1. 진단 (전부 실측)

### 1.1 증상 재현
```
$ npx tsx --test lib/wealth-facts.test.ts
Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath './adapters/date-fns'
  is not defined by "exports" in node_modules/@gracefullight/saju/package.json
    at resolveExports (node:internal/modules/cjs/loader:679:36)   ← CJS require 경로
✖ pass 0 / fail 1
```

### 1.2 진짜 원인 (추정이 아니라 확인함)
- `node_modules/@gracefullight/saju/package.json`(설치본 **1.2.0**)의 exports 맵:
  ```json
  "./adapters/date-fns": { "import": "./dist/adapters/date-fns.js", "types": "..." }
  ```
  → **`require`도 `default`도 없다.** `import`/`types` 조건만 있는 ESM-only 맵.
  → 서브패스 자체는 "정의되어 있다". 문제는 **조건**이다: CJS `require()`로 해석하면 `require` 조건을 찾는데 없고, 폴백 `default`도 없어 "not exported"로 뜬다.
- `lib/utils/saju.ts:2` 가 `@gracefullight/saju/adapters/date-fns` 를, `:3` 이 루트 `@gracefullight/saju` 를 import. 루트 엔트리(`.`)도 동일하게 `import`-only라 둘 다 require로는 못 푼다.
- 루트 `package.json` 에 `"type"` 필드 없음 → CJS 기본. 그래서 tsx가 `.ts` 를 **CJS로 전사 → require** → exports 조건 불일치로 실패.
- **웹 앱이 멀쩡한 이유**: webpack/Next가 `import` 조건으로 해석하기 때문. 깨지는 건 CJS require 하는 CLI 테스트 러너뿐.

### 1.3 "1.1.3으로 핀"은 문제를 못 고친다 (Option A 반증 — 실측)
npm registry로 전 버전 exports를 대조:

| 버전 | exports에 require/default 있나? |
|---|---|
| 1.0.0 | 없음 (import/types only) |
| 1.1.3 (package.json의 caret 하한) | 없음 |
| 1.2.0 (현재 설치본) | 없음 |
| 1.3.1 (최신) | 없음 |

→ **이 패키지는 첫 릴리스부터 최신까지 전부 ESM-only.** 어느 버전으로 핀해도 CJS 테스트 러너는 똑같이 깨진다. **Option A(버전 핀)는 원인을 없애지 못한다.** 태스크에 적힌 "1.1.3이면 exports가 달랐을 것" 가설은 사실이 아님을 확인.

### 1.4 실행 방식만 ESM으로 바꾸는 것(Option B)도 깔끔히 안 된다 (실측)
- `.mts`로 강제 ESM → `date-fns` exports 에러는 **사라진다**(ESM은 `import` 조건 사용). 그러나 새 에러:
  ```
  SyntaxError: The requested module './wealth-facts' does not provide an export named 'deriveWealthFacts'
  ```
  → 테스트만 ESM이고 `lib/*.ts` 소스는 여전히 CJS라 **named-export interop 불일치**. 전체를 ESM으로 돌리려면 루트 `"type": "module"` 필요 → next.config·수십 개 `scripts/*` ·전 소스에 파급(블라스트 대). 배보다 배꼽.
- `node --import tsx --test`, `NODE_OPTIONS=--import tsx/esm` 도 시도 → 스택은 여전히 `cjs/loader` 경유, **동일하게 실패**. tsx는 루트가 CJS인 한 `.ts` 를 CJS로 취급.
- 결론: **"코드 안 건드리고 실행 플래그만"으로 되는 조합은 없다.** (아래 4번 표 참조)

### 1.5 되는 조합 (실측으로 찾음) ★
`node_modules/@gracefullight/saju/package.json` 의 각 exports 항목에 `"default"` 를 `"import"` 과 같은 타깃으로 추가한 뒤:
```
$ npx tsx --test lib/*.test.ts
ℹ tests 172
ℹ pass  172
ℹ fail  0
```
- 코드/설정 변경 **0**. 표준 실행(`npx tsx --test`) 그대로.
- Node 24의 **require(ESM)** 덕분에 CJS require 가 실제 ESM dist(`./dist/adapters/date-fns.js`)를 그대로 로드 → 동작. (Node 22.12+ 기본 활성, 현재 v24.13.0.)

### 1.6 실제 블라스트 반경 (실측 — 태스크 가정보다 좁음)
`lib/` 테스트 파일 **14개 / 138 테스트**. 스위트로 한 번에 돌리면(`tsx --test lib/*.test.ts`) 현재도 **134 pass / 4 fail**:

| 파일 | saju 엔진(런타임) import | 현재 상태 |
|---|---|---|
| marriage-facts.test.ts | `enrichSajuData` 실행 | ✖ fail |
| marriage-prompt.test.ts | `enrichSajuData` 실행 | ✖ fail |
| self-input.test.ts | `enrichSajuData` 실행 | ✖ fail |
| wealth-facts.test.ts | `enrichSajuData` 실행 | ✖ fail |
| career-facts.test.ts | `import type` 만 (전사 시 제거) | ✔ pass |
| 나머지 9개 (wealth-grade, marriage-grade, *-postprocess, *-consistency, fortune-timeline, qa-regen, wealth-prompt) | 순수 로직 | ✔ pass |

→ 막히는 건 **saju 엔진(`enrichSajuData`/`getFourPillars`)을 실제로 실행하는 4개 파일뿐.** "재물·결혼·펫 등 saju import 전부 차단"은 과장 — 순수 로직 테스트 10개는 지금도 통과. 다만 4개는 재물·결혼·self-input 핵심이라 복구 가치 충분. 패치 후엔 4개가 살아나며 전체 **172 pass**(이전엔 import 에러로 조기 bail 되던 테스트 본문들이 마저 실행돼 개수 증가).

### 1.7 관련 설정
- `tsconfig.json`: `module: esnext`, `moduleResolution: bundler`, `type` 미지정. (ESM 전환 시 `bundler`→`nodenext` 등 파급 큼 — 안 건드림)
- `package.json`: `"test"` 스크립트 없음. 패키지매니저 = **npm**(`package-lock.json`). patch-package 미설치. postinstall 없음.

---

## 2. 해결 옵션 비교

| 옵션 | 무엇을 | 바꾸는 파일 | 웹빌드/배포 영향 | 되돌리기 | 평가 |
|---|---|---|---|---|---|
| **A. 버전 핀(1.1.3 등)** | caret 제거·구버전 고정 | package.json, lock | 없음 | 쉬움 | ✗ **원인 미해결**(§1.3, 전 버전 ESM-only). 최신 포기까지 하고도 안 고쳐짐 |
| **B. 실행 방식만 ESM(.mts / --import tsx / 플래그)** | 코드 유지, 러너만 ESM | 러너 플래그 or 전 소스 `type:module` | 플래그만이면 없음 / 전면 ESM이면 **큼**(next.config·scripts 전부) | 중~어려움 | ✗ 플래그만으론 named-export interop로 실패(§1.4). 전면 ESM은 오버엔지니어링 |
| **C. vitest 도입** | node:test API → vitest 마이그레이션 | vitest 설치 + config + **14개 test 파일 재작성**(`node:test`→`vitest`, `assert`→`expect`) | 없음(devDep) | 어려움 | ✗ 문제 대비 과도. TS+ESM+alias는 얻지만 이 버그엔 불필요한 대공사 |
| **D-1. patch-package로 exports에 `default` 추가 + 버전 정확히 핀** ★추천 | dist 무수정, exports에 `default`=`import` 주입 | package.json(devDep+postinstall+정확핀), `patches/@gracefullight+saju+1.2.0.patch` 신규 | **없음**(webpack은 `import` 사용, `default` 추가는 무해. Vercel postinstall도 안전) | 쉬움(패치파일·postinstall·devDep 삭제) | ✓ 원인 정조준, 코드 0수정, 172/172 실측 통과 |
| **D-2. postinstall 자작 스크립트로 exports 주입(무-신규-의존성)** | 위와 동일하되 patch-package 없이 idempotent 스크립트 | package.json(postinstall), `scripts/patch-saju-exports.mjs` 신규 | 없음 | 쉬움 | ○ 신규 dep 0·버전 무관하게 동작. 단 bespoke(리뷰어에 덜 표준적) |

CLAUDE.md 규칙 충돌: 없음. (배포 2차영향 전수 = §3.4에서 점검. main 머지/배포는 별도 승인 필요 — 이 계획은 브랜치 작업까지)

---

## 3. 추천 & 계획

### 3.1 추천: **D-1 (patch-package + 정확 버전 핀)**
근거(예스맨 아님, 실측 트레이드오프):
1. **원인을 정확히 없앤다**: exports에 `default` 한 줄 = require(ESM) 경로가 열림. §1.5에서 172/172 실증.
2. **코드·tsconfig·소스 0 수정**. 웹 빌드 경로(webpack `import` 조건) 불변 → 배포 리스크 0.
3. patch-package는 "우리가 서드파티 dep을 패치했다"의 **업계 표준 관용구**라 리뷰어가 즉시 이해하고, `patches/*.patch` 가 변경 내용을 자체 문서화.
4. patch-package 파일명은 버전에 묶인다(`...+1.2.0.patch`) → caret이 1.3.x로 튀면 패치가 조용히 무효화될 위험. 그래서 **버전을 `1.2.0` 정확히 핀**해 이 위험을 제거(전 버전 exports 동일하므로 최신 포기의 실익도 없음).

> 대안 D-2(무-의존성 postinstall 스크립트)도 충분히 정당. 신규 dep을 극도로 꺼리면 D-2 채택 가능(버전 무관 idempotent라 핀도 불필요). 표준성·자체문서화를 사면 D-1. 본 계획은 D-1로 진행하되 D-2 스크립트 예시를 부록에 둔다.

### 3.2 단계
1. **패키지 버전 정확 핀**: `package.json` `"@gracefullight/saju": "^1.1.3"` → `"1.2.0"`. `npm install` 로 lock 갱신(현재 설치본이 이미 1.2.0이라 실질 변화 없음, caret만 제거).
2. **patch-package·postinstall 추가**:
   - `npm i -D patch-package`
   - `package.json` scripts에 `"postinstall": "patch-package"` 추가.
3. **exports 패치 생성**:
   - `node_modules/@gracefullight/saju/package.json` 의 exports 3개 항목(`.`, `./adapters/luxon`, `./adapters/date-fns`) 각각에 `"default": "<import과 동일 타깃>"` 추가.
   - `npx patch-package @gracefullight/saju` → `patches/@gracefullight+saju+1.2.0.patch` 생성·커밋.
4. **test 스크립트 추가**: `package.json` scripts에
   ```json
   "test": "tsx --test lib/*.test.ts"
   ```
   (Node 24 + tsx로 표준화. 새 lib 테스트 자동 포함.)
5. (선택) 재현 방지 메모: `docs/` 또는 CLAUDE 메모에 "이 dep는 ESM-only, 테스트는 require(ESM)+exports 패치로 돈다" 한 줄.

### 3.3 검증 (핵심 — 표준 방식으로 다시 도는지)
```bash
# 클린 재설치가 패치를 자동 적용하는지(핵심)
rm -rf node_modules && npm install         # postinstall→patch-package 자동 실행 확인
grep -q '"default"' node_modules/@gracefullight/saju/package.json && echo PATCH_OK

# 표준 진입점으로 전체 통과 확인
npm test                                    # 기대: tests 172 / pass 172 / fail 0

# 문제였던 4개(재물·결혼·self-input) 개별 확인
npx tsx --test lib/wealth-facts.test.ts     # 15 pass
npx tsx --test lib/marriage-facts.test.ts
npx tsx --test lib/marriage-prompt.test.ts
npx tsx --test lib/self-input.test.ts
# 커리어는 원래 통과였지만 회귀 없나 재확인
npx tsx --test lib/career-facts.test.ts

# 웹 빌드 무영향 2차 검증(feedback_deploy_checklist)
npm run build                               # next build 정상(=exports default 추가가 webpack 경로 불변)
```

### 3.4 배포 2차 영향 전수 (feedback_deploy_checklist)
- **webpack/Next 해석**: `import` 조건 그대로 사용 → `default` 추가는 무시됨 → 빌드 산출물 불변.
- **Vercel 빌드**: `npm install` 시 postinstall 실행 → node_modules에 패치 적용(로컬과 동일). `patches/` 는 커밋되므로 CI에서도 재현. 빌드 함수 크기·번들 영향 없음(dist 파일 자체는 무수정).
- **버전 핀 부작용**: caret 제거로 자동 마이너 업 중단. 전 버전 exports 동일하니 기능 손실 없음. 업그레이드 시 patch 파일명 버전만 갱신하면 됨.

### 3.5 리스크 & 되돌리기
| 리스크 | 완화 |
|---|---|
| dep 업글 시 patch 파일명 불일치로 조용히 미적용 | 버전 정확 핀(§3.2-1) + `npm test` 를 커밋훅/CI에 두면 즉시 감지. patch-package는 미적용 시 경고 출력 |
| postinstall이 Vercel에서 실패 | patch-package는 실패해도 비-치명(경고 후 계속). `patches/` 미스매치면 로그로 확인 가능 |
| require(ESM)가 미래 Node에서 바뀜 | 현재 LTS 기본 기능이라 안정적. 만약 문제되면 D-2/전면 ESM 재검토 |
| **되돌리기** | `patches/*.patch` 삭제 + package.json에서 postinstall·patch-package devDep·test 스크립트 제거 + 버전 caret 복원 → 원상. 전부 파일 3~4곳, 즉시 revert 가능 |

---

## 부록: D-2 (무-의존성 대안) 스크립트 예시
```js
// scripts/patch-saju-exports.mjs  —  postinstall에서 실행, idempotent, 버전 무관
import fs from "node:fs";
const p = "node_modules/@gracefullight/saju/package.json";
const j = JSON.parse(fs.readFileSync(p, "utf8"));
let changed = false;
for (const k of Object.keys(j.exports ?? {})) {
  const e = j.exports[k];
  if (e && typeof e === "object" && e.import && !e.default) {
    e.default = e.import;               // require(ESM) 폴백 조건 주입
    changed = true;
  }
}
if (changed) fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
```
`package.json`: `"postinstall": "node scripts/patch-saju-exports.mjs"`. 신규 npm 의존성 0, 버전이 바뀌어도 그대로 동작(정확 핀 불필요). 표준 관용구를 원하면 D-1, 의존성 0을 원하면 D-2.
