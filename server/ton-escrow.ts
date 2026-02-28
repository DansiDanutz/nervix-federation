/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║       NERVIX TON ESCROW — Server-Side Integration Service     ║
 * ║                                                               ║
 * ║  Provides backend methods for interacting with the deployed   ║
 * ║  Nervix Escrow smart contract on TON blockchain.              ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

import { ENV } from "./_core/env";

// ─── Contract Configuration ────────────────────────────────────
// These will be set via environment variables after deployment
const ESCROW_CONTRACT_ADDRESS = process.env.NERVIX_ESCROW_ADDRESS || "";
const TON_API_BASE = "https://toncenter.com/api/v2";
const TON_TESTNET_API_BASE = "https://testnet.toncenter.com/api/v2";

const IS_TESTNET = process.env.TON_NETWORK !== "mainnet";
const API_BASE = IS_TESTNET ? TON_TESTNET_API_BASE : TON_API_BASE;

// ─── Fee Constants (must match smart contract) ─────────────────
export const FEE_TYPES = {
  TASK: 0,
  SETTLEMENT: 1,
  TRANSFER: 2,
} as const;

export const DEFAULT_FEES = {
  TASK_BPS: 250, // 2.5%
  SETTLEMENT_BPS: 150, // 1.5%
  TRANSFER_BPS: 100, // 1.0%
  OPENCLAW_DISCOUNT_BPS: 2000, // 20%
} as const;

// ─── Types ─────────────────────────────────────────────────────
export interface EscrowInfo {
  contractAddress: string;
  network: string;
  isPaused: boolean;
  escrowCount: number;
  taskFeeBps: number;
  settlementFeeBps: number;
  transferFeeBps: number;
  totalFeesCollected: string;
  treasuryBalance: string;
}

export interface FeePreview {
  amount: string;
  feeType: string;
  isOpenClaw: boolean;
  fee: string;
  payout: string;
  effectiveFeeBps: number;
}

export interface EscrowTransaction {
  escrowId: number;
  status: string;
  feeType: string;
  amount: string;
  fundedAmount: string;
  feeCollected: string;
  requesterAddress: string;
  assigneeAddress: string;
  taskHash: string;
  createdAt: number;
  deadline: number;
}

// ─── Fee Calculation (mirrors smart contract logic) ────────────
export function calculateFee(
  amountNano: bigint,
  feeBps: number,
  isOpenClaw: boolean
): { fee: bigint; payout: bigint; effectiveBps: number } {
  let effectiveBps = feeBps;
  if (isOpenClaw) {
    effectiveBps = Math.floor(
      (feeBps * (10000 - DEFAULT_FEES.OPENCLAW_DISCOUNT_BPS)) / 10000
    );
  }
  const fee = (amountNano * BigInt(effectiveBps)) / BigInt(10000);
  const payout = amountNano - fee;
  return { fee, payout, effectiveBps };
}

export function getFeeBpsForType(feeType: number): number {
  switch (feeType) {
    case FEE_TYPES.TASK:
      return DEFAULT_FEES.TASK_BPS;
    case FEE_TYPES.SETTLEMENT:
      return DEFAULT_FEES.SETTLEMENT_BPS;
    case FEE_TYPES.TRANSFER:
      return DEFAULT_FEES.TRANSFER_BPS;
    default:
      return DEFAULT_FEES.TASK_BPS;
  }
}

// ─── Preview Fee (no blockchain call needed) ───────────────────
export function previewFee(
  amountTON: number,
  feeType: number,
  isOpenClaw: boolean
): FeePreview {
  const amountNano = BigInt(Math.floor(amountTON * 1e9));
  const feeBps = getFeeBpsForType(feeType);
  const { fee, payout, effectiveBps } = calculateFee(
    amountNano,
    feeBps,
    isOpenClaw
  );

  const feeTypeNames = ["task", "settlement", "transfer"];

  return {
    amount: `${amountTON} TON`,
    feeType: feeTypeNames[feeType] || "task",
    isOpenClaw,
    fee: `${Number(fee) / 1e9} TON`,
    payout: `${Number(payout) / 1e9} TON`,
    effectiveFeeBps: effectiveBps,
  };
}

