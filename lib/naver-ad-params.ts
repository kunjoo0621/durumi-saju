/**
 * 네이버 검색광고 `NaPm` 파라미터 파싱.
 *
 * ★왜 필요한가 — 네이버 검색광고는 랜딩 URL 의 쿼리스트링을 **자기네 NaPm 으로 바꿔치기**한다.
 * 소재에 `?utm_source=naver&utm_medium=cpc&utm_campaign=saju_grade` 를 걸어둬도 실제 도착은
 * `?NaPm=ct%3D...%7Cci%3D...%7Ctr%3Dsa%7Chk%3D...%7Cnacn%3D...` 이고 utm 은 전부 사라진다.
 *
 * 실측(2026-08-10, 운영자가 광고를 직접 클릭):
 *   설정: https://www.durumisaju.com/?utm_source=naver&utm_medium=cpc&utm_campaign=saju_grade
 *   도착: https://www.durumisaju.com/?NaPm=ct%3Dmslzjmun%7Cci%3DERed...%7Ctr%3Dsa%7Chk%3D...%7Cnacn%3D...
 *
 * 파급: 2026-08-03 이후 광고 유입이 utm 도 referrer 도 없이 들어와 **"직접 유입"으로
 * 오분류**됐다. 마지막 utm 보유 가입이 8/2 23:06 인 것과 시점이 맞는다. 하루 50~94건의
 * 광고 클릭이 통계에서 통째로 증발했고, "광고가 멈췄나"를 일주일간 헤맸다.
 *
 * 형식: URL 인코딩된 `key=value` 를 `|` 로 이은 문자열.
 *   ct  = 노출 위치 코드    ci = 클릭 식별자
 *   tr  = 유입 유형(sa=검색광고)  hk = 해시키
 *   nacn= 네이버가 부여한 캠페인 식별자
 */
export type NaverAdParams = {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string | null;
};

export function parseNaverAdParams(naPm: string | null | undefined): NaverAdParams | null {
  if (!naPm) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(naPm);
  } catch {
    // 잘못 인코딩된 값이 와도 추적 때문에 요청을 깨뜨리지 않는다.
    decoded = naPm;
  }

  const parts = new Map<string, string>();
  for (const seg of decoded.split("|")) {
    const i = seg.indexOf("=");
    if (i > 0) parts.set(seg.slice(0, i).trim(), seg.slice(i + 1).trim());
  }
  // key=value 가 하나도 없으면 NaPm 형식이 아니다 — 광고로 단정하지 않는다.
  if (parts.size === 0) return null;

  const tr = parts.get("tr");
  return {
    utm_source: "naver",
    // tr=sa 는 검색광고. 다른 값은 원문을 남겨 유형이 늘어나도 뭉개지지 않게 한다.
    utm_medium: tr === "sa" ? "cpc" : `naver_${tr || "unknown"}`,
    utm_campaign: parts.get("nacn") || null,
  };
}
