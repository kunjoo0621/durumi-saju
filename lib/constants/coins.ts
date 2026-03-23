export const SAJU_COST = 10;   // 사주 분석 = 10알
export const BATTLE_COST = 20; // 배틀 = 20알

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
