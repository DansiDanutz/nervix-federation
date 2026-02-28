/**
 * NervixEscrow — TypeScript wrapper for the FunC smart contract.
 * Used by Blueprint for deployment/testing, and can be imported
 * by the server for BOC payload generation.
 */

import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
  SendMode,
  toNano,
  TupleItemInt,
} from "@ton/core";

// ─── Op Codes (must match nervix_escrow.fc) ─────────────────
export const Opcodes = {
  createEscrow: 0x4e565831,
  fundEscrow: 0x4e565832,
  releaseEscrow: 0x4e565833,
  refundEscrow: 0x4e565834,
  disputeEscrow: 0x4e565835,
  pause: 0x4e565840,
  unpause: 0x4e565841,
  updateFees: 0x4e565842,
  withdraw: 0x4e565843,
  transferOwner: 0x4e565844,
} as const;

export const FeeTypes = {
  TASK: 0,
  SETTLEMENT: 1,
  TRANSFER: 2,
} as const;

export const EscrowStatus = {
  CREATED: 0,
  FUNDED: 1,
  RELEASED: 2,
  REFUNDED: 3,
  DISPUTED: 4,
} as const;

// ─── Config ─────────────────────────────────────────────────
export type NervixEscrowConfig = {
  owner: Address;
  treasury: Address;
  taskFeeBps?: number;
  settlementFeeBps?: number;
  transferFeeBps?: number;
  openClawDiscountBps?: number;
};

export function nervixEscrowConfigToCell(config: NervixEscrowConfig): Cell {
  return beginCell()
    .storeAddress(config.owner)
    .storeAddress(config.treasury)
    .storeUint(0, 1) // is_paused = false
    .storeUint(0, 32) // escrow_count = 0
    .storeUint(config.taskFeeBps ?? 250, 16)
    .storeUint(config.settlementFeeBps ?? 150, 16)
    .storeUint(config.transferFeeBps ?? 100, 16)
    .storeUint(config.openClawDiscountBps ?? 2000, 16)
    .storeCoins(0) // total_fees_collected = 0
    .storeDict(null) // empty escrows dict
    .endCell();
}

