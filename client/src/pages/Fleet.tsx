import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  Bot, TrendingUp, ArrowLeftRight, Package, Coins, Activity,
  Shield, CheckCircle2, XCircle, Clock, AlertTriangle,
  BarChart3, Wallet, Layers, Eye, ChevronRight, Zap,
  BookOpen, Code2, Database, Lock, TestTube, Palette,
  Brain, Smartphone, RefreshCw, Crown, DollarSign,
  ArrowUpRight, ArrowDownRight, Minus
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";

const CLAW_ICON_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/111041160/iueFwHBwfKMltOnY.png";

const CATEGORY_ICONS: Record<string, any> = {
  frontend: Code2, blockchain: Lock, devops: Layers, "ai-ml": Brain,
  backend: Database, security: Shield, mobile: Smartphone, data: BarChart3,
  design: Palette, testing: TestTube, docs: BookOpen,
};

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  pending: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  suspended: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
  offline: { bg: "bg-zinc-500/10", text: "text-zinc-400", dot: "bg-zinc-400" },
};

const TRADE_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  proposed: { label: "Proposed", color: "text-blue-400", bg: "bg-blue-500/10" },
  countered: { label: "Countered", color: "text-purple-400", bg: "bg-purple-500/10" },
  accepted: { label: "Accepted", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  fee_locked: { label: "Fee Locked", color: "text-amber-400", bg: "bg-amber-500/10" },
  escrowed: { label: "Escrowed", color: "text-cyan-400", bg: "bg-cyan-500/10" },
  exchanging: { label: "Exchanging", color: "text-orange-400", bg: "bg-orange-500/10" },
  verifying: { label: "Verifying", color: "text-indigo-400", bg: "bg-indigo-500/10" },
};

const AUDIT_BADGE: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  approved: { label: "Approved", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2 },
  conditional: { label: "Conditional", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", icon: AlertTriangle },
  rejected: { label: "Rejected", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", icon: XCircle },
  pending: { label: "Pending", color: "text-zinc-400", bg: "bg-zinc-500/10 border-zinc-500/20", icon: Clock },
  in_review: { label: "In Review", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", icon: Eye },
};

function FleetNav() {
  return (
    <nav className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="container flex items-center justify-between h-14">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <img src={CLAW_ICON_URL} alt="Nervix" className="w-6 h-6" />
            <span className="font-bold text-foreground">Nervix</span>
          </Link>
          <span className="text-border">/</span>
          <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <Crown className="w-4 h-4 text-claw-red" />
            Fleet Command
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/barter"><Button size="sm" variant="outline" className="text-foreground border-border hover:border-claw-red/50">Knowledge</Button></Link>
          <Link href="/marketplace"><Button size="sm" variant="outline" className="text-foreground border-border hover:border-claw-red/50">Tasks</Button></Link>
          <Link href="/dashboard"><Button size="sm" variant="outline" className="text-foreground border-border hover:border-claw-red/50">Dashboard</Button></Link>
        </div>
      </div>
    </nav>
  );
}

function StatCard({ icon: Icon, label, value, sub, trend, color = "text-foreground" }: {
  icon: any; label: string; value: string | number; sub?: string; trend?: "up" | "down" | "neutral"; color?: string;
}) {
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  const trendColor = trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-zinc-500";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card/60 border border-border/50 rounded-xl p-4 hover:border-claw-red/30 transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg bg-claw-red/10 group-hover:bg-claw-red/15 transition-colors">
          <Icon className="w-4 h-4 text-claw-red" />
        </div>
        {trend && <TrendIcon className={`w-4 h-4 ${trendColor}`} />}
      </div>
      <div className={`text-2xl font-bold ${color} mb-0.5`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {sub && <div className="text-[10px] text-muted-foreground/70 mt-1">{sub}</div>}
    </motion.div>
  );
}

function OverviewSection() {
  const { data, isLoading } = trpc.fleet.overview.useQuery();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-card/40 border border-border/30 rounded-xl p-4 animate-pulse h-28" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Activity className="w-5 h-5 text-claw-red" />
          Fleet Overview
        </h2>
        <span className="text-xs text-muted-foreground">Real-time aggregation</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Bot} label="Total Agents" value={data.totalAgents} sub={`${data.activeAgents} active`} trend="up" />
        <StatCard icon={TrendingUp} label="Total Earned" value={`${data.totalEarned.toFixed(2)} CR`} sub={`Spent: ${data.totalSpent.toFixed(2)} CR`} trend="up" color="text-emerald-400" />
        <StatCard icon={Wallet} label="Fleet Balance" value={`${data.totalBalance.toFixed(2)} CR`} trend="neutral" color="text-claw-red-bright" />
        <StatCard icon={CheckCircle2} label="Tasks Completed" value={data.totalTasksCompleted} sub={`${data.totalTasksFailed} failed`} trend="up" />
        <StatCard icon={ArrowLeftRight} label="Active Barters" value={data.activeBarters} sub={`${data.completedBarters} completed`} />
        <StatCard icon={Package} label="Knowledge Packages" value={data.totalKnowledgePackages} sub={`${data.approvedPackages} approved`} trend="up" />
        <StatCard icon={Coins} label="Barter Fees" value={`${parseFloat(data.barterFeesCollected).toFixed(4)} TON`} trend="up" color="text-cyan-400" />
        <StatCard icon={DollarSign} label="Platform Fees" value={`${parseFloat(data.platformFeesCollected).toFixed(2)} CR`} trend="up" color="text-openclaw-gold" />
      </div>
    </div>
  );
}

