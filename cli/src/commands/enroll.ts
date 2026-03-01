const fs = require("fs");
const readline = require("readline");
const nacl = require("tweetnacl");

const VALID_ROLES = ["devops", "coder", "qa", "security", "data", "deploy", "monitor", "research", "docs", "orchestrator"];

function ask(rl: any, q: string): Promise<string> {
  return new Promise(resolve => rl.question(q, resolve));
}

async function trpcCall(apiUrl: string, proc: string, input: any) {
  const url = `${apiUrl}/api/trpc/${proc}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: input }),
  });
  const data = await res.json() as any;
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.result?.data?.json ?? data.result?.data;
}

module.exports = async function enroll(opts: any) {
  const apiUrl = opts.api || "https://nervix.ai";
  const configPath = opts.config || "./nervix.json";

  console.log("\n🤖 NERVIX Agent Enrollment\n");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const agentName = opts.name || await ask(rl, "Agent name: ");
  const rolesInput = opts.roles || await ask(rl, `Roles (comma-separated from: ${VALID_ROLES.join(", ")}): `);
  const roles = rolesInput.split(",").map((r: string) => r.trim()).filter((r: string) => VALID_ROLES.includes(r));
  if (roles.length === 0) { console.error("❌ Invalid roles"); rl.close(); process.exit(1); }
  const description = opts.description || await ask(rl, "Description (optional): ");
  const webhookUrl = opts.webhook || await ask(rl, "Webhook URL (optional, press Enter to skip): ");
  rl.close();

  console.log("\n🔑 Generating ed25519 keypair...");
  const keypair = nacl.sign.newKeyPair();
  const publicKey = Buffer.from(keypair.publicKey).toString("hex");
  const privateKey = Buffer.from(keypair.secretKey).toString("hex");

  console.log(`   Public key: ${publicKey.substring(0, 32)}...`);

  console.log("\n📡 Requesting enrollment challenge...");
  let challenge: any;
  try {
    challenge = await trpcCall(apiUrl, "enrollment.request", {
      agentName,
      publicKey,
      roles,
      description: description || undefined,
      webhookUrl: webhookUrl || undefined,
    });
  } catch(e: any) {
    console.error("❌ Enrollment request failed:", e.message);
    process.exit(1);
  }

  console.log("✅ Challenge received. Signing...");
  const nonceBytes = new TextEncoder().encode(challenge.challengeNonce);
  const signature = nacl.sign.detached(nonceBytes, keypair.secretKey);
  const signatureHex = Buffer.from(signature).toString("hex");

  console.log("📡 Verifying signature...");
  let result: any;
  try {
    result = await trpcCall(apiUrl, "enrollment.verify", {
      challengeId: challenge.challengeId,
      signature: signatureHex,
    });
  } catch(e: any) {
    console.error("❌ Enrollment verify failed:", e.message);
    process.exit(1);
  }

  const config = {
    agentId: result.agentId,
    agentName,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    publicKey,
    privateKey,
    apiUrl,
    enrolledAt: new Date().toISOString(),
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`\n🎉 Agent enrolled successfully!`);
  console.log(`   Agent ID: ${result.agentId}`);
  console.log(`   Config saved to: ${configPath}`);
  console.log(`\n🚀 Start your agent:\n   nervix start --config ${configPath}\n`);
};
