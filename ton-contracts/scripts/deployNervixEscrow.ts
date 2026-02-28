/**
 * Nervix Escrow — Deployment Script for TON Testnet/Mainnet
 *
 * Usage:
 *   npx blueprint run deployNervixEscrow
 *
 * Requires:
 *   - TON wallet mnemonic (prompted interactively)
 *   - TREASURY_ADDRESS env var or defaults to deployer wallet
 */

import { toNano, Address } from "@ton/core";
import { compile, NetworkProvider } from "@ton/blueprint";
import { NervixEscrow } from "../wrappers/NervixEscrow";

export async function run(provider: NetworkProvider) {
  const ownerAddress = provider.sender().address;
  if (!ownerAddress) {
    throw new Error("Cannot determine deployer address");
  }

  // Treasury defaults to deployer if not specified
  const treasuryRaw =
    process.env.TREASURY_ADDRESS ||
    "UQCGdiA7kAGu0NU-LibhMOUAKvZ4LYnqbBl5-you_KtJ1_HA";
  const treasuryAddress = Address.parse(treasuryRaw);

  const nervixEscrow = provider.open(
    NervixEscrow.createFromConfig(
      {
        owner: ownerAddress,
        treasury: treasuryAddress,
        taskFeeBps: 250, // 2.5%
        settlementFeeBps: 150, // 1.5%
        transferFeeBps: 100, // 1.0%
        openClawDiscountBps: 2000, // 20%
      },
      await compile("NervixEscrow")
    )
  );

  await nervixEscrow.sendDeploy(provider.sender(), toNano("0.1"));

  await provider.waitForDeploy(nervixEscrow.address);

  // Verify deployment
  const info = await nervixEscrow.getContractInfo();

  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║     NERVIX ESCROW — Deployed Successfully     ║");
  console.log("╚══════════════════════════════════════════════╝\n");
  console.log(`  Contract: ${nervixEscrow.address}`);
  console.log(`  Owner:    ${ownerAddress}`);
  console.log(`  Treasury: ${treasuryAddress}`);
  console.log(`  Network:  ${provider.network()}`);
  console.log(`  Paused:   ${info.isPaused}`);
  console.log(`  Task Fee: ${info.taskFeeBps} BPS (${info.taskFeeBps / 100}%)`);
  console.log(
    `  Settle:   ${info.settlementFeeBps} BPS (${info.settlementFeeBps / 100}%)`
  );
  console.log(
    `  Transfer: ${info.transferFeeBps} BPS (${info.transferFeeBps / 100}%)`
  );
  console.log("");
  console.log("  ─── Add to .env ───");
  console.log(`  NERVIX_ESCROW_ADDRESS=${nervixEscrow.address}`);
  console.log(`  TON_NETWORK=${provider.network()}`);
  console.log("");
}
