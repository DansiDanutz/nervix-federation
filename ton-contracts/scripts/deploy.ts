/**
 * Nervix Escrow — Standalone Deployment Script
 *
 * Usage:
 *   npx tsx scripts/deploy.ts
 *
 * Environment:
 *   DEPLOYER_MNEMONIC=word1 word2 ... word24
 *   TON_NETWORK=testnet (default) | mainnet
 *   TREASURY_ADDRESS=UQ... (optional, defaults to Nervix treasury)
 */

import { Address, Cell, contractAddress, toNano, beginCell, stateInit } from "@ton/core";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { TonClient, WalletContractV4, internal } from "@ton/ton";
import * as fs from "fs";
import * as path from "path";

async function main() {
  // ─── Config ─────────────────────────────────────────────
  const mnemonic = process.env.DEPLOYER_MNEMONIC;
  if (!mnemonic) {
    console.error("Error: Set DEPLOYER_MNEMONIC env var (24-word mnemonic)");
    console.error("  export DEPLOYER_MNEMONIC='word1 word2 ... word24'");
    process.exit(1);
  }

  const isTestnet = process.env.TON_NETWORK !== "mainnet";
  const endpoint = isTestnet
    ? "https://testnet.toncenter.com/api/v2/jsonRPC"
    : "https://toncenter.com/api/v2/jsonRPC";

  const treasuryAddr = process.env.TREASURY_ADDRESS
    || "UQCGdiA7kAGu0NU-LibhMOUAKvZ4LYnqbBl5-you_KtJ1_HA";

  console.log(`\nNetwork: ${isTestnet ? "testnet" : "mainnet"}`);
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Treasury: ${treasuryAddr}\n`);

  // ─── Load compiled contract ─────────────────────────────
  const compiledPath = path.join(__dirname, "..", "build", "NervixEscrow.compiled.json");
  if (!fs.existsSync(compiledPath)) {
    console.error("Error: Contract not compiled. Run `npx blueprint build NervixEscrow` first");
    process.exit(1);
  }
  const compiled = JSON.parse(fs.readFileSync(compiledPath, "utf-8"));
  const code = Cell.fromBoc(Buffer.from(compiled.hex, "hex"))[0];
  console.log(`Contract code hash: ${compiled.hash}`);

  // ─── Create wallet from mnemonic ────────────────────────
  const keyPair = await mnemonicToPrivateKey(mnemonic.split(" "));
  const wallet = WalletContractV4.create({
    publicKey: keyPair.publicKey,
    workchain: 0,
  });

  const client = new TonClient({ endpoint });
  const walletContract = client.open(wallet);
  const walletBalance = await retry(() => walletContract.getBalance());
  console.log(`Deployer: ${wallet.address}`);
  console.log(`Balance: ${Number(walletBalance) / 1e9} TON\n`);

  if (walletBalance < toNano("0.2")) {
    console.error("Error: Need at least 0.2 TON for deployment");
    if (isTestnet) {
      console.error("Get testnet TON from: https://t.me/testgiver_ton_bot");
    }
    process.exit(1);
  }

  // ─── Build initial data ─────────────────────────────────
  const ownerAddress = wallet.address;
  const treasuryAddress = Address.parse(treasuryAddr);

  const data = beginCell()
    .storeAddress(ownerAddress)
    .storeAddress(treasuryAddress)
    .storeUint(0, 1)       // is_paused = false
    .storeUint(0, 32)      // escrow_count = 0
    .storeUint(250, 16)    // task_fee_bps
    .storeUint(150, 16)    // settlement_fee_bps
    .storeUint(100, 16)    // transfer_fee_bps
    .storeUint(2000, 16)   // openclaw_discount_bps
    .storeCoins(0)          // total_fees_collected
    .storeDict(null)        // empty escrows dict
    .endCell();

  // ─── Compute contract address ───────────────────────────
  const init = { code, data };
  const addr = contractAddress(0, init);
  console.log(`Contract address: ${addr}`);
  console.log(`Explorer: https://${isTestnet ? "testnet." : ""}tonscan.org/address/${addr}\n`);

  // ─── Check if already deployed ──────────────────────────
  const existingState = await retry(() => client.getContractState(addr));
  if (existingState.state === "active") {
    console.log("Contract is already deployed at this address!");
    console.log(`\nNERVIX_ESCROW_ADDRESS=${addr}`);
    process.exit(0);
  }

  // ─── Deploy ─────────────────────────────────────────────
  console.log("Deploying...");
  const seqno = await retry(() => walletContract.getSeqno());

  await walletContract.sendTransfer({
    secretKey: keyPair.secretKey,
    seqno,
    messages: [
      internal({
        to: addr,
        value: toNano("0.1"),
        init,
        body: beginCell().endCell(),
      }),
    ],
  });

  // ─── Wait for deployment ────────────────────────────────
  console.log("Waiting for confirmation...");
  let attempts = 0;
  while (attempts < 30) {
    await sleep(3000);
    const state = await retry(() => client.getContractState(addr));
    if (state.state === "active") {
      console.log("\n╔══════════════════════════════════════════════╗");
      console.log("║     NERVIX ESCROW — Deployed Successfully     ║");
      console.log("╚══════════════════════════════════════════════╝\n");
      console.log(`  Contract: ${addr}`);
      console.log(`  Owner:    ${ownerAddress}`);
      console.log(`  Treasury: ${treasuryAddress}`);
      console.log(`  Network:  ${isTestnet ? "testnet" : "mainnet"}`);
      console.log(`  Explorer: https://${isTestnet ? "testnet." : ""}tonscan.org/address/${addr}`);
      console.log("");
      console.log("  ─── Add to .env ───");
      console.log(`  NERVIX_ESCROW_ADDRESS=${addr}`);
      console.log(`  TON_NETWORK=${isTestnet ? "testnet" : "mainnet"}`);
      console.log("");
      return;
    }
    attempts++;
    process.stdout.write(".");
  }

  console.error("\nTimeout waiting for deployment. Check explorer manually.");
  console.log(`Address: ${addr}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retry<T>(fn: () => Promise<T>, attempts = 5, delayMs = 3000): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e: any) {
      if (e?.response?.status === 429 && i < attempts - 1) {
        console.log(`  Rate limited, waiting ${delayMs / 1000}s...`);
        await sleep(delayMs);
        delayMs *= 2;
        continue;
      }
      throw e;
    }
  }
  throw new Error("Max retries exceeded");
}

main().catch((err) => {
  console.error("Deploy failed:", err);
  process.exit(1);
});
