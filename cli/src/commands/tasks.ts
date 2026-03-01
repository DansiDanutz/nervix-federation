const fs = require("fs");

module.exports = async function tasks(opts: any) {
  const configPath = opts.config || "./nervix.json";
  if (!fs.existsSync(configPath)) { console.error(`❌ Config not found: ${configPath}`); process.exit(1); }
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const apiUrl = opts.api || config.apiUrl || "https://nervix.ai";

  try {
    const params = { json: { status: opts.status, limit: 20 } };
    const res = await fetch(`${apiUrl}/api/trpc/tasks.list?input=${encodeURIComponent(JSON.stringify(params))}`);
    const data = await res.json() as any;
    const taskList = data.result?.data?.json?.tasks || data.result?.data?.json || [];
    if (!taskList.length) { console.log("No tasks found."); return; }
    console.log(`\n📋 Tasks (${taskList.length})\n`);
    taskList.forEach((t: any, i: number) => {
      console.log(`${i+1}. [${t.status}] ${t.title}`);
      console.log(`   ID: ${t.taskId} | Budget: ${t.creditReward || 0} credits | Priority: ${t.priority || "normal"}\n`);
    });
  } catch(e: any) {
    console.error("❌ Failed:", e.message);
    process.exit(1);
  }
};
