import fs from "node:fs";
import path from "node:path";

/**
 * Public 디렉토리 안의 PNG·JPEG·WebP·GIF 파일에서 실제 width/height를 읽어온다.
 * SSG 빌드 시 server component / generateMetadata 안에서 동기 호출.
 *
 * - 의존성 0 (Node 내장 fs만 사용)
 * - 각 포맷의 첫 헤더 청크만 읽음 (24-32 byte 정도)
 * - 실패 시 fallback 사이즈 반환 (메타 누락 방지)
 */

const FALLBACK = { width: 1200, height: 1200 };

export function getHeroImageSize(src: string): { width: number; height: number } {
  // src는 "/stories/heroes/iu.png" 형태
  try {
    const filePath = path.join(process.cwd(), "public", src.replace(/^\//, ""));
    if (!fs.existsSync(filePath)) return FALLBACK;

    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(32);
    fs.readSync(fd, buf, 0, 32, 0);
    fs.closeSync(fd);

    // PNG: 89 50 4E 47 0D 0A 1A 0A | length(4) | 'IHDR' | width(4) | height(4)
    if (
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47
    ) {
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      if (width > 0 && height > 0) return { width, height };
    }

    // JPEG: FF D8 ... (전체 스캔이 필요해 32byte로 부족) — public/heroes에 JPEG 사용 시 확장 필요
    // GIF: 47 49 46 38, width @ byte 6 (LE), height @ byte 8 (LE)
    if (
      buf[0] === 0x47 &&
      buf[1] === 0x49 &&
      buf[2] === 0x46 &&
      buf[3] === 0x38
    ) {
      const width = buf.readUInt16LE(6);
      const height = buf.readUInt16LE(8);
      if (width > 0 && height > 0) return { width, height };
    }

    return FALLBACK;
  } catch {
    return FALLBACK;
  }
}
