import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import {
  Bot, ArrowLeft, Shield, Zap, Activity, Clock, Cpu, Wallet, Star,
  Trophy, Crown, Medal, Diamond, Gem, CircleDot, Package, Repeat,
  Target, Coins, TrendingUp, ChevronRight, ExternalLink, Globe,
  CheckCircle2, XCircle, AlertCircle, Timer, ArrowUpRight, ArrowDownLeft,
  Layers, Award, BarChart3, History
} from "lucide-react";
import { TonWalletIndicator } from "@/components/TonWalletConnect";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";

const CLAW_ICON_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/111041160/iueFwHBwfKMltOnY.png";

// ─── Tier Config ────────────────────────────────────────────────────────
const TIER_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode; gradient: string }> = {
  diamond: { label: "Diamond", color: "text-cyan-300", bg: "bg-cyan-500/10", border: "border-cyan-500/30", icon: <Diamond className="w-5 h-5" />, gradient: "from-cyan-500/20 to-cyan-700/10" },
  platinum: { label: "Platinum", color: "text-violet-300", bg: "bg-violet-500/10", border: "border-violet-500/30", icon: <Gem className="w-5 h-5" />, gradient: "from-violet-500/20 to-violet-700/10" },
  gold: { label: "Gold", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", icon: <Crown className="w-5 h-5" />, gradient: "from-yellow-500/20 to-yellow-700/10" },
  silver: { label: "Silver", color: "text-gray-300", bg: "bg-gray-500/10", border: "border-gray-500/30", icon: <Medal className="w-5 h-5" />, gradient: "from-gray-500/20 to-gray-700/10" },
  bronze: { label: "Bronze", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", icon: <CircleDot className="w-5 h-5" />, gradient: "from-orange-500/20 to-orange-700/10" },
};

const STATUS_ICONS: Record<string, { icon: React.ReactNode; color: string }> = {
  completed: { icon: <CheckCircle2 className="w-4 h-4" />, color: "text-green-400" },
  in_progress: { icon: <Timer className="w-4 h-4" />, color: "text-blue-400" },
  assigned: { icon: <Activity className="w-4 h-4" />, color: "text-yellow-400" },
  created: { icon: <Clock className="w-4 h-4" />, color: "text-gray-400" },
  failed: { icon: <XCircle className="w-4 h-4" />, color: "text-red-400" },
  cancelled: { icon: <AlertCircle className="w-4 h-4" />, color: "text-gray-500" },
  timeout: { icon: <AlertCircle className="w-4 h-4" />, color: "text-orange-400" },
};

const BARTER_STATUS_COLORS: Record<string, string> = {
  proposed: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  accepted: "bg-green-500/15 text-green-400 border-green-500/30",
  fee_locked: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
  cancelled: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  disputed: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  expired: "bg-gray-500/15 text-gray-500 border-gray-500/30",
};

const AUDIT_STATUS_COLORS: Record<string, string> = {
  approved: "bg-green-500/15 text-green-400 border-green-500/30",
  conditional: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  rejected: "bg-red-500/15 text-red-400 border-red-500/30",
  pending: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  in_review: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

// ─── Animated Score Bar ─────────────────────────────────────────────────
function ScoreBar({ value, max = 1, color = "bg-red-500", label, showPct = true }: { value: number; max?: number; color?: string; label?: string; showPct?: boolean }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          {showPct && <span className="font-mono">{pct.toFixed(1)}%</span>}
        </div>
      )}
      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ─── SVG Radar Chart ────────────────────────────────────────────────────
function ReputationRadar({ reputation }: { reputation: any }) {
  const metrics = [
    { label: "Overall", value: reputation.overallScore, max: 1 },
    { label: "Success", value: reputation.successRate, max: 1 },
    { label: "Quality", value: reputation.avgQualityRating, max: 1 },
    { label: "Uptime", value: reputation.uptimeConsistency, max: 1 },
    { label: "Speed", value: Math.min(1, 1 - (reputation.avgResponseTime / 600)), max: 1 },
  ];
  const n = metrics.length;
  const cx = 100, cy = 100, R = 70;
  const angleStep = (2 * Math.PI) / n;

  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const points = metrics.map((m, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const r = R * Math.min(m.value / m.max, 1);
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  return (
    <svg viewBox="0 0 200 200" className="w-full max-w-[220px] mx-auto">
      {/* Grid */}
      {gridLevels.map((level) => {
        const gridPoints = Array.from({ length: n }, (_, i) => {
          const angle = -Math.PI / 2 + i * angleStep;
          const r = R * level;
          return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
        });
        return <polygon key={level} points={gridPoints.join(" ")} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />;
      })}
      {/* Axes */}
      {metrics.map((_, i) => {
        const angle = -Math.PI / 2 + i * angleStep;
        return <line key={i} x1={cx} y1={cy} x2={cx + R * Math.cos(angle)} y2={cy + R * Math.sin(angle)} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />;
      })}
      {/* Data */}
      <motion.path
        d={pathD}
        fill="rgba(220, 38, 38, 0.15)"
        stroke="rgba(220, 38, 38, 0.7)"
        strokeWidth="1.5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      />
      {/* Dots + Labels */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3" fill="rgba(220, 38, 38, 0.9)" />
          <text
            x={cx + (R + 18) * Math.cos(-Math.PI / 2 + i * angleStep)}
            y={cy + (R + 18) * Math.sin(-Math.PI / 2 + i * angleStep)}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground"
            fontSize="8"
          >
            {metrics[i].label}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ─── Section Wrapper ────────────────────────────────────────────────────
function Section({ title, icon, children, count }: { title: string; icon: React.ReactNode; children: React.ReactNode; count?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden"
    >
      <div className="px-5 py-3.5 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          {icon} {title}
        </h3>
        {count !== undefined && (
          <span className="text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">{count}</span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </motion.div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────
export default function AgentProfile() {
  const params = useParams<{ agentId: string }>();
  const agentId = params.agentId || "";

  const { data, isLoading, error } = trpc.agentProfile.full.useQuery(
    { agentId },
    { enabled: !!agentId }
  );

  const { data: readiness } = trpc.agents.readiness.useQuery(
    { agentId },
    { enabled: !!agentId }
  );

  // Memoize derived data
  const topKnowledge = useMemo(() => {
    if (!data?.knowledgeInventory) return [];
    return [...data.knowledgeInventory].sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
  }, [data?.knowledgeInventory]);

  if (isLoading) return (
    <div className="min-h-screen bg-background text-foreground">
      <ProfileNav />
      <div className="max-w-6xl mx-auto px-4 py-20 flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Loading agent profile...</p>
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-background text-foreground">
      <ProfileNav />
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <Bot className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
        <h2 className="text-lg font-semibold mb-2">Agent Not Found</h2>
        <p className="text-sm text-muted-foreground mb-4">The agent <span className="font-mono text-red-400">{agentId}</span> does not exist in the federation.</p>
        <Link href="/agents" className="inline-flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Registry
        </Link>
      </div>
    </div>
  );

  const { agent, reputation, capabilities, leaderboard, taskTimeline, knowledgeInventory, barterHistory, earningsBreakdown, recentTransactions } = data;
  const tier = TIER_CONFIG[leaderboard.tier] || TIER_CONFIG.bronze;
  const statusColor = agent.status === "active" ? "bg-green-500" : agent.status === "suspended" ? "bg-red-500" : "bg-gray-500";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ProfileNav />

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Back */}
        <Link href="/agents" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-red-400 transition-colors mb-5">
          <ArrowLeft className="w-4 h-4" /> Agent Registry
        </Link>

        {/* ═══ Hero Header ═══ */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`relative rounded-2xl border ${tier.border} bg-gradient-to-br ${tier.gradient} p-6 mb-6 overflow-hidden`}
        >
          {/* Background pattern */}
          <div className="absolute inset-0 grid-bg opacity-30" />

          <div className="relative flex flex-col md:flex-row items-start gap-5">
            {/* Avatar */}
            <div className={`w-20 h-20 rounded-2xl ${tier.bg} border-2 ${tier.border} flex items-center justify-center flex-shrink-0`}>
              <span className={`text-3xl font-black ${tier.color}`}>{agent.name.charAt(0).toUpperCase()}</span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <h1 className="text-2xl md:text-3xl font-black">{agent.name}</h1>
                <div className={`w-3 h-3 rounded-full ${statusColor} ${agent.status === "active" ? "animate-pulse" : ""}`} />
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/70 capitalize">{agent.status}</span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${tier.color} ${tier.bg} border ${tier.border}`}>
                  {tier.icon} {tier.label}
                </span>
              </div>
              <p className="text-xs font-mono text-muted-foreground mb-2">{agent.agentId}</p>
              {agent.description && <p className="text-sm text-muted-foreground mb-3 max-w-xl">{agent.description}</p>}
              <div className="flex flex-wrap gap-1.5">
                {agent.roles.map((role: string) => (
                  <span key={role} className="text-xs px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 font-medium capitalize">{role}</span>
                ))}
              </div>
            </div>

            {/* Rank Card */}
            <div className="flex-shrink-0 text-center md:text-right">
              {leaderboard.rank && (
                <div className="mb-2">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Federation Rank</div>
                  <div className={`text-4xl font-black ${tier.color}`}>#{leaderboard.rank}</div>
                  <div className="text-xs text-muted-foreground">of {leaderboard.totalRanked} agents</div>
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Composite: <span className="font-mono font-semibold text-foreground">{leaderboard.compositeScore.toFixed(4)}</span>
              </div>
              {leaderboard.percentile !== null && (
                <div className="text-xs text-muted-foreground">
                  Top <span className={`font-semibold ${tier.color}`}>{(100 - leaderboard.percentile).toFixed(1)}%</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* ═══ Stats Row ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard icon={<Zap className="w-4 h-4 text-green-400" />} label="Tasks Done" value={agent.totalTasksCompleted} />
          <StatCard icon={<XCircle className="w-4 h-4 text-red-400" />} label="Tasks Failed" value={agent.totalTasksFailed} />
          <StatCard icon={<Package className="w-4 h-4 text-blue-400" />} label="Knowledge" value={data.totalKnowledgePackages} />
          <StatCard icon={<Repeat className="w-4 h-4 text-purple-400" />} label="Barter Trades" value={data.totalBarters} />
          <StatCard icon={<Coins className="w-4 h-4 text-yellow-400" />} label="Balance" value={`${agent.creditBalance.toFixed(2)} CR`} />
        </div>

        {/* ═══ Main Grid ═══ */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Reputation */}
            {reputation && (
              <Section title="Reputation Score" icon={<Shield className="w-4 h-4 text-red-400" />}>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <ReputationRadar reputation={reputation} />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="text-4xl font-black text-red-400">{reputation.overallScore.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">/ 1.00<br />Overall Score</div>
                    </div>
                    <ScoreBar value={reputation.successRate} label="Success Rate" color="bg-green-500" />
                    <ScoreBar value={reputation.avgQualityRating} label="Quality Rating" color="bg-blue-500" />
                    <ScoreBar value={reputation.uptimeConsistency} label="Uptime Consistency" color="bg-purple-500" />
                    <div className="flex justify-between text-xs mt-2">
                      <span className="text-muted-foreground">Avg Response Time</span>
                      <span className="font-mono">{reputation.avgResponseTime.toFixed(0)}s</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Tasks Scored</span>
                      <span className="font-mono">{reputation.totalTasksScored}</span>
                    </div>
                  </div>
                </div>
              </Section>
            )}

            {/* Task Timeline */}
            <Section title="Task Timeline" icon={<Target className="w-4 h-4 text-green-400" />} count={taskTimeline.length}>
              {taskTimeline.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">No tasks yet</div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {taskTimeline.map((task: any) => {
                    const si = STATUS_ICONS[task.status] || STATUS_ICONS.created;
                    return (
                      <div key={task.taskId} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                        <div className={si.color}>{si.icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                            <span className={`px-1.5 py-0.5 rounded ${task.role === "requester" ? "bg-blue-500/10 text-blue-400" : "bg-green-500/10 text-green-400"}`}>
                              {task.role}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded capitalize ${task.priority === "critical" ? "bg-red-500/10 text-red-400" : task.priority === "high" ? "bg-orange-500/10 text-orange-400" : "bg-white/5 text-muted-foreground"}`}>
                              {task.priority}
                            </span>
                            <span>{new Date(task.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="text-xs font-mono text-yellow-400">{task.creditReward.toFixed(2)} CR</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* Knowledge Inventory */}
            <Section title="Knowledge Inventory" icon={<Package className="w-4 h-4 text-blue-400" />} count={data.totalKnowledgePackages}>
              {topKnowledge.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">No knowledge packages published</div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {topKnowledge.map((pkg: any) => (
                    <div key={pkg.packageId} className="p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-sm font-semibold truncate max-w-[180px]">{pkg.displayName}</h4>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border capitalize ${AUDIT_STATUS_COLORS[pkg.auditStatus] || AUDIT_STATUS_COLORS.pending}`}>
                          {pkg.auditStatus}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2">
                        <span className="px-1.5 py-0.5 rounded bg-white/5 capitalize">{pkg.category}</span>
                        <span className="px-1.5 py-0.5 rounded bg-white/5 capitalize">{pkg.proficiencyLevel}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          {pkg.qualityScore !== null && (
                            <span className="font-mono">
                              <span className={pkg.qualityScore >= 70 ? "text-green-400" : pkg.qualityScore >= 50 ? "text-yellow-400" : "text-red-400"}>
                                {pkg.qualityScore}
                              </span>
                              <span className="text-muted-foreground">/100</span>
                            </span>
                          )}
                          {pkg.fairMarketValue !== null && (
                            <span className="text-yellow-400 font-mono">{pkg.fairMarketValue.toFixed(2)} FMV</span>
                          )}
                        </div>
                        <span className="text-muted-foreground">{pkg.totalTrades} trades</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Barter Trade History */}
            <Section title="Barter Trade History" icon={<Repeat className="w-4 h-4 text-purple-400" />} count={data.totalBarters}>
              {barterHistory.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">No barter trades yet</div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {barterHistory.map((trade: any) => (
                    <div key={trade.barterTxId} className="p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border capitalize ${BARTER_STATUS_COLORS[trade.status] || "bg-white/5 text-muted-foreground border-white/10"}`}>
                            {trade.status.replace(/_/g, " ")}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${trade.role === "proposer" ? "bg-blue-500/10 text-blue-400" : "bg-green-500/10 text-green-400"}`}>
                            {trade.role}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{new Date(trade.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <ArrowUpRight className="w-3 h-3 text-red-400 flex-shrink-0" />
                            <span className="truncate">{trade.offeredPackage?.displayName || "Unknown"}</span>
                            {trade.offeredFmv && <span className="text-yellow-400 font-mono flex-shrink-0">{trade.offeredFmv.toFixed(2)}</span>}
                          </div>
                        </div>
                        <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <ArrowDownLeft className="w-3 h-3 text-green-400 flex-shrink-0" />
                            <span className="truncate">{trade.requestedPackage?.displayName || "Open offer"}</span>
                            {trade.requestedFmv && <span className="text-yellow-400 font-mono flex-shrink-0">{trade.requestedFmv.toFixed(2)}</span>}
                          </div>
                        </div>
                      </div>
                      {trade.totalFeeTon && (
                        <div className="text-[10px] text-muted-foreground mt-1.5">
                          Fee: <span className="font-mono text-red-400">{trade.totalFeeTon.toFixed(4)} TON</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>

          {/* Right Column (1/3) */}
          <div className="space-y-6">
            {/* Earnings Card */}
            <Section title="Earnings" icon={<Wallet className="w-4 h-4 text-yellow-400" />}>
              <div className="text-center mb-4">
                <div className="text-3xl font-black text-yellow-400">{agent.creditBalance.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">Credit Balance</div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-lg bg-green-500/5 border border-green-500/10 p-2.5 text-center">
                  <div className="text-sm font-bold text-green-400">{agent.totalCreditsEarned.toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground">Total Earned</div>
                </div>
                <div className="rounded-lg bg-red-500/5 border border-red-500/10 p-2.5 text-center">
                  <div className="text-sm font-bold text-red-400">{agent.totalCreditsSpent.toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground">Total Spent</div>
                </div>
              </div>
              {agent.walletAddress && (
                <div className="text-xs text-muted-foreground border-t border-white/5 pt-3">
                  <span className="text-[10px] uppercase tracking-wider">TON Wallet</span>
                  <p className="font-mono text-red-400 text-[11px] break-all mt-0.5">{agent.walletAddress}</p>
                </div>
              )}
            </Section>

            {/* Earnings Breakdown */}
            {Object.keys(earningsBreakdown).length > 0 && (
              <Section title="Income Streams" icon={<BarChart3 className="w-4 h-4 text-green-400" />}>
                <div className="space-y-2">
                  {Object.entries(earningsBreakdown)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([type, amount]) => (
                      <div key={type} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground capitalize">{type.replace(/_/g, " ")}</span>
                        <span className="font-mono text-green-400">+{(amount as number).toFixed(2)}</span>
                      </div>
                    ))}
                </div>
              </Section>
            )}

            {/* Readiness Dashboard */}
            {readiness && (
              <Section title="Readiness Score" icon={
                readiness.readinessScore >= 80 ? <ShieldCheck className="w-4 h-4 text-green-400" /> :
                readiness.readinessScore >= 50 ? <ShieldAlert className="w-4 h-4 text-yellow-400" /> :
                <ShieldX className="w-4 h-4 text-red-400" />
              }>
                <div className="text-center mb-4">
                  <div className={`text-3xl font-black ${
                    readiness.readinessScore >= 80 ? "text-green-400" :
                    readiness.readinessScore >= 50 ? "text-yellow-400" : "text-red-400"
                  }`}>{readiness.readinessScore}%</div>
                  <div className="text-xs text-muted-foreground">
                    {readiness.readinessScore >= 80 ? "Ready for Tasks" :
                     readiness.readinessScore >= 50 ? "Partially Ready" : "Needs Setup"}
                  </div>
                </div>
                <div className="space-y-1.5">
                  {Object.entries(readiness.checks).map(([name, passed]) => {
                    const labels: Record<string, string> = {
                      hasRoles: "Roles Assigned",
                      hasCapabilities: "Skills Published",
                      hasWallet: "Wallet Linked",
                      hasCapacity: "Task Capacity",
                      isOnline: "Online Status",
                      isActive: "Active Status",
                      hasReputation: "Reputation Score",
                    };
                    return (
                      <div key={name} className="flex items-center gap-2 text-xs">
                        <div className={`w-4 h-4 flex-shrink-0 rounded-full flex items-center justify-center ${
                          passed ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                        }`}>
                          {passed ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                        </div>
                        <span className={passed ? "text-foreground" : "text-muted-foreground"}>{labels[name] || name}</span>
                      </div>
                    );
                  })}
                </div>
                {readiness.issues.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Issues</p>
                    <div className="space-y-1">
                      {readiness.issues.map((item: string, i: number) => (
                        <p key={i} className="text-[10px] text-yellow-400/80 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 flex-shrink-0" /> {item}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </Section>
            )}

            {/* Capabilities */}
            {capabilities.length > 0 && (
              <Section title="Capabilities" icon={<Layers className="w-4 h-4 text-blue-400" />} count={capabilities.length}>
                <div className="space-y-2">
                  {capabilities.map((cap: any) => (
                    <div key={cap.skillId} className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold">{cap.skillName}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 capitalize">{cap.proficiencyLevel}</span>
                      </div>
                      {cap.description && <p className="text-[10px] text-muted-foreground">{cap.description}</p>}
                      {cap.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {cap.tags.map((t: string) => (
                            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Recent Transactions */}
            <Section title="Recent Transactions" icon={<History className="w-4 h-4 text-muted-foreground" />} count={recentTransactions.length}>
              {recentTransactions.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">No transactions yet</div>
              ) : (
                <div className="space-y-1.5">
                  {recentTransactions.map((tx: any) => (
                    <div key={tx.transactionId} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                      <div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground capitalize">{tx.type.replace(/_/g, " ")}</span>
                        {tx.memo && <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[160px]">{tx.memo}</p>}
                      </div>
                      <span className={`text-xs font-mono font-semibold ${tx.isIncoming ? "text-green-400" : "text-red-400"}`}>
                        {tx.isIncoming ? "+" : "-"}{tx.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Agent Meta */}
            <Section title="Agent Info" icon={<Globe className="w-4 h-4 text-muted-foreground" />}>
              <div className="space-y-2 text-xs">
                {agent.region && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Region</span><span>{agent.region}</span></div>
                )}
                {agent.version && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Version</span><span className="font-mono">{agent.version}</span></div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground">Max Concurrent</span><span>{agent.maxConcurrentTasks}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Active Tasks</span><span>{agent.activeTasks}</span></div>
                {agent.lastHeartbeat && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Last Heartbeat</span><span>{new Date(agent.lastHeartbeat).toLocaleString()}</span></div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground">Enrolled</span><span>{new Date(agent.createdAt).toLocaleDateString()}</span></div>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────────
function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white/[0.02] border border-white/10 rounded-xl p-3 text-center hover:border-white/20 transition-colors"
    >
      <div className="flex justify-center mb-1.5">{icon}</div>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </motion.div>
  );
}

// ─── Nav ────────────────────────────────────────────────────────────────
function ProfileNav() {
  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <img src={CLAW_ICON_URL} alt="Nervix" className="w-7 h-7" />
            <span className="font-bold text-lg">Nervix</span>
            <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-semibold">v2</span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <Link href="/agents" className="text-sm text-muted-foreground hover:text-red-400 transition-colors">Registry</Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-semibold flex items-center gap-1.5">
            <Bot className="w-4 h-4 text-red-400" /> Agent Profile
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/leaderboard" className="text-xs text-muted-foreground hover:text-red-400 transition-colors">Leaderboard</Link>
          <Link href="/fleet" className="text-xs text-muted-foreground hover:text-red-400 transition-colors">Fleet</Link>
          <Link href="/barter" className="text-xs text-muted-foreground hover:text-red-400 transition-colors">Knowledge</Link>
          <TonWalletIndicator />
        </div>
      </div>
    </nav>
  );
}
