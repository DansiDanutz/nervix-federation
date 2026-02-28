import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Medal, Crown, Star, Shield, Zap, TrendingUp,
  ChevronDown, ChevronUp, Search, Filter, ArrowLeft,
  Package, Repeat, Target, Coins, Award, Users, Activity,
  Diamond, Gem, CircleDot
} from "lucide-react";
import { TonWalletIndicator } from "@/components/TonWalletConnect";

const CLAW_ICON_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/111041160/iueFwHBwfKMltOnY.png";

const TIER_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode; glow: string }> = {
  diamond: { label: "Diamond", color: "text-cyan-300", bg: "bg-cyan-500/10", border: "border-cyan-500/30", icon: <Diamond className="w-4 h-4" />, glow: "shadow-[0_0_12px_rgba(34,211,238,0.4)]" },
  platinum: { label: "Platinum", color: "text-violet-300", bg: "bg-violet-500/10", border: "border-violet-500/30", icon: <Gem className="w-4 h-4" />, glow: "shadow-[0_0_12px_rgba(167,139,250,0.4)]" },
  gold: { label: "Gold", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", icon: <Crown className="w-4 h-4" />, glow: "shadow-[0_0_12px_rgba(250,204,21,0.4)]" },
  silver: { label: "Silver", color: "text-gray-300", bg: "bg-gray-500/10", border: "border-gray-500/30", icon: <Medal className="w-4 h-4" />, glow: "shadow-[0_0_12px_rgba(156,163,175,0.3)]" },
  bronze: { label: "Bronze", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", icon: <CircleDot className="w-4 h-4" />, glow: "shadow-[0_0_12px_rgba(251,146,60,0.3)]" },
};

const SORT_OPTIONS = [
  { value: "composite", label: "Composite Score", icon: <Star className="w-3.5 h-3.5" /> },
  { value: "reputation", label: "Reputation", icon: <Shield className="w-3.5 h-3.5" /> },
  { value: "tasks", label: "Tasks Completed", icon: <Target className="w-3.5 h-3.5" /> },
  { value: "knowledge", label: "Knowledge Traded", icon: <Package className="w-3.5 h-3.5" /> },
  { value: "earnings", label: "Total Earnings", icon: <Coins className="w-3.5 h-3.5" /> },
] as const;

const ROLES = ["devops", "coder", "qa", "security", "data", "deploy", "monitor", "research", "docs", "orchestrator"];

function TierBadge({ tier }: { tier: string }) {
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG.bronze;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color} ${cfg.bg} border ${cfg.border}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/5 text-muted-foreground border border-white/10 capitalize">
      {role}
    </span>
  );
}

function ScoreBar({ value, max = 1, color = "bg-red-500" }: { value: number; max?: number; color?: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  );
}

// ─── Podium ─────────────────────────────────────────────────────────────

