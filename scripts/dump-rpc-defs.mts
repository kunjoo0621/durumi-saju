import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

// pg_get_functiondef로 SQL 정의 dump. RPC로 한 줄 SQL 실행이 안 되니
// SQL view로 우회 — supabase-js는 from().select()만 되니 직접 fetch로
// PostgREST /rest/v1/rpc 또는 stored procedure 호출.
// 대안: 임시로 SQL 함수 만들기 어려우니, 모든 함수 이름만이라도 pg_proc에서 가져오는
// PostgreSQL 함수가 이미 있다면 호출. 없으면 PostgREST의 OpenAPI 스펙(/rest/v1/)에서 RPC 목록 추출.

const baseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const key = envVars.SUPABASE_SERVICE_ROLE_KEY;

// 1) PostgREST OpenAPI 스펙으로 RPC 목록
const specRes = await fetch(`${baseUrl}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
const spec = await specRes.json();

const rpcPaths = Object.keys(spec.paths ?? {}).filter((p) => p.startsWith("/rpc/"));
console.log(`=== PostgREST에 노출된 RPC ${rpcPaths.length}개 ===\n`);
for (const p of rpcPaths) {
  const def = spec.paths[p];
  const post = def.post ?? {};
  const params = post.parameters?.[0]?.schema?.properties ?? {};
  const paramList = Object.entries(params).map(([k, v]: any) => `${k}:${v.type ?? "?"}`).join(", ");
  console.log(`  ${p.replace("/rpc/", "").padEnd(30)} (${paramList})`);
}