// ─── Generate TON Transaction Payload ──────────────────────────
// These functions generate the message body that the frontend
// sends via TON Connect to interact with the smart contract.

export function generateCreateEscrowPayload(opts: {
  feeType: number;
  amountNano: string;
  deadline: number;
  assigneeAddress: string;
  taskHash: string;
}): {
  to: string;
  value: string;
  payload: string;
  description: string;
} {
  // The frontend will use TON Connect to send this transaction
  // The payload is a base64-encoded BOC containing the message body
  return {
    to: ESCROW_CONTRACT_ADDRESS,
    value: "50000000", // 0.05 TON for gas
    payload: JSON.stringify({
      op: "0x4e565831",
      feeType: opts.feeType,
      amount: opts.amountNano,
      deadline: opts.deadline,
      assigneeAddress: opts.assigneeAddress,
      taskHash: opts.taskHash,
    }),
    description: `Create escrow for ${Number(BigInt(opts.amountNano)) / 1e9} TON`,
  };
}

export function generateFundEscrowPayload(opts: {
  escrowId: number;
  amountNano: string;
}): {
  to: string;
  value: string;
  payload: string;
  description: string;
} {
  const gasBuffer = BigInt("15000000"); // 0.015 TON gas
  const totalValue = BigInt(opts.amountNano) + gasBuffer;

  return {
    to: ESCROW_CONTRACT_ADDRESS,
    value: totalValue.toString(),
    payload: JSON.stringify({
      op: "0x4e565832",
      escrowId: opts.escrowId,
    }),
    description: `Fund escrow #${opts.escrowId} with ${Number(BigInt(opts.amountNano)) / 1e9} TON`,
  };
}

export function generateReleasePayload(opts: {
  escrowId: number;
}): {
  to: string;
  value: string;
  payload: string;
  description: string;
} {
  return {
    to: ESCROW_CONTRACT_ADDRESS,
    value: "50000000", // 0.05 TON for gas
    payload: JSON.stringify({
      op: "0x4e565833",
      escrowId: opts.escrowId,
    }),
    description: `Release payment for escrow #${opts.escrowId}`,
  };
}

// ─── Contract Info (read from TON API) ─────────────────────────
export async function getContractInfo(): Promise<EscrowInfo | null> {
  if (!ESCROW_CONTRACT_ADDRESS) {
    return null;
  }

  try {
    // Use TON Center API to call get method
    const response = await fetch(
      `${API_BASE}/runGetMethod?address=${ESCROW_CONTRACT_ADDRESS}&method=get_contract_info&stack=[]`
    );
    const data = await response.json();

    if (!data.ok) {
      console.warn("[TON Escrow] Failed to get contract info:", data.error);
      return null;
    }

    const stack = data.result?.stack || [];
    return {
      contractAddress: ESCROW_CONTRACT_ADDRESS,
      network: IS_TESTNET ? "testnet" : "mainnet",
      isPaused: parseInt(stack[0]?.[1] || "0", 16) !== 0,
      escrowCount: parseInt(stack[1]?.[1] || "0", 16),
      taskFeeBps: parseInt(stack[2]?.[1] || "0", 16),
      settlementFeeBps: parseInt(stack[3]?.[1] || "0", 16),
      transferFeeBps: parseInt(stack[4]?.[1] || "0", 16),
      totalFeesCollected: stack[5]?.[1] || "0",
      treasuryBalance: stack[6]?.[1] || "0",
    };
  } catch (error) {
    console.error("[TON Escrow] Error fetching contract info:", error);
    return null;
  }
}

