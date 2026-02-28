/**
 * Nervix Escrow — Smart Contract Tests
 *
 * Run with: npx blueprint test
 */

import { Blockchain, SandboxContract, TreasuryContract } from "@ton/sandbox";
import { Cell, toNano, Address } from "@ton/core";
import { compile } from "@ton/blueprint";
import {
  NervixEscrow,
  EscrowStatus,
  FeeTypes,
} from "../wrappers/NervixEscrow";
import "@ton/test-utils";

describe("NervixEscrow", () => {
  let code: Cell;

  beforeAll(async () => {
    code = await compile("NervixEscrow");
  });

  let blockchain: Blockchain;
  let owner: SandboxContract<TreasuryContract>;
  let treasury: SandboxContract<TreasuryContract>;
  let requester: SandboxContract<TreasuryContract>;
  let assignee: SandboxContract<TreasuryContract>;
  let escrow: SandboxContract<NervixEscrow>;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    owner = await blockchain.treasury("owner");
    treasury = await blockchain.treasury("treasury");
    requester = await blockchain.treasury("requester");
    assignee = await blockchain.treasury("assignee");

    escrow = blockchain.openContract(
      NervixEscrow.createFromConfig(
        {
          owner: owner.address,
          treasury: treasury.address,
          taskFeeBps: 250,
          settlementFeeBps: 150,
          transferFeeBps: 100,
          openClawDiscountBps: 2000,
        },
        code
      )
    );

    const deployResult = await escrow.sendDeploy(
      owner.getSender(),
      toNano("0.05")
    );
    expect(deployResult.transactions).toHaveTransaction({
      from: owner.address,
      to: escrow.address,
      deploy: true,
      success: true,
    });
  });

  // ─── Deployment ─────────────────────────────────────────

  it("should deploy with correct initial state", async () => {
    const info = await escrow.getContractInfo();
    expect(info.isPaused).toBe(false);
    expect(info.escrowCount).toBe(0);
    expect(info.taskFeeBps).toBe(250);
    expect(info.settlementFeeBps).toBe(150);
    expect(info.transferFeeBps).toBe(100);
    expect(info.totalFeesCollected).toBe(0n);
  });

  it("should return correct owner", async () => {
    const contractOwner = await escrow.getOwner();
    expect(contractOwner.equals(owner.address)).toBe(true);
  });

  it("should return correct OpenClaw discount", async () => {
    const discount = await escrow.getOpenClawDiscount();
    expect(discount).toBe(2000);
  });

  // ─── Create Escrow ──────────────────────────────────────

  it("should create an escrow", async () => {
    const taskHash = BigInt(
      "0x" + Buffer.from("test-task-001").toString("hex").padEnd(64, "0")
    );
    const deadline = Math.floor(Date.now() / 1000) + 86400; // +24h

    const result = await escrow.sendCreateEscrow(
      requester.getSender(),
      {
        value: toNano("0.05"),
        feeType: FeeTypes.TASK,
        amount: toNano("10"),
        deadline,
        assignee: assignee.address,
        taskHash,
        isOpenClaw: false,
      }
    );

    expect(result.transactions).toHaveTransaction({
      from: requester.address,
      to: escrow.address,
      success: true,
    });

    const info = await escrow.getContractInfo();
    expect(info.escrowCount).toBe(1);

    const e = await escrow.getEscrow(0);
    expect(e.status).toBe("created");
    expect(e.feeType).toBe("task");
    expect(e.amount).toBe(toNano("10"));
    expect(e.requesterAddress.equals(requester.address)).toBe(true);
    expect(e.assigneeAddress.equals(assignee.address)).toBe(true);
  });

  // ─── Fund Escrow ────────────────────────────────────────

  it("should fund an escrow", async () => {
    const taskHash = BigInt("0x" + "aa".repeat(32));
    const deadline = Math.floor(Date.now() / 1000) + 86400;

    await escrow.sendCreateEscrow(requester.getSender(), {
      value: toNano("0.05"),
      feeType: FeeTypes.TASK,
      amount: toNano("10"),
      deadline,
      assignee: assignee.address,
      taskHash,
      isOpenClaw: false,
    });

    // Fund: send amount + gas (0.01 TON min_gas in contract)
    const result = await escrow.sendFundEscrow(requester.getSender(), {
      value: toNano("10.01"),
      escrowId: 0,
    });

    expect(result.transactions).toHaveTransaction({
      from: requester.address,
      to: escrow.address,
      success: true,
    });

    const e = await escrow.getEscrow(0);
    expect(e.status).toBe("funded");
    expect(e.feeCollected).toBeGreaterThan(0n);
  });

  // ─── Release Escrow ─────────────────────────────────────

  it("should release payment to assignee", async () => {
    const taskHash = BigInt("0x" + "bb".repeat(32));
    const deadline = Math.floor(Date.now() / 1000) + 86400;

    await escrow.sendCreateEscrow(requester.getSender(), {
      value: toNano("0.05"),
      feeType: FeeTypes.TASK,
      amount: toNano("10"),
      deadline,
      assignee: assignee.address,
      taskHash,
      isOpenClaw: false,
    });

    await escrow.sendFundEscrow(requester.getSender(), {
      value: toNano("10.01"),
      escrowId: 0,
    });

    const result = await escrow.sendReleaseEscrow(requester.getSender(), {
      value: toNano("0.05"),
      escrowId: 0,
    });

    expect(result.transactions).toHaveTransaction({
      from: escrow.address,
      to: assignee.address,
      success: true,
    });

    const e = await escrow.getEscrow(0);
    expect(e.status).toBe("released");
  });

  // ─── OpenClaw Discount ──────────────────────────────────

  it("should apply 20% fee discount for OpenClaw agents", async () => {
    const taskHash = BigInt("0x" + "cc".repeat(32));
    const deadline = Math.floor(Date.now() / 1000) + 86400;

    // Non-OpenClaw escrow
    await escrow.sendCreateEscrow(requester.getSender(), {
      value: toNano("0.05"),
      feeType: FeeTypes.TASK,
      amount: toNano("10"),
      deadline,
      assignee: assignee.address,
      taskHash,
      isOpenClaw: false,
    });
    await escrow.sendFundEscrow(requester.getSender(), {
      value: toNano("10.01"),
      escrowId: 0,
    });
    const normalEscrow = await escrow.getEscrow(0);

    // OpenClaw escrow
    await escrow.sendCreateEscrow(requester.getSender(), {
      value: toNano("0.05"),
      feeType: FeeTypes.TASK,
      amount: toNano("10"),
      deadline,
      assignee: assignee.address,
      taskHash: taskHash + 1n,
      isOpenClaw: true,
    });
    await escrow.sendFundEscrow(requester.getSender(), {
      value: toNano("10.01"),
      escrowId: 1,
    });
    const openClawEscrow = await escrow.getEscrow(1);

    // OpenClaw fee should be 20% less
    // Normal: 250 BPS = 0.25 TON on 10 TON
    // OpenClaw: 200 BPS = 0.20 TON on 10 TON
    expect(openClawEscrow.feeCollected).toBeLessThan(normalEscrow.feeCollected);
    expect(openClawEscrow.feeCollected).toBe(toNano("0.2")); // 200 BPS
    expect(normalEscrow.feeCollected).toBe(toNano("0.25")); // 250 BPS
  });

  // ─── Dispute ────────────────────────────────────────────

  it("should allow requester to dispute", async () => {
    const taskHash = BigInt("0x" + "dd".repeat(32));
    const deadline = Math.floor(Date.now() / 1000) + 86400;

    await escrow.sendCreateEscrow(requester.getSender(), {
      value: toNano("0.05"),
      feeType: FeeTypes.TASK,
      amount: toNano("5"),
      deadline,
      assignee: assignee.address,
      taskHash,
      isOpenClaw: false,
    });
    await escrow.sendFundEscrow(requester.getSender(), {
      value: toNano("5.01"),
      escrowId: 0,
    });

    const result = await escrow.sendDisputeEscrow(requester.getSender(), {
      value: toNano("0.05"),
      escrowId: 0,
    });

    expect(result.transactions).toHaveTransaction({
      from: requester.address,
      to: escrow.address,
      success: true,
    });

    const e = await escrow.getEscrow(0);
    expect(e.status).toBe("disputed");
  });

  // ─── Admin Controls ─────────────────────────────────────

  it("should pause and unpause", async () => {
    await escrow.sendPause(owner.getSender(), toNano("0.05"));
    let info = await escrow.getContractInfo();
    expect(info.isPaused).toBe(true);

    await escrow.sendUnpause(owner.getSender(), toNano("0.05"));
    info = await escrow.getContractInfo();
    expect(info.isPaused).toBe(false);
  });

  it("should reject pause from non-owner", async () => {
    const result = await escrow.sendPause(
      requester.getSender(),
      toNano("0.05")
    );
    expect(result.transactions).toHaveTransaction({
      from: requester.address,
      to: escrow.address,
      success: false,
      exitCode: 100, // error::not_owner
    });
  });

  it("should update fees", async () => {
    await escrow.sendUpdateFees(owner.getSender(), {
      value: toNano("0.05"),
      taskBps: 300,
      settlementBps: 200,
      transferBps: 150,
      discountBps: 2500,
    });

    const info = await escrow.getContractInfo();
    expect(info.taskFeeBps).toBe(300);
    expect(info.settlementFeeBps).toBe(200);
    expect(info.transferFeeBps).toBe(150);
  });

  // ─── Access Control ─────────────────────────────────────

  it("should reject release from non-requester", async () => {
    const taskHash = BigInt("0x" + "ee".repeat(32));
    const deadline = Math.floor(Date.now() / 1000) + 86400;

    await escrow.sendCreateEscrow(requester.getSender(), {
      value: toNano("0.05"),
      feeType: FeeTypes.TASK,
      amount: toNano("5"),
      deadline,
      assignee: assignee.address,
      taskHash,
      isOpenClaw: false,
    });
    await escrow.sendFundEscrow(requester.getSender(), {
      value: toNano("5.01"),
      escrowId: 0,
    });

    // Assignee tries to release — should fail
    const result = await escrow.sendReleaseEscrow(assignee.getSender(), {
      value: toNano("0.05"),
      escrowId: 0,
    });

    expect(result.transactions).toHaveTransaction({
      from: assignee.address,
      to: escrow.address,
      success: false,
      exitCode: 107, // error::not_requester
    });
  });

  it("should reject fund from non-requester", async () => {
    const taskHash = BigInt("0x" + "ff".repeat(32));
    const deadline = Math.floor(Date.now() / 1000) + 86400;

    await escrow.sendCreateEscrow(requester.getSender(), {
      value: toNano("0.05"),
      feeType: FeeTypes.TASK,
      amount: toNano("5"),
      deadline,
      assignee: assignee.address,
      taskHash,
      isOpenClaw: false,
    });

    // Assignee tries to fund — should fail
    const result = await escrow.sendFundEscrow(assignee.getSender(), {
      value: toNano("5.01"),
      escrowId: 0,
    });

    expect(result.transactions).toHaveTransaction({
      from: assignee.address,
      to: escrow.address,
      success: false,
      exitCode: 107, // error::not_requester
    });
  });

  // ─── Treasury Info ──────────────────────────────────────

  it("should track accumulated fees in treasury", async () => {
    const taskHash = BigInt("0x" + "ab".repeat(32));
    const deadline = Math.floor(Date.now() / 1000) + 86400;

    await escrow.sendCreateEscrow(requester.getSender(), {
      value: toNano("0.05"),
      feeType: FeeTypes.TASK,
      amount: toNano("10"),
      deadline,
      assignee: assignee.address,
      taskHash,
      isOpenClaw: false,
    });
    await escrow.sendFundEscrow(requester.getSender(), {
      value: toNano("10.01"),
      escrowId: 0,
    });

    const treasuryInfo = await escrow.getTreasuryInfo();
    expect(treasuryInfo.totalFeesCollected).toBe(toNano("0.25")); // 2.5% of 10 TON
  });
});
