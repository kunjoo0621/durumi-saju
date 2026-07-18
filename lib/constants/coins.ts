export const SAJU_COST = 10;   // 사주 분석 = 10알
export const BATTLE_COST = 20; // 배틀 = 20알
export const YEARLY_COST = 10; // 올해의 운세(세운) = 10알 (개인사주와 동일 — 5,800~7,500자 분량)
export const TODAY_COST = 5;   // 오늘의 운세 = 5알 (데일리 부담 없는 가격)
export const PET_COMPAT_COST = 20;        // 반려동물 궁합 정상가 (배틀과 동일 — 2 entity 분석)
export const PET_COMPAT_LAUNCH_COST = 10; // 출시 할인가 (기간 미표기, 추후 조용히 정상가 복귀)
export const MARRIAGE_COST = 10; // 결혼운/애정운 심층 검사 = 10알 (사주·yearly 동일, 풀 심층)
export const WEALTH_COST = 10; // 재물운 심층 검사 = 10알 (사주·yearly·결혼운 동일, 풀 심층)

export type CoinPackageId = 'basic' | 'popular' | 'value';

export type CoinPackageIcon = 'star' | 'fire' | 'diamond';

export interface CoinPackage {
  id: CoinPackageId;
  label: string;
  icon: CoinPackageIcon;
  price: number;        // 원
  coinAmount: number;    // 기본 알
  bonusAmount: number;   // 보너스 알
  totalEggs: number;     // 합계
  highlight?: boolean;   // "인기" 하이라이트
}

export function getPaymentConfig() {
  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID || "";
  const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY || "";
  const isMockPayment = process.env.NEXT_PUBLIC_USE_MOCK_PAYMENT === "true" || (!storeId && !channelKey);
  return { storeId, channelKey, isMockPayment };
}

export const COIN_PACKAGES: CoinPackage[] = [
  { id: 'basic',   label: '기본',  icon: 'star',    price: 1000, coinAmount: 10, bonusAmount: 0,  totalEggs: 10 },
  { id: 'popular', label: '인기',  icon: 'fire',    price: 3000, coinAmount: 30, bonusAmount: 5,  totalEggs: 35, highlight: true },
  { id: 'value',   label: '알뜰', icon: 'diamond', price: 5000, coinAmount: 50, bonusAmount: 12, totalEggs: 62 },
];
