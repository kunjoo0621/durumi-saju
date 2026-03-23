"use client";

import { Egg } from "@phosphor-icons/react";
import { COIN_PACKAGES } from "@/lib/constants/coins";
import { useCharge } from "@/hooks/useCharge";
import { ButtonSpinner } from "@/components/loading";
import CoinPackageCard from "@/components/CoinPackageCard";
import Modal, { ModalHeader, ModalDivider, ModalBody, ModalFooter } from "@/components/Modal";

interface ChargeBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  requiredCoins: number;
  currentBalance: number;
  onChargeComplete: (newBalance: number) => void;
}

export default function ChargeBottomSheet({
  isOpen,
  onClose,
  requiredCoins,
  currentBalance,
  onChargeComplete,
}: ChargeBottomSheetProps) {
  const { charge, charging, error } = useCharge({
    onSuccess: (data) => onChargeComplete(data.balance),
  });

  const shortage = Math.max(0, requiredCoins - currentBalance);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="bottomSheet"
      maxWidth="640px"
      ariaLabel="알 충전"
    >
      <ModalHeader
        title="알이 부족해!"
        subtitle={<span className="flex items-center gap-1"><Egg size={14} weight="fill" /> {shortage}알 더 필요해</span>}
        onClose={onClose}
      />

      <ModalDivider />

      <ModalBody className="space-y-3">
        {COIN_PACKAGES.map((pkg) => (
          <CoinPackageCard
            key={pkg.id}
            pkg={pkg}
            onClick={() => charge(pkg)}
            disabled={charging}
          />
        ))}

        {charging && (
          <div className="flex justify-center py-2">
            <ButtonSpinner message="충전 중..." />
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-background-tertiary px-4 py-3 text-[14px] text-text-secondary">
            {error}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <p className="text-caption text-text-tertiary text-center">
          충전한 알은 1년간 유효합니다
        </p>
      </ModalFooter>
    </Modal>
  );
}