// ─── Escrow Status Lookup ──────────────────────────────────────
export async function getEscrowById(
  escrowId: number
): Promise<EscrowTransaction | null> {
  if (!ESCROW_CONTRACT_ADDRESS) {
    return null;
  }

  try {
    const stackParam = encodeURIComponent(
      JSON.stringify([["num", `0x${escrowId.toString(16)}`]])
    );
    const response = await fetch(
      `${API_BASE}/runGetMethod?address=${ESCROW_CONTRACT_ADDRESS}&method=get_escrow&stack=${stackParam}`
    );
    const data = await response.json();

    if (!data.ok) {
      return null;
    }

    const stack = data.result?.stack || [];
    const statusNames = [
      "created",
      "funded",
      "released",
      "refunded",
      "disputed",
    ];
    const feeTypeNames = ["task", "settlement", "transfer"];

    const statusCode = parseInt(stack[0]?.[1] || "0", 16);
    const feeTypeCode = parseInt(stack[1]?.[1] || "0", 16);

    return {
      escrowId,
      status: statusNames[statusCode] || "unknown",
      feeType: feeTypeNames[feeTypeCode] || "task",
      amount: stack[2]?.[1] || "0",
      fundedAmount: stack[3]?.[1] || "0",
      feeCollected: stack[4]?.[1] || "0",
      requesterAddress: stack[7]?.[1] || "",
      assigneeAddress: stack[8]?.[1] || "",
      taskHash: stack[9]?.[1] || "",
      createdAt: parseInt(stack[5]?.[1] || "0", 16),
      deadline: parseInt(stack[6]?.[1] || "0", 16),
    };
  } catch (error) {
    console.error("[TON Escrow] Error fetching escrow:", error);
    return null;
  }
}

// ─── Treasury Wallet Live Balance ─────────────────────────────
export async function getTreasuryWalletBalance(walletAddress: string): Promise<{
  balanceNano: string;
  balanceTON: string;
  lastTransactionLt: string;
  lastTransactionHash: string;
  status: string;
} | null> {
  if (!walletAddress) return null;

  try {
    const response = await fetch(
      `${API_BASE}/getAddressBalance?address=${encodeURIComponent(walletAddress)}`
    );
    const data = await response.json();

    if (!data.ok) {
      console.warn("[TON Escrow] Failed to get wallet balance:", data.error);
      return null;
    }

    const balanceNano = data.result || "0";
    const balanceTON = (Number(balanceNano) / 1e9).toFixed(4);

    // Also fetch address info for status and last tx
    const infoResponse = await fetch(
      `${API_BASE}/getAddressInformation?address=${encodeURIComponent(walletAddress)}`
    );
    const infoData = await infoResponse.json();

    return {
      balanceNano,
      balanceTON,
      lastTransactionLt: infoData.ok ? (infoData.result?.last_transaction_id?.lt || "0") : "0",
      lastTransactionHash: infoData.ok ? (infoData.result?.last_transaction_id?.hash || "") : "",
      status: infoData.ok ? (infoData.result?.state || "unknown") : "unknown",
    };
  } catch (error) {
    console.error("[TON Escrow] Error fetching wallet balance:", error);
    return null;
  }
}

// ─── Treasury Info ─────────────────────────────────────────────
export async function getTreasuryInfo(): Promise<{
  treasuryBalance: string;
  totalFeesCollected: string;
} | null> {
  if (!ESCROW_CONTRACT_ADDRESS) {
    return null;
  }

  try {
    const response = await fetch(
      `${API_BASE}/runGetMethod?address=${ESCROW_CONTRACT_ADDRESS}&method=get_treasury_info&stack=[]`
    );
    const data = await response.json();

    if (!data.ok) {
      return null;
    }

    const stack = data.result?.stack || [];
    return {
      treasuryBalance: stack[0]?.[1] || "0",
      totalFeesCollected: stack[1]?.[1] || "0",
    };
  } catch (error) {
    console.error("[TON Escrow] Error fetching treasury info:", error);
    return null;
  }
}