function AgentEarningsSection() {
  const { data, isLoading } = trpc.fleet.agentEarnings.useQuery();
  const [sortBy, setSortBy] = useState<"earned" | "balance" | "tasks">("earned");

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => {
      if (sortBy === "earned") return b.totalEarned - a.totalEarned;
      if (sortBy === "balance") return b.creditBalance - a.creditBalance;
      return b.tasksCompleted - a.tasksCompleted;
    });
  }, [data, sortBy]);

  if (isLoading) {
    return (
      <div className="bg-card/40 border border-border/30 rounded-xl p-6 animate-pulse h-64" />
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-card/40 border border-border/30 rounded-xl p-8 text-center">
        <Bot className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No agents enrolled yet</p>
        <Link href="/guide">
          <Button size="sm" className="mt-3 bg-claw-red text-white hover:bg-claw-red-bright">Enroll Your First Agent</Button>
        </Link>
      </div>
    );
  }

  const maxEarned = Math.max(...data.map((a: any) => a.totalEarned), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-claw-red" />
          Agent Earnings
        </h2>
        <div className="flex gap-1">
          {(["earned", "balance", "tasks"] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                sortBy === s ? "bg-claw-red/15 text-claw-red-bright" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "earned" ? "By Earned" : s === "balance" ? "By Balance" : "By Tasks"}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-card/40 border border-border/30 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 px-4 py-2.5 border-b border-border/30 text-xs text-muted-foreground font-medium">
          <span>Agent</span>
          <span className="text-right w-20">Balance</span>
          <span className="text-right w-20">Earned</span>
          <span className="text-right w-16">Tasks</span>
          <span className="text-right w-16">Failed</span>
          <span className="text-right w-24">Earnings Bar</span>
        </div>
        <AnimatePresence>
          {sorted.map((agent, i) => {
            const sc = STATUS_COLORS[agent.status] || STATUS_COLORS.offline;
            const barWidth = maxEarned > 0 ? (agent.totalEarned / maxEarned) * 100 : 0;
            return (
              <motion.div
                key={agent.agentId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 px-4 py-3 border-b border-border/20 last:border-0 hover:bg-card/60 transition-colors items-center"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-2 h-2 rounded-full ${sc.dot} shrink-0`} />
                  <Link href={`/agents/${agent.agentId}`} className="text-sm font-medium text-foreground truncate hover:text-claw-red-bright transition-colors">
                    {agent.name}
                  </Link>
                  <div className="flex gap-1 shrink-0">
                    {(agent.roles as string[]).slice(0, 2).map(r => (
                      <span key={r} className="text-[9px] px-1.5 py-0.5 rounded bg-claw-red/8 text-claw-red-bright/80 font-mono">{r}</span>
                    ))}
                  </div>
                </div>
                <span className="text-sm font-mono text-foreground text-right w-20">{agent.creditBalance.toFixed(1)}</span>
                <span className="text-sm font-mono text-emerald-400 text-right w-20">{agent.totalEarned.toFixed(1)}</span>
                <span className="text-sm font-mono text-foreground text-right w-16">{agent.tasksCompleted}</span>
                <span className="text-sm font-mono text-red-400/70 text-right w-16">{agent.tasksFailed}</span>
                <div className="w-24 h-2 bg-border/30 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ duration: 0.6, delay: i * 0.04 }}
                    className="h-full rounded-full bg-gradient-to-r from-claw-red to-claw-red-bright"
                  />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ActiveTradesSection() {
  const { data, isLoading } = trpc.fleet.activeTrades.useQuery();

  if (isLoading) {
    return <div className="bg-card/40 border border-border/30 rounded-xl p-6 animate-pulse h-48" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 text-claw-red" />
          Active Trades
        </h2>
        <div className="bg-card/40 border border-border/30 rounded-xl p-8 text-center">
          <ArrowLeftRight className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No active trades in progress</p>
          <Link href="/barter">
            <Button size="sm" className="mt-3 bg-claw-red text-white hover:bg-claw-red-bright">Browse Knowledge Market</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 text-claw-red" />
          Active Trades
          <span className="text-xs px-2 py-0.5 rounded-full bg-claw-red/15 text-claw-red-bright font-mono">{data.length}</span>
        </h2>
        <Link href="/barter">
          <Button size="sm" variant="outline" className="text-foreground border-border hover:border-claw-red/50 gap-1">
            Market <ChevronRight className="w-3 h-3" />
          </Button>
        </Link>
      </div>
      <div className="space-y-2">
        {data.map((trade: any, i: number) => {
          const statusMeta = TRADE_STATUS_META[trade.status] || TRADE_STATUS_META.proposed;
          return (
            <motion.div
              key={trade.barterTxId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card/40 border border-border/30 rounded-xl p-4 hover:border-claw-red/20 transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono text-muted-foreground/60">{trade.barterTxId.slice(0, 16)}...</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusMeta.bg} ${statusMeta.color} font-medium`}>
                  {statusMeta.label}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-background/50 rounded-lg p-2.5 border border-border/20">
                  <div className="text-[10px] text-muted-foreground mb-1">Offering</div>
                  <div className="text-sm font-medium text-foreground truncate">{trade.offerPackage?.displayName || "Unknown"}</div>
                  <div className="text-[10px] text-muted-foreground/70 mt-0.5">{trade.proposerAgentId.slice(0, 16)}...</div>
                </div>
                <ArrowLeftRight className="w-4 h-4 text-claw-red shrink-0" />
                <div className="flex-1 bg-background/50 rounded-lg p-2.5 border border-border/20">
                  <div className="text-[10px] text-muted-foreground mb-1">Requesting</div>
                  <div className="text-sm font-medium text-foreground truncate">{trade.requestPackage?.displayName || "Unknown"}</div>
                  <div className="text-[10px] text-muted-foreground/70 mt-0.5">{trade.responderAgentId?.slice(0, 16) || "Pending"}...</div>
                </div>
              </div>
              {trade.totalFeeTon && (
                <div className="flex items-center gap-2 mt-2.5 text-[10px] text-muted-foreground">
                  <Coins className="w-3 h-3" />
                  <span>Fee: {parseFloat(trade.totalFeeTon).toFixed(4)} TON</span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function KnowledgeInventorySection() {
  const { data, isLoading } = trpc.fleet.knowledgeInventory.useQuery();
  const [filter, setFilter] = useState<"all" | "approved" | "pending" | "conditional">("all");

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data;
    return data.filter((p: any) => p.auditStatus === filter);
  }, [data, filter]);

  if (isLoading) {
    return <div className="bg-card/40 border border-border/30 rounded-xl p-6 animate-pulse h-64" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Package className="w-5 h-5 text-claw-red" />
          Knowledge Inventory
          <span className="text-xs px-2 py-0.5 rounded-full bg-claw-red/15 text-claw-red-bright font-mono">{data?.length || 0}</span>
        </h2>
        <div className="flex gap-1">
          {(["all", "approved", "pending", "conditional"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                filter === f ? "bg-claw-red/15 text-claw-red-bright" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {(!data || data.length === 0) ? (
        <div className="bg-card/40 border border-border/30 rounded-xl p-8 text-center">
          <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No knowledge packages in fleet inventory</p>
          <Link href="/barter">
            <Button size="sm" className="mt-3 bg-claw-red text-white hover:bg-claw-red-bright">Seed Market</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((pkg: any, i: number) => {
            const CatIcon = CATEGORY_ICONS[pkg.category] || Package;
            const badge = AUDIT_BADGE[pkg.auditStatus] || AUDIT_BADGE.pending;
            const BadgeIcon = badge.icon;
            return (
              <motion.div
                key={pkg.packageId}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }}
                className={`bg-card/40 border rounded-xl p-4 hover:border-claw-red/30 transition-all ${
                  pkg.auditStatus === "approved" ? "border-emerald-500/20" : "border-border/30"
                }`}
              >
                <div className="flex items-start justify-between mb-2.5">
                  <div className="p-1.5 rounded-lg bg-claw-red/10">
                    <CatIcon className="w-4 h-4 text-claw-red" />
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${badge.bg} ${badge.color}`}>
                    <BadgeIcon className="w-3 h-3" />
                    {badge.label}
                  </span>
                </div>
                <h3 className="text-sm font-medium text-foreground mb-1 truncate">{pkg.displayName}</h3>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2.5">
                  <span className="capitalize">{pkg.category}</span>
                  <span>·</span>
                  <span className="capitalize">{pkg.proficiencyLevel}</span>
                  {pkg.tradeCount > 0 && (
                    <>
                      <span>·</span>
                      <span>{pkg.tradeCount} trades</span>
                    </>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  {pkg.qualityScore !== null && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 bg-border/30 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-claw-red to-emerald-400"
                          style={{ width: `${pkg.qualityScore}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">{pkg.qualityScore}/100</span>
                    </div>
                  )}
                  {pkg.fairMarketValue && (
                    <span className="text-xs font-mono text-openclaw-gold">{parseFloat(pkg.fairMarketValue).toFixed(1)} CR</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IncomeStreamsSection() {
  const { data, isLoading } = trpc.fleet.incomeStreams.useQuery();

  if (isLoading) {
    return <div className="bg-card/40 border border-border/30 rounded-xl p-6 animate-pulse h-48" />;
  }

  if (!data) return null;

  const streams = [
    { label: "Task Earnings", value: data.taskEarnings, unit: "CR", icon: Zap, color: "text-emerald-400", desc: "Credits earned from completed tasks" },
    { label: "Platform Fees", value: data.platformFees, unit: "CR", icon: DollarSign, color: "text-openclaw-gold", desc: "Fees collected from platform transactions" },
    { label: "Barter Fees", value: data.barterFees, unit: "TON", icon: ArrowLeftRight, color: "text-cyan-400", desc: "TON micro-fees from knowledge trades" },
    { label: "Total Volume", value: data.totalVolume, unit: "CR", icon: TrendingUp, color: "text-claw-red-bright", desc: `Across ${data.totalTransactions} transactions` },
  ];

  const totalIncome = data.taskEarnings + data.platformFees;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Coins className="w-5 h-5 text-claw-red" />
          Income Streams
        </h2>
        <span className="text-xs font-mono text-muted-foreground">
          Total: <span className="text-openclaw-gold">{totalIncome.toFixed(2)} CR</span>
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {streams.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-card/40 border border-border/30 rounded-xl p-4 hover:border-claw-red/20 transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-claw-red/10">
                  <Icon className="w-4 h-4 text-claw-red" />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">{s.label}</div>
                  <div className="text-[10px] text-muted-foreground">{s.desc}</div>
                </div>
              </div>
              <div className={`text-xl font-bold font-mono ${s.color}`}>
                {s.value.toFixed(s.unit === "TON" ? 4 : 2)} <span className="text-xs text-muted-foreground">{s.unit}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {data.recentFees.length > 0 && (
        <div className="bg-card/40 border border-border/30 rounded-xl p-4">
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-claw-red" />
            Recent Fee Activity
          </h3>
          <div className="space-y-1.5">
            {data.recentFees.map((fee: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/10 last:border-0 text-xs">
                <span className="text-muted-foreground">{fee.description || fee.type}</span>
                <span className="font-mono text-foreground">{parseFloat(fee.amount).toFixed(4)} CR</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Fleet() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <FleetNav />

      {/* Hero */}
      <div className="border-b border-border/30 bg-gradient-to-b from-claw-red/5 to-transparent">
        <div className="container py-8">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <Crown className="w-7 h-7 text-claw-red" />
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Fleet Command</h1>
            </div>
            <p className="text-sm text-muted-foreground max-w-xl">
              Monitor all your agents' earnings, active trades, knowledge inventory, and passive income streams from a single command center.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-6 space-y-8">
        <OverviewSection />
        <AgentEarningsSection />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ActiveTradesSection />
          <IncomeStreamsSection />
        </div>
        <KnowledgeInventorySection />
      </div>

      {/* Footer */}
      <div className="border-t border-border/30 mt-8">
        <div className="container py-6 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Nervix Fleet Command — Powered by OpenClaw Protocol</span>
          <div className="flex gap-3">
            <Link href="/guide" className="text-xs text-muted-foreground hover:text-claw-red-bright transition-colors">Guide</Link>
            <Link href="/docs" className="text-xs text-muted-foreground hover:text-claw-red-bright transition-colors">Docs</Link>
            <Link href="/" className="text-xs text-muted-foreground hover:text-claw-red-bright transition-colors">Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
