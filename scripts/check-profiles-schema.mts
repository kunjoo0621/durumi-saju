import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
}
const sb = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

// 1 row만 select * 해서 컬럼 확인
const { data, error } = await sb.from("profiles").select("*").limit(1);
if (error) { console.error(error); process.exit(1); }
console.log("profiles columns:", data?.[0] ? Object.keys(data[0]) : "(no rows)");

// 장혜진 row 전체
const { data: jane } = await sb
  .from("profiles")
  .select("*")
  .eq("user_id", "9e8d1e96-784c-4f5b-a40e-e1606ecdbd81")
  .maybeSingle();
console.log("\n장혜진 profile row:");
console.log(JSON.stringify(jane, null, 2));

// 이상윤, 정은, 이채원, 신건주 row도
const otherIds = [
  "1f168320-917a-4a74-b92d-ab29f185bcc8", // 이상윤
  "8ad5bc54-38f8-46ce-b36e-46b217855edd", // 정은
  "d2a4a50d-30ea-4c90-a4be-757788e12cd0", // 이채원
  "f39ccecb-fc39-4ef9-a262-d8ab2b85c317", // 신건주
];
for (const uid of otherIds) {
  const { data } = await sb.from("profiles").select("*").eq("user_id", uid).maybeSingle();
  console.log(`\n${uid}:`);
  console.log(JSON.stringify(data, null, 2));
}
