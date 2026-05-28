/**
 * webhook 자동 충전 분기 로직 dry-run 시뮬레이션.
 *
 * 목적: 실결제 없이 webhook handler의 9개 시나리오에서 예상 동작 검증.
 * 한계: handler 코드와 별도로 분기 시뮬레이터를 작성해서 drift 위험 있음.
 *       진짜 동작 검증은 운영자 실결제 (WEBHOOK_AUTO_CHARGE_USER_IDS=<id> 후).
 */

// tsx ESM import에서 외부 modules와의 충돌로 인라인 정의 (lib/constants/coins.ts와 동기 유지)
const COIN_PACKAGES = [
  { id: "basic",   label: "기본", price: 1000, coinAmount: 10, bonusAmount: 0  },
  { id: "popular", label: "인기", price: 3000, coinAmount: 30, bonusAmount: 5  },
  { id: "value",   label: "알뜰", price: 5000, coinAmount: 50, bonusAmount: 12 },
] as const;

const ORDER_STATUS = {
  PENDING: "pending",
  PAID: "paid",
  CHARGED: "charged",
  FAILED: "failed",
  REFUNDED: "refunded",
} as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Scenario = {
  name: string;
  // webhook payload
  eventType: string;
  paymentId: string;
  // PortOne API response
  portoneStatus: string;
  portonePaidAmount: number;
  // charge_orders row (null = 없음)
  chargeOrder: {
    status: keyof typeof ORDER_STATUS extends infer K
      ? K extends string
        ? (typeof ORDER_STATUS)[K extends keyof typeof ORDER_STATUS ? K : never]
        : never
      : never;
    amount: number;
    user_id: string;
    package_id: string;
  } | null;
  // env
  allowlist: Set<string> | "*" | null;
  // 멱등 가드 — 이미 charged 라면 charge_coins 두번째 호출 시 charged=0 반환
  alreadyChargedByOther?: boolean;
  expectStatus: number;
  expectBody: object;
  expectChargeCoinsCalled: boolean;
};

function isAutoChargeEnabledFor(
  userId: string,
  allow: Set<string> | "*" | null,
): boolean {
  if (allow === null) return false;
  if (allow === "*") return true;
  return allow.has(userId);
}

/** webhook handler 분기 로직 재현 (route.ts 시뮬레이터) */
function simulateWebhookHandler(s: Scenario): {
  status: number;
  body: object;
  chargeCoinsCalled: boolean;
} {
  // 1. Transaction.Paid 외 이벤트는 무시
  if (s.eventType !== "Transaction.Paid") {
    return {
      status: 200,
      body: { ok: true, ignored: s.eventType },
      chargeCoinsCalled: false,
    };
  }

  // 2. PortOne API status PAID 검증
  if (s.portoneStatus !== "PAID") {
    return {
      status: 200,
      body: { ok: true, status: s.portoneStatus },
      chargeCoinsCalled: false,
    };
  }

  // 3. UUID 형식 가드
  if (!UUID_RE.test(s.paymentId)) {
    return {
      status: 200,
      body: { ok: true, ignored: "non-uuid paymentId" },
      chargeCoinsCalled: false,
    };
  }

  // 4. charge_orders 조회
  if (!s.chargeOrder) {
    return {
      status: 200,
      body: { ok: true, ignored: "no charge_order" },
      chargeCoinsCalled: false,
    };
  }

  // 5. amount 검증
  if (s.portonePaidAmount !== s.chargeOrder.amount) {
    return {
      status: 400,
      body: { error: "amount mismatch" },
      chargeCoinsCalled: false,
    };
  }

  // 6. failed/refunded 거부
  if (
    s.chargeOrder.status === "failed" ||
    s.chargeOrder.status === "refunded"
  ) {
    return {
      status: 200,
      body: { ok: true, ignored: `status ${s.chargeOrder.status}` },
      chargeCoinsCalled: false,
    };
  }

  // 7. charged 면 자동 충전 skip
  if (s.chargeOrder.status === "charged") {
    return {
      status: 200,
      body: { ok: true, alreadyCharged: true },
      chargeCoinsCalled: false,
    };
  }

  // 8. whitelist 게이트
  if (!isAutoChargeEnabledFor(s.chargeOrder.user_id, s.allowlist)) {
    return {
      status: 200,
      body: { ok: true, autoCharge: "disabled" },
      chargeCoinsCalled: false,
    };
  }

  // 9. package 검증
  const pkg = COIN_PACKAGES.find((p) => p.id === s.chargeOrder!.package_id);
  if (!pkg) {
    return {
      status: 400,
      body: { error: "unknown package" },
      chargeCoinsCalled: false,
    };
  }

  if (pkg.price !== s.chargeOrder.amount) {
    return {
      status: 400,
      body: { error: "package price mismatch" },
      chargeCoinsCalled: false,
    };
  }

  // 10. payment_transactions upsert (정상 가정)
  // 11. charge_coins RPC 호출
  const alreadyCharged = !!s.alreadyChargedByOther;
  return {
    status: 200,
    body: {
      ok: true,
      autoCharge: "executed",
      charged: alreadyCharged ? 0 : pkg.coinAmount,
      bonus: alreadyCharged ? 0 : pkg.bonusAmount ?? 0,
      alreadyCharged,
    },
    chargeCoinsCalled: true,
  };
}

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const OPERATOR_ID = "operator-uuid-test";
const FIRST_PKG = COIN_PACKAGES[0];

