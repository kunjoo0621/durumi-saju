// 펫 사진 업로드 API
// POST /api/pet-compat/upload-photo (multipart/form-data, field: "photo")
// 회원 전용 + 5MB 이하 + jpg/png/webp만 + Supabase Storage pet-uploads 버킷
//
// 응답: { photoUrl: string }  ← 서명된 URL 또는 공개 URL (analyze에서 사용)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseUserId } from "@/lib/server/user";

const MAX_SIZE = 5 * 1024 * 1024;             // 5MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const BUCKET = "pet-uploads";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getSupabaseUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "로그인이 필요해." }, { status: 401 });
    }

    const form = await request.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ error: "잘못된 요청." }, { status: 400 });
    }

    const file = form.get("photo");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "사진 파일이 필요해." }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "사진은 5MB 이하만 가능." }, { status: 413 });
    }

    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: "jpg/png/webp만 가능." }, { status: 415 });
    }

    const ext = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg";
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const upload = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (upload.error) {
      console.error("[PET_PHOTO_UPLOAD] storage error", upload.error.message);
      return NextResponse.json({ error: "사진 업로드 실패." }, { status: 500 });
    }

    // 일러스트 생성은 서버에서 pet-uploads 버킷에 직접 접근 (service_role).
    // 클라이언트는 path만 가지고 있다가 intake/session payload에 포함.
    const { data: signed } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60);   // 1시간 유효 — 분석 호출 시점까지

    return NextResponse.json({
      photoPath: path,                    // Storage 경로 (DB 저장용)
      photoUrl: signed?.signedUrl || "",  // 임시 URL (미리보기용)
    });
  } catch (error: any) {
    console.error("[PET_PHOTO_UPLOAD] unexpected", error?.message || error);
    return NextResponse.json({ error: "예상치 못한 오류." }, { status: 500 });
  }
}
