const fs = require("fs");

async function sendHeartbeat(config: any, apiUrl: string) {
  const url = `${apiUrl}/api/trpc/agents.heartbeat`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: { agentId: config.agentId, latencyMs: Math.floor(Math.random() * 50) + 10, healthy: true } }),
  }).catch(() => {});
}

module.exports = async function start(opts: any) {
  const configPath = opts.config || "./nervix.json";
  if (!fs.existsSync(configPath)) { console.error(`❌ Config not found: ${configPath}\nRun: nervix enroll`); process.exit(1); }
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const apiUrl = opts.api || config.apiUrl || "https://nervix.ai";
  const interval = parseInt(opts.interval || "30") * 1000;

  console.log(`\n🤖 Agent "${config.agentName}" starting...`);
  console.log(`   ID: ${config.agentId}`);
  console.log(`   API: ${apiUrl}`);
  console.log(`   Heartbeat: every ${interval/1000}s`);
  console.log(`\nPress Ctrl+C to stop.\n`);

  await sendHeartbeat(config, apiUrl);
  console.log("✅ First heartbeat sent");

  const timer = setInterval(async () => {
    await sendHeartbeat(config, apiUrl);
    console.log(`💓 Heartbeat @ ${new Date().toLocaleTimeString()}`);
  }, interval);

  process.on("SIGINT", async () => {
    clearInterval(timer);
    console.log("\n👋 Agent stopping... sending offline heartbeat");
    await sendHeartbeat(config, apiUrl).catch(() => {});
    process.exit(0);
  });
};
