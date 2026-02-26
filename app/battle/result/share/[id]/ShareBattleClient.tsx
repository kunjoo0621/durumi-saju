"use client";

import BattleResultView from "@/components/battle/BattleResultView";
import BattleShareCTA from "@/components/battle/BattleShareCTA";
import type { BattleResult } from "@/types/battle";

type Props = {
  result: BattleResult;
};

export default function ShareBattleClient({ result }: Props) {
  return (
    <BattleResultView
      result={result}
      headerBackTo="/"
      footer={<BattleShareCTA />}
    />
  );
}