// ─── Contract Wrapper ───────────────────────────────────────
export class NervixEscrow implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromAddress(address: Address) {
    return new NervixEscrow(address);
  }

  static createFromConfig(
    config: NervixEscrowConfig,
    code: Cell,
    workchain = 0
  ) {
    const data = nervixEscrowConfigToCell(config);
    const init = { code, data };
    return new NervixEscrow(contractAddress(workchain, init), init);
  }

  // ─── Deploy ─────────────────────────────────────────────
  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  // ─── Create Escrow ──────────────────────────────────────
  async sendCreateEscrow(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      queryId?: number;
      feeType: number;
      amount: bigint;
      deadline: number;
      assignee: Address;
      taskHash: bigint;
      isOpenClaw: boolean;
    }
  ) {
    await provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(Opcodes.createEscrow, 32)
        .storeUint(opts.queryId ?? 0, 64)
        .storeUint(opts.feeType, 8)
        .storeCoins(opts.amount)
        .storeUint(opts.deadline, 32)
        .storeAddress(opts.assignee)
        .storeUint(opts.taskHash, 256)
        .storeUint(opts.isOpenClaw ? 1 : 0, 1)
        .endCell(),
    });
  }

  // ─── Fund Escrow ────────────────────────────────────────
  async sendFundEscrow(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      queryId?: number;
      escrowId: number;
    }
  ) {
    await provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(Opcodes.fundEscrow, 32)
        .storeUint(opts.queryId ?? 0, 64)
        .storeUint(opts.escrowId, 32)
        .endCell(),
    });
  }

  // ─── Release Escrow ─────────────────────────────────────
  async sendReleaseEscrow(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      queryId?: number;
      escrowId: number;
    }
  ) {
    await provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(Opcodes.releaseEscrow, 32)
        .storeUint(opts.queryId ?? 0, 64)
        .storeUint(opts.escrowId, 32)
        .endCell(),
    });
  }

  // ─── Refund Escrow ──────────────────────────────────────
  async sendRefundEscrow(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      queryId?: number;
      escrowId: number;
    }
  ) {
    await provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(Opcodes.refundEscrow, 32)
        .storeUint(opts.queryId ?? 0, 64)
        .storeUint(opts.escrowId, 32)
        .endCell(),
    });
  }

  // ─── Dispute Escrow ─────────────────────────────────────
  async sendDisputeEscrow(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      queryId?: number;
      escrowId: number;
    }
  ) {
    await provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(Opcodes.disputeEscrow, 32)
        .storeUint(opts.queryId ?? 0, 64)
        .storeUint(opts.escrowId, 32)
        .endCell(),
    });
  }

  // ─── Admin: Pause ───────────────────────────────────────
  async sendPause(
    provider: ContractProvider,
    via: Sender,
    value: bigint
  ) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(Opcodes.pause, 32)
        .storeUint(0, 64)
        .endCell(),
    });
  }

  // ─── Admin: Unpause ─────────────────────────────────────
  async sendUnpause(
    provider: ContractProvider,
    via: Sender,
    value: bigint
  ) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(Opcodes.unpause, 32)
        .storeUint(0, 64)
        .endCell(),
    });
  }

  // ─── Admin: Update Fees ─────────────────────────────────
  async sendUpdateFees(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      taskBps: number;
      settlementBps: number;
      transferBps: number;
      discountBps: number;
    }
  ) {
    await provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(Opcodes.updateFees, 32)
        .storeUint(0, 64)
        .storeUint(opts.taskBps, 16)
        .storeUint(opts.settlementBps, 16)
        .storeUint(opts.transferBps, 16)
        .storeUint(opts.discountBps, 16)
        .endCell(),
    });
  }

  // ─── Admin: Withdraw ────────────────────────────────────
  async sendWithdraw(
    provider: ContractProvider,
    via: Sender,
    opts: { value: bigint; amount: bigint }
  ) {
    await provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(Opcodes.withdraw, 32)
        .storeUint(0, 64)
        .storeCoins(opts.amount)
        .endCell(),
    });
  }

  // ─── Admin: Transfer Ownership ──────────────────────────
  async sendTransferOwner(
    provider: ContractProvider,
    via: Sender,
    opts: { value: bigint; newOwner: Address }
  ) {
    await provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(Opcodes.transferOwner, 32)
        .storeUint(0, 64)
        .storeAddress(opts.newOwner)
        .endCell(),
    });
  }

  // ─── Get Methods ────────────────────────────────────────

  async getContractInfo(provider: ContractProvider) {
    const result = await provider.get("get_contract_info", []);
    return {
      isPaused: result.stack.readNumber() !== 0,
      escrowCount: result.stack.readNumber(),
      taskFeeBps: result.stack.readNumber(),
      settlementFeeBps: result.stack.readNumber(),
      transferFeeBps: result.stack.readNumber(),
      totalFeesCollected: result.stack.readBigNumber(),
      treasuryBalance: result.stack.readBigNumber(),
    };
  }

  async getEscrow(provider: ContractProvider, escrowId: number) {
    const result = await provider.get("get_escrow", [
      { type: "int", value: BigInt(escrowId) } as TupleItemInt,
    ]);

    const statusNames = ["created", "funded", "released", "refunded", "disputed"];
    const feeTypeNames = ["task", "settlement", "transfer"];

    const statusCode = result.stack.readNumber();
    const feeTypeCode = result.stack.readNumber();

    return {
      status: statusNames[statusCode] ?? "unknown",
      statusCode,
      feeType: feeTypeNames[feeTypeCode] ?? "task",
      feeTypeCode,
      amount: result.stack.readBigNumber(),
      fundedAmount: result.stack.readBigNumber(),
      feeCollected: result.stack.readBigNumber(),
      createdAt: result.stack.readNumber(),
      deadline: result.stack.readNumber(),
      requesterAddress: result.stack.readAddress(),
      assigneeAddress: result.stack.readAddress(),
      taskHash: result.stack.readBigNumber(),
    };
  }

  async getTreasuryInfo(provider: ContractProvider) {
    const result = await provider.get("get_treasury_info", []);
    return {
      treasuryBalance: result.stack.readBigNumber(),
      totalFeesCollected: result.stack.readBigNumber(),
    };
  }

  async getOwner(provider: ContractProvider) {
    const result = await provider.get("get_owner", []);
    return result.stack.readAddress();
  }

  async getOpenClawDiscount(provider: ContractProvider) {
    const result = await provider.get("get_openclaw_discount", []);
    return result.stack.readNumber();
  }
}

// ─── Static BOC Builders (for server-side payload generation) ──

/**
 * Build a create_escrow message body as a base64 BOC string.
 * Used by ton-escrow.ts to generate payloads for TON Connect.
 */
export function buildCreateEscrowBoc(opts: {
  feeType: number;
  amount: bigint;
  deadline: number;
  assignee: Address;
  taskHash: bigint;
  isOpenClaw: boolean;
  queryId?: number;
}): string {
  const cell = beginCell()
    .storeUint(Opcodes.createEscrow, 32)
    .storeUint(opts.queryId ?? 0, 64)
    .storeUint(opts.feeType, 8)
    .storeCoins(opts.amount)
    .storeUint(opts.deadline, 32)
    .storeAddress(opts.assignee)
    .storeUint(opts.taskHash, 256)
    .storeUint(opts.isOpenClaw ? 1 : 0, 1)
    .endCell();
  return cell.toBoc().toString("base64");
}

export function buildFundEscrowBoc(opts: {
  escrowId: number;
  queryId?: number;
}): string {
  const cell = beginCell()
    .storeUint(Opcodes.fundEscrow, 32)
    .storeUint(opts.queryId ?? 0, 64)
    .storeUint(opts.escrowId, 32)
    .endCell();
  return cell.toBoc().toString("base64");
}

export function buildReleaseEscrowBoc(opts: {
  escrowId: number;
  queryId?: number;
}): string {
  const cell = beginCell()
    .storeUint(Opcodes.releaseEscrow, 32)
    .storeUint(opts.queryId ?? 0, 64)
    .storeUint(opts.escrowId, 32)
    .endCell();
  return cell.toBoc().toString("base64");
}
