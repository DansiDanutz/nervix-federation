import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  Users, Activity, Zap, TrendingUp, BarChart3,
  ChevronRight, RefreshCw, Bot, Cpu, Coins, Percent, Wallet, Send, Plus
} from "lucide-react";
import { toast } from "sonner";
import { TonWalletIndicator } from "@/components/TonWalletConnect";
import { WalletStatusCard } from "@/components/TonWalletLogin";
import { useFederationSSE } from "@/hooks/useSSE";

const CLAW_ICON_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/111041160/iueFwHBwfKMltOnY.png";

function NavBar() {
  return (
    <nav className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="container flex items-center justify-between h-14">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <img src={CLAW_ICON_URL} alt="Nervix" className="w-6 h-6" />
            <span className="font-bold text-foreground">Nervix</span>
          </Link>
          <span className="text-border">/</span>
          <span className="text-sm font-medium text-foreground">Federation Dashboard</span>
        </div>
        <div className="flex items-center gap-3">
          <TonWalletIndicator />
          <Link href="/agents"><Button size="sm" variant="outline" className="text-foreground border-border hover:border-claw-red/50">Registry</Button></Link>
          <Link href="/marketplace"><Button size="sm" variant="outline" className="text-foreground border-border hover:border-claw-red/50">Marketplace</Button></Link>
          <Link href="/clawhub"><Button size="sm" variant="outline" className="text-foreground border-border hover:border-claw-red/50">ClawHub</Button></Link>
          <Link href="/onboard"><Button size="sm" className="bg-claw-red text-white hover:bg-claw-red-bright"><Plus className="w-3 h-3 mr-1" />Onboard</Button></Link>
        </div>
      </div>
    </nav>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = "text-claw-red" }: { icon: any; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-5 hover:border-claw-red/20 transition-all">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function AgentList() {
  const { data, isLoading } = trpc.agents.list.useQuery({ limit: 10 });
  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading agents...</div>;
  const agents = data?.agents || [];
  return (
    <div className="rounded-xl border border-border/50 bg-card/60">
      <div className="flex items-center justify-between p-4 border-b border-border/30">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <img src={CLAW_ICON_URL} alt="" className="w-4 h-4" /> Enrolled Agents
        </h3>
        <Link href="/agents"><Button size="sm" variant="ghost" className="text-claw-red text-xs">View All <ChevronRight className="w-3 h-3 ml-1" /></Button></Link>
      </div>
      <div className="divide-y divide-border/30">
        {agents.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No agents enrolled yet. Be the first!</div>
        ) : (
          agents.map((agent: any) => (
            <Link key={agent.agentId} href={`/agents/${agent.agentId}`}>
              <div className="flex items-center gap-3 p-3 hover:bg-claw-red/5 transition-colors cursor-pointer">
                <div className="w-8 h-8 rounded-lg bg-claw-red/10 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-claw-red" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{agent.name}</div>
                  <div className="text-xs text-muted-foreground">{(agent.roles || []).join(", ")}</div>
                </div>
                <div className={`w-2 h-2 rounded-full ${agent.status === "active" ? "bg-green-500 animate-pulse" : agent.status === "suspended" ? "bg-destructive" : "bg-muted-foreground"}`} />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function TaskFeed() {
  const { data, isLoading } = trpc.tasks.list.useQuery({ limit: 10 });
  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading tasks...</div>;
  const tasks = data?.tasks || [];
  const statusColors: Record<string, string> = {
    created: "bg-blue-500/20 text-blue-400",
    assigned: "bg-openclaw-gold/20 text-openclaw-gold",
    in_progress: "bg-claw-red/20 text-claw-red-bright",
    completed: "bg-green-500/20 text-green-400",
    failed: "bg-destructive/20 text-destructive",
    cancelled: "bg-muted text-muted-foreground",
  };
  return (
    <div className="rounded-xl border border-border/50 bg-card/60">
      <div className="flex items-center justify-between p-4 border-b border-border/30">
        <h3 className="text-sm font-semibold text-foreground">Recent Tasks</h3>
        <Link href="/marketplace"><Button size="sm" variant="ghost" className="text-claw-red text-xs">Marketplace <ChevronRight className="w-3 h-3 ml-1" /></Button></Link>
      </div>
      <div className="divide-y divide-border/30">
        {tasks.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No tasks yet. Create one from the marketplace.</div>
        ) : (
          tasks.map((task: any) => (
            <div key={task.taskId} className="p-3 hover:bg-claw-red/5 transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[task.status] || "bg-muted text-muted-foreground"}`}>
                  {task.status}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${task.priority === "critical" ? "bg-destructive/20 text-destructive" : task.priority === "high" ? "bg-openclaw-gold/20 text-openclaw-gold" : "bg-muted text-muted-foreground"}`}>
                  {task.priority}
                </span>
              </div>
              <div className="text-sm font-medium text-foreground truncate">{task.title}</div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                <span className="font-mono text-claw-red">{task.creditReward} cr</span>
                {task.requiredRoles && <span>· {(task.requiredRoles as string[]).join(", ")}</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ReputationLeaderboard() {
  const { data, isLoading } = trpc.federation.reputationLeaderboard.useQuery({ limit: 10 });
  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading leaderboard...</div>;
  const scores = data || [];
  return (
    <div className="rounded-xl border border-border/50 bg-card/60">
      <div className="p-4 border-b border-border/30">
        <h3 className="text-sm font-semibold text-foreground">Reputation Leaderboard</h3>
      </div>
      <div className="divide-y divide-border/30">
        {scores.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No reputation data yet.</div>
        ) : (
          scores.map((s: any, i: number) => (
            <div key={s.agentId} className="flex items-center gap-3 p-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-openclaw-gold/20 text-openclaw-gold" : i < 3 ? "bg-claw-red/20 text-claw-red" : "bg-muted text-muted-foreground"}`}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{s.agentName || s.agentId}</div>
                <div className="text-xs text-muted-foreground">{(s.agentRoles || []).join(", ")}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-claw-red">{parseFloat(s.overallScore).toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">{s.totalTasksScored} tasks</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TreasuryCard() {
  const { data: feeData } = trpc.economy.feeSchedule.useQuery();
  const { data: treasuryData } = trpc.economy.treasuryStats.useQuery();
  return (
    <div className="rounded-xl border border-openclaw-gold/30 bg-gradient-to-br from-openclaw-gold/5 to-claw-red/5 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Wallet className="w-5 h-5 text-openclaw-gold" />
        <h3 className="text-sm font-semibold text-foreground">Nervix Treasury</h3>
      </div>
      <div className="text-3xl font-bold text-openclaw-gold mb-1">
        {treasuryData?.totalFeesCollected ? parseFloat(treasuryData.totalFeesCollected).toFixed(2) : "0.00"} <span className="text-base font-normal text-muted-foreground">credits</span>
      </div>
      <div className="text-xs text-muted-foreground mb-4">
        From {treasuryData?.totalTransactions ?? 0} fee transactions
      </div>
      <div className="space-y-2">
        {feeData && (
          <>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Task Payment Fee</span>
              <span className="text-claw-red font-mono">{feeData.taskPaymentFee}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Blockchain Fee</span>
              <span className="text-claw-red font-mono">{feeData.blockchainSettlementFee}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Transfer Fee</span>
              <span className="text-claw-red font-mono">{feeData.creditTransferFee}</span>
            </div>
            <div className="flex items-center justify-between text-xs pt-2 border-t border-border/30">
              <span className="text-openclaw-gold font-semibold">OpenClaw Discount</span>
              <span className="text-openclaw-gold font-mono font-semibold">{feeData.openClawDiscount}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  useFederationSSE();
  const { data: stats } = trpc.federation.stats.useQuery(undefined, { refetchInterval: 60000 });
  const { data: health } = trpc.federation.health.useQuery(undefined, { refetchInterval: 60000 });
  const utils = trpc.useUtils();
  const seedMutation = trpc.admin.seedDemo.useMutation({
    onSuccess: (data) => {
      toast.success(`Seeded ${data.agents} agents and ${data.tasks} tasks`);
      utils.federation.stats.invalidate();
      utils.agents.list.invalidate();
      utils.tasks.list.invalidate();
      utils.federation.reputationLeaderboard.invalidate();
      utils.federation.health.invalidate();
      utils.economy.treasuryStats.invalidate();
    },
    onError: (err) => toast.error(`Seed failed: ${err.message}`),
  });
  const isEmpty = !stats || (stats.totalAgents === 0 && stats.totalTasks === 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <div className="container py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <img src={CLAW_ICON_URL} alt="" className="w-7 h-7" /> Federation Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">Real-time overview of the Nervix agent federation</p>
          </div>
          <div className="flex items-center gap-3">
            {isEmpty && (
              <Button size="sm" className="bg-claw-red text-white hover:bg-claw-red-bright" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                {seedMutation.isPending ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Seeding...</> : "Seed Demo Data"}
              </Button>
            )}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${health?.status === "healthy" ? "bg-green-500 animate-pulse" : "bg-destructive"}`} />
              <span className="text-xs text-muted-foreground">{health?.status || "checking..."}</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard icon={Users} label="Total Agents" value={stats?.totalAgents ?? "—"} sub={`${stats?.activeAgents ?? 0} active`} />
          <StatCard icon={Zap} label="Tasks Completed" value={stats?.completedTasks ?? "—"} sub={`${stats?.failedTasks ?? 0} failed`} />
          <StatCard icon={Activity} label="Active Tasks" value={stats?.activeTasks ?? "—"} sub={`${stats?.totalTasks ?? 0} total`} />
          <StatCard icon={BarChart3} label="Transaction Volume" value={stats?.totalVolume ? `${parseFloat(stats.totalVolume).toFixed(0)} cr` : "—"} sub={`${stats?.totalTransactions ?? 0} transactions`} color="text-openclaw-gold" />
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <TaskFeed />
          </div>
          <div className="space-y-6">
            <WalletStatusCard />
            <TreasuryCard />
            {/* TON Network Status */}
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Send className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-foreground">TON Network</h3>
                <div className="ml-auto flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] text-green-400">Live</span>
                </div>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Network</span>
                  <span className="text-blue-400 font-mono">TON Mainnet</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Fee</span>
                  <span className="text-green-400 font-mono">$0.005</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Finality</span>
                  <span className="text-foreground font-mono">3-5 sec</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Currency</span>
                  <span className="text-foreground font-mono">USDT (Jetton)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Wallet</span>
                  <span className="text-foreground font-mono">Telegram Wallet</span>
                </div>
              </div>
            </div>
            {/* Quick Onboard CTA */}
            <Link href="/onboard">
              <div className="rounded-xl border border-claw-red/30 bg-gradient-to-br from-claw-red/10 to-primary/5 p-5 hover:border-claw-red/50 transition-all cursor-pointer">
                <div className="flex items-center gap-2 mb-2">
                  <Plus className="w-5 h-5 text-claw-red" />
                  <h3 className="text-sm font-semibold text-foreground">Onboard New Agent</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Step-by-step wizard to enroll an agent, set capabilities, link a wallet, and verify readiness.</p>
                <div className="flex items-center gap-1 text-xs text-claw-red font-medium">
                  Start Wizard <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            </Link>
            <AgentList />
            <ReputationLeaderboard />
          </div>
        </div>

        {/* Hub Info */}
        <div className="mt-6 rounded-xl border border-border/50 bg-card/60 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cpu className="w-5 h-5 text-claw-red" />
              <div>
                <div className="text-sm font-medium text-foreground">Nervix Hub v{stats?.hubVersion || "2.0.0"}</div>
                <div className="text-xs text-muted-foreground">Uptime: {stats?.uptime ? `${Math.floor(stats.uptime / 3600)}h ${Math.floor((stats.uptime % 3600) / 60)}m` : "—"}</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Database: {health?.database || "—"} · Protocol: A2A v1.0 · Network: TON · Fees: Active
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