const scenarios: Scenario[] = [
  {
    name: "1. 정상 결제 (운영자 whitelist) — 자동 충전 실행",
    eventType: "Transaction.Paid",
    paymentId: VALID_UUID,
    portoneStatus: "PAID",
    portonePaidAmount: FIRST_PKG.price,
    chargeOrder: {
      status: "pending",
      amount: FIRST_PKG.price,
      user_id: OPERATOR_ID,
      package_id: FIRST_PKG.id,
    },
    allowlist: new Set([OPERATOR_ID]),
    expectStatus: 200,
    expectBody: { autoCharge: "executed" },
    expectChargeCoinsCalled: true,
  },
  {
    name: "2. 같은 webhook 재전송 (멱등) — charged=0 반환",
    eventType: "Transaction.Paid",
    paymentId: VALID_UUID,
    portoneStatus: "PAID",
    portonePaidAmount: FIRST_PKG.price,
    chargeOrder: {
      status: "paid",
      amount: FIRST_PKG.price,
      user_id: OPERATOR_ID,
      package_id: FIRST_PKG.id,
    },
    allowlist: new Set([OPERATOR_ID]),
    alreadyChargedByOther: true,
    expectStatus: 200,
    expectBody: { autoCharge: "executed", alreadyCharged: true },
    expectChargeCoinsCalled: true,
  },
  {
    name: "3. 이미 charged 상태 — RPC 호출 skip (조기 return)",
    eventType: "Transaction.Paid",
    paymentId: VALID_UUID,
    portoneStatus: "PAID",
    portonePaidAmount: FIRST_PKG.price,
    chargeOrder: {
      status: "charged",
      amount: FIRST_PKG.price,
      user_id: OPERATOR_ID,
      package_id: FIRST_PKG.id,
    },
    allowlist: new Set([OPERATOR_ID]),
    expectStatus: 200,
    expectBody: { alreadyCharged: true },
    expectChargeCoinsCalled: false,
  },
  {
    name: "4. failed 상태 — 자동 충전 거부",
    eventType: "Transaction.Paid",
    paymentId: VALID_UUID,
    portoneStatus: "PAID",
    portonePaidAmount: FIRST_PKG.price,
    chargeOrder: {
      status: "failed",
      amount: FIRST_PKG.price,
      user_id: OPERATOR_ID,
      package_id: FIRST_PKG.id,
    },
    allowlist: new Set([OPERATOR_ID]),
    expectStatus: 200,
    expectBody: { ignored: "status failed" },
    expectChargeCoinsCalled: false,
  },
  {
    name: "5. refunded 상태 — 자동 충전 거부",
    eventType: "Transaction.Paid",
    paymentId: VALID_UUID,
    portoneStatus: "PAID",
    portonePaidAmount: FIRST_PKG.price,
    chargeOrder: {
      status: "refunded",
      amount: FIRST_PKG.price,
      user_id: OPERATOR_ID,
      package_id: FIRST_PKG.id,
    },
    allowlist: new Set([OPERATOR_ID]),
    expectStatus: 200,
    expectBody: { ignored: "status refunded" },
    expectChargeCoinsCalled: false,
  },
  {
    name: "6. whitelist 미적용 — paid 마킹만, RPC 호출 X",
    eventType: "Transaction.Paid",
    paymentId: VALID_UUID,
    portoneStatus: "PAID",
    portonePaidAmount: FIRST_PKG.price,
    chargeOrder: {
      status: "pending",
      amount: FIRST_PKG.price,
      user_id: "other-user-uuid",
      package_id: FIRST_PKG.id,
    },
    allowlist: new Set([OPERATOR_ID]),
    expectStatus: 200,
    expectBody: { autoCharge: "disabled" },
    expectChargeCoinsCalled: false,
  },
  {
    name: "7. amount 불일치 — 거부 (결제 보안)",
    eventType: "Transaction.Paid",
    paymentId: VALID_UUID,
    portoneStatus: "PAID",
    portonePaidAmount: 100,
    chargeOrder: {
      status: "pending",
      amount: FIRST_PKG.price,
      user_id: OPERATOR_ID,
      package_id: FIRST_PKG.id,
    },
    allowlist: new Set([OPERATOR_ID]),
    expectStatus: 400,
    expectBody: { error: "amount mismatch" },
    expectChargeCoinsCalled: false,
  },
  {
    name: "8. UUID 아닌 paymentId — ignored",
    eventType: "Transaction.Paid",
    paymentId: "charge_1234567890",
    portoneStatus: "PAID",
    portonePaidAmount: FIRST_PKG.price,
    chargeOrder: null,
    allowlist: new Set([OPERATOR_ID]),
    expectStatus: 200,
    expectBody: { ignored: "non-uuid paymentId" },
    expectChargeCoinsCalled: false,
  },
  {
    name: "9. charge_orders 없음 (일반 사용자 redirect 흐름) — ignored",
    eventType: "Transaction.Paid",
    paymentId: VALID_UUID,
    portoneStatus: "PAID",
    portonePaidAmount: FIRST_PKG.price,
    chargeOrder: null,
    allowlist: new Set([OPERATOR_ID]),
    expectStatus: 200,
    expectBody: { ignored: "no charge_order" },
    expectChargeCoinsCalled: false,
  },
  {
    name: "10. allowlist=null (관찰 모드) — paid 마킹만, RPC X",
    eventType: "Transaction.Paid",
    paymentId: VALID_UUID,
    portoneStatus: "PAID",
    portonePaidAmount: FIRST_PKG.price,
    chargeOrder: {
      status: "pending",
      amount: FIRST_PKG.price,
      user_id: OPERATOR_ID,
      package_id: FIRST_PKG.id,
    },
    allowlist: null,
    expectStatus: 200,
    expectBody: { autoCharge: "disabled" },
    expectChargeCoinsCalled: false,
  },
  {
    name: "11. allowlist=* (전체 활성화) — 임의 유저 자동 충전",
    eventType: "Transaction.Paid",
    paymentId: VALID_UUID,
    portoneStatus: "PAID",
    portonePaidAmount: FIRST_PKG.price,
    chargeOrder: {
      status: "pending",
      amount: FIRST_PKG.price,
      user_id: "random-user-uuid",
      package_id: FIRST_PKG.id,
    },
    allowlist: "*",
    expectStatus: 200,
    expectBody: { autoCharge: "executed" },
    expectChargeCoinsCalled: true,
  },
];

