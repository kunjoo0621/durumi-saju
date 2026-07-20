// @gracefullight/saju 는 exports 맵에 "import"/"types" 조건만 있는 ESM-only 패키지다.
// Node 24 + tsx 로 유닛 테스트(lib/*.test.ts, node:test)를 CJS 전사해 돌릴 때 require(ESM)
// 경로가 "default" 폴백 조건을 못 찾아 ERR_PACKAGE_PATH_NOT_EXPORTED 로 죽는다
// (웹 빌드는 webpack이 "import" 조건을 써서 무관 — 순전히 CLI 테스트 러너만의 문제).
//
// patch-package 는 package.json 을 구조적으로 패치하지 못해(v8 하드코딩 제외), 이 fix에는
// 쓸 수 없다. 그래서 postinstall 에서 exports 각 항목에 "default"="import" 폴백을 주입한다.
// dist 파일은 건드리지 않는다(무해·webpack 경로 불변). idempotent — 여러 번 돌려도 안전하고
// 버전이 바뀌어도(전 버전 동일 ESM-only 구조) 그대로 동작한다.
import fs from "node:fs";

const p = "node_modules/@gracefullight/saju/package.json";
if (!fs.existsSync(p)) process.exit(0); // 의존성 미설치 환경(방어) — 조용히 통과

const j = JSON.parse(fs.readFileSync(p, "utf8"));
let changed = false;
for (const k of Object.keys(j.exports ?? {})) {
  const e = j.exports[k];
  if (e && typeof e === "object" && e.import && !e.default) {
    e.default = e.import; // require(ESM) 폴백 조건 주입
    changed = true;
  }
}
if (changed) {
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
  console.log("[patch-saju-exports] @gracefullight/saju exports에 default 폴백 주입 완료");
}
