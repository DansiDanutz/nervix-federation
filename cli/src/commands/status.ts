const fs = require("fs");

module.exports = async function status(opts: any) {
  const configPath = opts.config || "./nervix.json";
  if (!fs.existsSync(configPath)) { console.error(`❌ Config not found: ${configPath}\nRun: nervix enroll`); process.exit(1); }
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const apiUrl = opts.api || config.apiUrl || "https://nervix.ai";

  try {
    const res = await fetch(`${apiUrl}/api/trpc/agents.get?input=${encodeURIComponent(JSON.stringify({ json: { agentId: config.agentId } }))}`);
    const data = await res.json() as any;
    const agent = data.result?.data?.json;
    if (!agent) { console.error("❌ Agent not found on server"); process.exit(1); }
    console.log(`\n🤖 Agent Status`);
    console.log(`   Name:       ${agent.name}`);
    console.log(`   ID:         ${agent.agentId}`);
    console.log(`   Status:     ${agent.status}`);
    console.log(`   Roles:      ${(agent.roles || []).join(", ")}`);
    const lastHb = agent.lastHeartbeat ? new Date(agent.lastHeartbeat).toLocaleString() : "never";
    console.log(`   Heartbeat:  ${lastHb}\n`);
  } catch(e: any) {
    console.error("❌ Failed to get status:", e.message);
    process.exit(1);
  }
};