function partialMatch(actual: any, expected: any): boolean {
  for (const key of Object.keys(expected)) {
    if (actual[key] !== expected[key]) return false;
  }
  return true;
}

console.log(`\nwebhook 자동 충전 dry-run — ${scenarios.length}개 시나리오\n`);

let passed = 0;
let failed = 0;

for (const s of scenarios) {
  const result = simulateWebhookHandler(s);
  const statusOk = result.status === s.expectStatus;
  const bodyOk = partialMatch(result.body, s.expectBody);
  const rpcOk = result.chargeCoinsCalled === s.expectChargeCoinsCalled;
  const ok = statusOk && bodyOk && rpcOk;

  if (ok) {
    passed++;
    console.log(`✓ ${s.name}`);
    console.log(
      `  → status=${result.status} body=${JSON.stringify(result.body)} RPC=${result.chargeCoinsCalled}`,
    );
  } else {
    failed++;
    console.log(`✗ ${s.name}`);
    console.log(
      `  expect status=${s.expectStatus} body⊇${JSON.stringify(s.expectBody)} RPC=${s.expectChargeCoinsCalled}`,
    );
    console.log(
      `  actual status=${result.status} body=${JSON.stringify(result.body)} RPC=${result.chargeCoinsCalled}`,
    );
  }
}

console.log(`\n결과: ${passed}/${scenarios.length} 통과, ${failed} 실패\n`);

if (failed > 0) process.exit(1);
