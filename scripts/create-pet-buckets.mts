// 펫 궁합 Storage 버킷 생성 (idempotent — 있으면 skip)
// pet-uploads: 사용자 펫 사진 (private, signed URL로만 접근)
// pet-illustrations: Gemini 생성 일러스트 (public — 결과/공유 화면 노출)
// 실행: npx tsx scripts/create-pet-buckets.mts
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
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

const BUCKETS = [
  { name: "pet-uploads", public: false, fileSizeLimit: 5 * 1024 * 1024, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] },
  { name: "pet-illustrations", public: true, fileSizeLimit: 5 * 1024 * 1024, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] },
];

const { data: existing, error: listError } = await sb.storage.listBuckets();
if (listError) {
  console.error("버킷 목록 조회 실패:", listError.message);
  process.exit(1);
}
const names = new Set((existing || []).map((b) => b.name));
for (const b of BUCKETS) {
  if (names.has(b.name)) {
    console.log(`skip: ${b.name} 이미 존재`);
    continue;
  }
  const { error } = await sb.storage.createBucket(b.name, {
    public: b.public,
    fileSizeLimit: b.fileSizeLimit,
    allowedMimeTypes: b.allowedMimeTypes,
  });
  console.log(error ? `FAIL ${b.name}: ${error.message}` : `created: ${b.name} (public=${b.public})`);
  if (error) process.exit(1);
}
