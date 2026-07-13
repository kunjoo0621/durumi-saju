// 🚨 DEV ONLY — 인증 우회 일러스트 E2E 테스트 엔드포인트
// NODE_ENV=production이면 404. 운영에 노출되지 않음.
// 사진 업로드 → pet-uploads 버킷 → signed URL → 실제 generatePetIllustration 호출 →
// pet-illustrations 버킷 저장까지 실 파이프라인 그대로 검증.
//
// POST /api/pet-compat/dev-illustration (multipart/form-data)
//   field "photo": 이미지 파일 (필수)
//   field "name" / "species"(dog|cat) / "breed": 옵션

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generatePetIllustration } from "@/lib/pet-compat-illustration";

const BUCKET = "pet-uploads";

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const form = await request.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "잘못된 요청." }, { status: 400 });

    const file = form.get("photo");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "photo 파일 필요." }, { status: 400 });
    }

    const name = (form.get("name") as string) || "테스트";
    const species = ((form.get("species") as string) || "dog") as "dog" | "cat";
    const breed = (form.get("breed") as string) || undefined;

    const ext = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg";
    const path = `dev-test/${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const upload = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type || "image/jpeg", upsert: true });
    if (upload.error) {
      return NextResponse.json({ error: `업로드 실패: ${upload.error.message}` }, { status: 500 });
    }

    const { data: signed } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 10);
    if (!signed?.signedUrl) {
      return NextResponse.json({ error: "signed URL 생성 실패." }, { status: 500 });
    }

    const resultId = crypto.randomUUID();
    const startedAt = Date.now();
    const illust = await generatePetIllustration({
      photoUrl: signed.signedUrl,
      petName: name,
      petSpecies: species,
      petBreed: breed,
      resultId,
    });
    const elapsedMs = Date.now() - startedAt;

    return NextResponse.json({
      ok: illust.ok,
      elapsedMs,
      photoPath: path,
      ...(illust.ok
        ? { illustrationUrl: illust.illustrationUrl, illustrationPath: illust.illustrationPath }
        : { reason: illust.reason }),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unexpected" }, { status: 500 });
  }
}
