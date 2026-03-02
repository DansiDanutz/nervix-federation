#!/usr/bin/env node
/**
 * Enroll all 5 NERVIX team agents via the enrollment API.
 * Saves credentials to scripts/agent-credentials.json
 *
 * Usage: node scripts/enroll-team.mjs
 */
import nacl from "tweetnacl";
import { Buffer } from "buffer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_URL = "http://157.230.23.158";

const AGENTS = [
  {
    name: "nano",
    roles: ["coder", "orchestrator", "deploy"],
    description: "Agent Creator — builds and deploys NERVIX agents. Lead on nervix-federation.",
    hostname: "nano-droplet",
    region: "fra1",
  },
  {
    name: "dexter",
    roles: ["coder", "devops", "security"],
    description: "Senior Developer — Crawdbot + NERVIX backend. Security specialist.",
    hostname: "dexter-droplet",
    region: "fra1",
  },
  {
    name: "memo",
    roles: ["docs", "research", "orchestrator"],
    description: "Project Manager — MyWork Framework, n8n automations, documentation.",
    hostname: "memo-droplet",
    region: "fra1",
  },
  {
    name: "sienna",
    roles: ["data", "research"],
    description: "Crypto Analyst — ZmartyChat/smarty.me, trading bots, tokenomics.",
    hostname: "sienna-droplet",
    region: "fra1",
  },
  {
    name: "david",
    roles: ["orchestrator", "monitor"],
    description: "Orchestrator AI — runs on Dan's Mac Studio, manages all agents and tasks.",
    hostname: "mac-studio",
    region: "local",
  },
];

async function trpcMutation(procedure, input) {
  const res = await fetch(`${API_URL}/api/trpc/${procedure}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: input }),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(JSON.stringify(data.error));
  }
  return data.result?.data?.json;
}

async function enrollAgent(agent) {
  // 1. Generate Ed25519 keypair
  const keypair = nacl.sign.keyPair();
  const publicKeyHex = Buffer.from(keypair.publicKey).toString("hex");
  const privateKeyHex = Buffer.from(keypair.secretKey).toString("hex");

  console.log(`\n--- Enrolling: ${agent.name} ---`);
  console.log(`  Public key: ${publicKeyHex.slice(0, 16)}...`);

  // 2. Request enrollment challenge
  const challenge = await trpcMutation("enrollment.request", {
    agentName: agent.name,
    publicKey: publicKeyHex,
    roles: agent.roles,
    description: agent.description,
    hostname: agent.hostname,
    region: agent.region,
  });
  console.log(`  Challenge: ${challenge.challengeId}`);

  // 3. Sign the nonce
  const nonceBytes = new TextEncoder().encode(challenge.challengeNonce);
  const signature = nacl.sign.detached(nonceBytes, keypair.secretKey);
  const signatureHex = Buffer.from(signature).toString("hex");

  // 4. Verify enrollment
  const result = await trpcMutation("enrollment.verify", {
    challengeId: challenge.challengeId,
    signature: signatureHex,
  });
  console.log(`  Agent ID: ${result.agentId}`);
  console.log(`  Access Token: ${result.accessToken.slice(0, 10)}...`);
  console.log(`  ✅ Enrolled successfully!`);

  return {
    ...agent,
    agentId: result.agentId,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    sessionId: result.sessionId,
    publicKey: publicKeyHex,
    privateKey: privateKeyHex,
    enrolledAt: new Date().toISOString(),
  };
}

async function main() {
  console.log("=== NERVIX Team Enrollment ===");
  console.log(`API: ${API_URL}`);
  console.log(`Agents to enroll: ${AGENTS.length}`);

  const credentials = [];
  const errors = [];

  for (const agent of AGENTS) {
    try {
      const cred = await enrollAgent(agent);
      credentials.push(cred);
    } catch (err) {
      console.error(`  ❌ Failed to enroll ${agent.name}: ${err.message}`);
      errors.push({ name: agent.name, error: err.message });
    }
  }

  // Save credentials
  const outPath = path.join(__dirname, "agent-credentials.json");
  fs.writeFileSync(outPath, JSON.stringify(credentials, null, 2));
  console.log(`\n=== Results ===`);
  console.log(`Enrolled: ${credentials.length}/${AGENTS.length}`);
  if (errors.length > 0) {
    console.log(`Errors: ${errors.length}`);
    errors.forEach((e) => console.log(`  - ${e.name}: ${e.error}`));
  }
  console.log(`Credentials saved to: ${outPath}`);
}

main().catch(console.error);