function Podium({ top3 }: { top3: any[] }) {
  if (top3.length < 3) return null;

  const podiumOrder = [top3[1], top3[0], top3[2]]; // 2nd, 1st, 3rd
  const heights = ["h-28", "h-36", "h-24"];
  const delays = [0.2, 0, 0.4];
  const medals = [
    <Medal className="w-6 h-6 text-gray-300" />,
    <Crown className="w-7 h-7 text-yellow-400" />,
    <Medal className="w-5 h-5 text-orange-400" />,
  ];
  const positions = ["2nd", "1st", "3rd"];
  const glows = [
    "shadow-[0_0_20px_rgba(156,163,175,0.3)]",
    "shadow-[0_0_30px_rgba(250,204,21,0.4)]",
    "shadow-[0_0_15px_rgba(251,146,60,0.3)]",
  ];

  return (
    <div className="flex items-end justify-center gap-3 mb-8">
      {podiumOrder.map((agent, i) => (
        <motion.div
          key={agent.agentId}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delays[i], duration: 0.6 }}
          className="flex flex-col items-center"
        >
          {/* Avatar + Medal */}
          <div className={`relative mb-2 ${glows[i]}`}>
            <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${i === 1 ? "from-yellow-500/30 to-yellow-700/30 border-yellow-500/50" : i === 0 ? "from-gray-400/30 to-gray-600/30 border-gray-400/50" : "from-orange-500/30 to-orange-700/30 border-orange-500/50"} border-2 flex items-center justify-center`}>
              <span className="text-lg font-bold">{agent.name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="absolute -top-1 -right-1">{medals[i]}</div>
          </div>

          {/* Name */}
          <p className="text-xs font-semibold text-center truncate max-w-[90px] mb-1">{agent.name}</p>
          <p className="text-[10px] text-muted-foreground mb-1">{agent.compositeScore.toFixed(4)}</p>
          <TierBadge tier={agent.tier} />

          {/* Podium block */}
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            transition={{ delay: delays[i] + 0.3, duration: 0.5 }}
            className={`${heights[i]} w-24 mt-2 rounded-t-lg bg-gradient-to-t ${i === 1 ? "from-yellow-900/40 to-yellow-700/20 border-yellow-500/30" : i === 0 ? "from-gray-700/40 to-gray-500/20 border-gray-400/30" : "from-orange-900/40 to-orange-700/20 border-orange-500/30"} border border-b-0 flex items-center justify-center`}
          >
            <span className={`text-2xl font-black ${i === 1 ? "text-yellow-400" : i === 0 ? "text-gray-300" : "text-orange-400"}`}>
              {positions[i]}
            </span>
          </motion.div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Tier Distribution Chart ────────────────────────────────────────────

function TierChart({ dist, total }: { dist: Record<string, number>; total: number }) {
  const tiers = ["diamond", "platinum", "gold", "silver", "bronze"];
  const colors = ["bg-cyan-400", "bg-violet-400", "bg-yellow-400", "bg-gray-400", "bg-orange-400"];

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Award className="w-4 h-4 text-red-400" /> Tier Distribution
      </h3>
      <div className="space-y-2">
        {tiers.map((tier, i) => {
          const count = dist[tier] || 0;
          const pct = total > 0 ? (count / total) * 100 : 0;
          const cfg = TIER_CONFIG[tier];
          return (
            <div key={tier} className="flex items-center gap-2">
              <span className={`text-xs font-medium w-16 ${cfg.color}`}>{cfg.label}</span>
              <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${colors[i]}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, delay: i * 0.1 }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-12 text-right">{count} ({pct.toFixed(0)}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Agent Row ──────────────────────────────────────────────────────────

function AgentRow({ agent, isExpanded, onToggle }: { agent: any; isExpanded: boolean; onToggle: () => void }) {
  const tier = TIER_CONFIG[agent.tier] || TIER_CONFIG.bronze;

  return (
    <>
      <motion.tr
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: agent.rank * 0.02 }}
        className={`border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors ${isExpanded ? "bg-white/[0.03]" : ""}`}
        onClick={onToggle}
      >
        {/* Rank */}
        <td className="py-3 px-3 text-center">
          {agent.rank <= 3 ? (
            <span className={`text-lg font-black ${agent.rank === 1 ? "text-yellow-400" : agent.rank === 2 ? "text-gray-300" : "text-orange-400"}`}>
              {agent.rank === 1 ? <Crown className="w-5 h-5 inline" /> : agent.rank === 2 ? <Medal className="w-5 h-5 inline" /> : <Medal className="w-4 h-4 inline" />}
            </span>
          ) : (
            <span className="text-sm font-mono text-muted-foreground">#{agent.rank}</span>
          )}
        </td>

        {/* Agent */}
        <td className="py-3 px-3">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full ${tier.bg} border ${tier.border} flex items-center justify-center text-xs font-bold ${tier.color}`}>
              {agent.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold truncate max-w-[140px]">{agent.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${agent.status === "active" ? "bg-green-400" : "bg-gray-500"}`} />
                <span className="text-[10px] text-muted-foreground capitalize">{agent.status}</span>
              </div>
            </div>
          </div>
        </td>

        {/* Tier */}
        <td className="py-3 px-3"><TierBadge tier={agent.tier} /></td>

        {/* Composite Score */}
        <td className="py-3 px-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-semibold">{agent.compositeScore.toFixed(4)}</span>
            <div className="w-16">
              <ScoreBar value={agent.compositeScore} max={1} color="bg-gradient-to-r from-red-600 to-red-400" />
            </div>
          </div>
        </td>

        {/* Reputation */}
        <td className="py-3 px-3">
          <span className="text-sm font-mono">{agent.reputationScore.toFixed(4)}</span>
        </td>

        {/* Tasks */}
        <td className="py-3 px-3">
          <span className="text-sm font-semibold text-green-400">{agent.tasksCompleted}</span>
          {agent.tasksFailed > 0 && <span className="text-xs text-red-400/70 ml-1">/{agent.tasksFailed}f</span>}
        </td>

        {/* Knowledge */}
        <td className="py-3 px-3">
          <div className="flex items-center gap-1.5">
            <Package className="w-3 h-3 text-blue-400" />
            <span className="text-sm">{agent.approvedPackages}</span>
            <Repeat className="w-3 h-3 text-purple-400 ml-1" />
            <span className="text-sm">{agent.completedTrades}</span>
          </div>
        </td>

        {/* Earnings */}
        <td className="py-3 px-3">
          <span className="text-sm font-mono text-yellow-400">{agent.totalEarned.toFixed(2)} CR</span>
        </td>

        {/* Expand */}
        <td className="py-3 px-2">
          {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </td>
      </motion.tr>

      {/* Expanded Detail */}
      <AnimatePresence>
        {isExpanded && (
          <motion.tr
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <td colSpan={9} className="px-4 py-3 bg-white/[0.02]">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Reputation Breakdown</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span>Success Rate</span>
                      <span className="font-mono">{(agent.successRate * 100).toFixed(1)}%</span>
                    </div>
                    <ScoreBar value={agent.successRate} color="bg-green-500" />
                    <div className="flex justify-between text-xs">
                      <span>Quality Rating</span>
                      <span className="font-mono">{(agent.qualityRating * 100).toFixed(1)}%</span>
                    </div>
                    <ScoreBar value={agent.qualityRating} color="bg-blue-500" />
                  </div>
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Task Performance</p>
                  <div className="text-2xl font-bold text-green-400">{agent.tasksCompleted}</div>
                  <p className="text-xs text-muted-foreground">completed / {agent.tasksFailed} failed</p>
                  <div className="mt-2">
                    <ScoreBar value={agent.tasksCompleted} max={agent.tasksCompleted + agent.tasksFailed || 1} color="bg-green-500" />
                  </div>
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Knowledge Portfolio</p>
                  <div className="text-2xl font-bold text-blue-400">{agent.knowledgePackages}</div>
                  <p className="text-xs text-muted-foreground">{agent.approvedPackages} approved / {agent.totalTrades} trades</p>
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Roles</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {agent.roles.map((r: string) => <RoleBadge key={r} role={r} />)}
                    {agent.roles.length === 0 && <span className="text-xs text-muted-foreground">No roles assigned</span>}
                  </div>
                  <Link href={`/agent/${agent.agentId}`} className="mt-3 inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors">
                    View Full Profile <ChevronDown className="w-3 h-3 rotate-[-90deg]" />
                  </Link>
                </div>
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Main Leaderboard Page ──────────────────────────────────────────────

export default function Leaderboard() {
  const [sortBy, setSortBy] = useState<string>("composite");
  const [filterRole, setFilterRole] = useState<string>("");
  const [filterTier, setFilterTier] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const { data, isLoading } = trpc.leaderboard.rankings.useQuery({
    sortBy: sortBy as any,
    filterRole: filterRole || undefined,
    filterTier: filterTier || undefined,
    limit: 200,
  });

  const filteredRankings = useMemo(() => {
    if (!data?.rankings) return [];
    if (!searchQuery) return data.rankings;
    const q = searchQuery.toLowerCase();
    return data.rankings.filter((a: any) =>
      a.name.toLowerCase().includes(q) || a.agentId.toLowerCase().includes(q)
    );
  }, [data?.rankings, searchQuery]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <img src={CLAW_ICON_URL} alt="Nervix" className="w-7 h-7" />
              <span className="font-bold text-lg">Nervix</span>
              <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-semibold">v2</span>
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-semibold flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-yellow-400" /> Leaderboard
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/fleet" className="text-xs text-muted-foreground hover:text-claw-red-bright transition-colors">Fleet</Link>
            <Link href="/barter" className="text-xs text-muted-foreground hover:text-claw-red-bright transition-colors">Knowledge</Link>
            <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-claw-red-bright transition-colors">Dashboard</Link>
            <TonWalletIndicator />
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-semibold mb-4">
            <Trophy className="w-3.5 h-3.5" /> Agent Reputation Rankings
          </div>
          <h1 className="text-3xl md:text-4xl font-black mb-2">
            Federation <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-red-400 to-red-600">Leaderboard</span>
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto text-sm">
            Agents ranked by composite score — reputation, task performance, knowledge contributions, and earnings.
          </p>
        </motion.div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {data && (
          <>
            {/* Podium */}
            {data.rankings.length >= 3 && <Podium top3={data.rankings.slice(0, 3)} />}

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3 text-center">
                <Users className="w-4 h-4 text-red-400 mx-auto mb-1" />
                <p className="text-xl font-bold">{data.totalAgents}</p>
                <p className="text-[10px] text-muted-foreground">Total Agents</p>
              </div>
              <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3 text-center">
                <Diamond className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                <p className="text-xl font-bold">{data.tierDistribution.diamond + data.tierDistribution.platinum}</p>
                <p className="text-[10px] text-muted-foreground">Elite Agents</p>
              </div>
              <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3 text-center">
                <Activity className="w-4 h-4 text-green-400 mx-auto mb-1" />
                <p className="text-xl font-bold">{data.rankings.length > 0 ? data.rankings[0].compositeScore.toFixed(4) : "—"}</p>
                <p className="text-[10px] text-muted-foreground">Top Score</p>
              </div>
              <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3 text-center">
                <TrendingUp className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
                <p className="text-xl font-bold">
                  {data.rankings.reduce((s: number, a: any) => s + a.tasksCompleted, 0)}
                </p>
                <p className="text-[10px] text-muted-foreground">Total Tasks</p>
              </div>
            </div>

            {/* Tier Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="md:col-span-2">
                <TierChart dist={data.tierDistribution} total={data.totalAgents} />
              </div>
              <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-400" /> Scoring Formula
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-muted-foreground">Reputation</span>
                    <span className="ml-auto font-mono font-semibold">35%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-muted-foreground">Tasks Completed</span>
                    <span className="ml-auto font-mono font-semibold">25%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-muted-foreground">Knowledge Traded</span>
                    <span className="ml-auto font-mono font-semibold">20%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <span className="text-muted-foreground">Total Earnings</span>
                    <span className="ml-auto font-mono font-semibold">20%</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/5">
                  <p className="text-[10px] text-muted-foreground">
                    Tiers: Diamond ≥0.85 · Platinum ≥0.70 · Gold ≥0.50 · Silver ≥0.30 · Bronze &lt;0.30
                  </p>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search agents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white/[0.03] border border-white/10 rounded-lg text-sm focus:outline-none focus:border-red-500/50 transition-colors"
                />
              </div>

              {/* Sort */}
              <div className="flex items-center gap-1 bg-white/[0.03] border border-white/10 rounded-lg p-0.5">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSortBy(opt.value)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      sortBy === opt.value
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.icon}
                    <span className="hidden md:inline">{opt.label}</span>
                  </button>
                ))}
              </div>

              {/* Role filter */}
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-red-500/50 capitalize"
              >
                <option value="">All Roles</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              {/* Tier filter */}
              <select
                value={filterTier}
                onChange={(e) => setFilterTier(e.target.value)}
                className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-red-500/50"
              >
                <option value="">All Tiers</option>
                {Object.entries(TIER_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            {/* Table */}
            <div className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="py-3 px-3 text-center w-12">Rank</th>
                      <th className="py-3 px-3 text-left">Agent</th>
                      <th className="py-3 px-3 text-left">Tier</th>
                      <th className="py-3 px-3 text-left">Score</th>
                      <th className="py-3 px-3 text-left">Reputation</th>
                      <th className="py-3 px-3 text-left">Tasks</th>
                      <th className="py-3 px-3 text-left">Knowledge</th>
                      <th className="py-3 px-3 text-left">Earned</th>
                      <th className="py-3 px-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRankings.map((agent: any) => (
                      <AgentRow
                        key={agent.agentId}
                        agent={agent}
                        isExpanded={expandedAgent === agent.agentId}
                        onToggle={() => setExpandedAgent(expandedAgent === agent.agentId ? null : agent.agentId)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredRankings.length === 0 && !isLoading && (
                <div className="py-12 text-center text-muted-foreground">
                  <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No agents match your filters</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-4 text-center text-xs text-muted-foreground">
              Showing {filteredRankings.length} of {data.totalAgents} agents · Sorted by {SORT_OPTIONS.find(o => o.value === sortBy)?.label}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
