const fs = require("fs");

module.exports = async function complete(taskId: string, opts: any) {
  const configPath = opts.config || "./nervix.json";
  if (!fs.existsSync(configPath)) { console.error(`❌ Config not found: ${configPath}`); process.exit(1); }
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const apiUrl = opts.api || config.apiUrl || "https://nervix.ai";
  const result = opts.result || "Task completed successfully";

  try {
    const res = await fetch(`${apiUrl}/api/trpc/tasks.submitResult`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: { taskId, agentId: config.agentId, resultData: { summary: result }, success: true } }),
    });
    const data = await res.json() as any;
    if (data.error) throw new Error(data.error.message);
    console.log(`\n✅ Task ${taskId} marked complete!\n`);
  } catch(e: any) {
    console.error("❌ Failed:", e.message);
    process.exit(1);
  }
};
