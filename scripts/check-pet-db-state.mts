// 펫 궁합 재개 사전점검: 버킷·테이블·마이그레이션 적용 상태 실측 (읽기 전용)
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [
      l.slice(0, l.indexOf("=")).trim(),
      l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, ""),
    ]),
);
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("env parse 실패:", Object.keys(env).length, "keys");
  process.exit(1);
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

const { data: buckets } = await sb.storage.listBuckets();
console.log("buckets:", (buckets || []).map((b) => b.name).join(", ") || "(none)");

const { error: e1 } = await sb.from("pet_profiles").select("id").limit(1);
console.log("pet_profiles:", e1 ? "ERROR " + e1.message : "EXISTS");
const { error: e2 } = await sb.from("pet_profiles").select("loyalty_score").limit(1);
console.log("loyalty_score col:", e2 ? "MISSING (" + e2.message + ")" : "EXISTS");
const { error: e3 } = await sb.from("pet_profiles").select("coat_color").limit(1);
console.log("coat_color col:", e3 ? "없음(드랍 완료)" : "STILL EXISTS (드랍 마이그레이션 미적용)");
const { error: e3b } = await sb.from("pet_profiles").select("neutered").limit(1);
console.log("neutered col:", e3b ? "없음(드랍 완료)" : "STILL EXISTS (드랍 마이그레이션 미적용)");
const { error: e4 } = await sb.from("pet_compat_results").select("id").limit(1);
console.log("pet_compat_results:", e4 ? "ERROR " + e4.message : "EXISTS");
const { error: e5 } = await sb.from("pet_compat_results").select("loyalty_score").limit(1);
console.log("pet_compat_results.loyalty_score:", e5 ? "MISSING" : "EXISTS");
const { error: e6 } = await sb.from("pet_compat_results").select("illustration_url").limit(1);
console.log("pet_compat_results.illustration_url:", e6 ? "MISSING" : "EXISTS");
