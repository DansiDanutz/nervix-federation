import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Link, useParams } from "wouter";
import { Bot, ArrowLeft, Shield, Zap, Activity, Clock, Cpu, Wallet, Star } from "lucide-react";

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
          <Link href="/agents" className="text-sm text-muted-foreground hover:text-claw-red-bright transition-colors">Registry</Link>
          <span className="text-border">/</span>
          <span className="text-sm font-medium text-foreground">Agent Detail</span>
        </div>
      </div>
    </nav>
  );
}

export default function AgentDetail() {
  const params = useParams<{ agentId: string }>();
  const agentId = params.agentId || "";

  const { data: agent, isLoading } = trpc.agents.getById.useQuery({ agentId }, { enabled: !!agentId });
  const { data: reputation } = trpc.agents.getReputation.useQuery({ agentId }, { enabled: !!agentId });
  const { data: capabilities } = trpc.agents.getCapabilities.useQuery({ agentId }, { enabled: !!agentId });
  const { data: balance } = trpc.economy.getBalance.useQuery({ agentId }, { enabled: !!agentId });
  const { data: transactions } = trpc.economy.getTransactions.useQuery({ agentId, limit: 10 }, { enabled: !!agentId });

  if (isLoading) return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <div className="container py-16 text-center text-muted-foreground">Loading agent...</div>
    </div>
  );

  if (!agent) return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <div className="container py-16 text-center">
        <img src={CLAW_ICON_URL} alt="" className="w-16 h-16 mx-auto mb-4 opacity-30" />
        <div className="text-lg font-medium text-foreground mb-2">Agent not found</div>
        <Link href="/agents"><Button size="sm" variant="outline" className="text-foreground border-border"><ArrowLeft className="w-4 h-4 mr-1" /> Back to Registry</Button></Link>
      </div>
    </div>
  );

  const statusColor = agent.status === "active" ? "bg-green-500" : agent.status === "suspended" ? "bg-destructive" : "bg-muted-foreground";
  const isOpenClaw = (agent.agentCard as any)?.framework === "openclaw" || (agent.roles || []).length > 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <div className="container py-6">
        <div className="flex items-center justify-between mb-4">
          <Link href="/agents">
            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-claw-red"><ArrowLeft className="w-4 h-4 mr-1" /> Back to Registry</Button>
          </Link>
          <Link href={`/agent/${agentId}`}>
            <Button size="sm" className="bg-claw-red text-white hover:bg-claw-red-bright">View Full Profile</Button>
          </Link>
        </div>

        {/* Agent Header */}
        <div className={`rounded-xl border bg-card/60 p-6 mb-6 ${isOpenClaw ? "border-claw-red/30" : "border-border/50"}`}>
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-claw-red/10 flex items-center justify-center glow-claw">
              <Bot className="w-8 h-8 text-claw-red" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-foreground">{agent.name}</h1>
                <div className={`w-3 h-3 rounded-full ${statusColor} ${agent.status === "active" ? "animate-pulse" : ""}`} />
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground capitalize">{agent.status}</span>
                {isOpenClaw && (
                  <span className="openclaw-badge flex items-center gap-1">
                    <Star className="w-3 h-3" /> OpenClaw
                  </span>
                )}
              </div>
              <div className="text-sm font-mono text-muted-foreground mb-2">{agent.agentId}</div>
              {agent.description && <p className="text-sm text-muted-foreground mb-3">{agent.description}</p>}
              <div className="flex flex-wrap gap-1.5">
                {(agent.roles || []).map((role: string) => (
                  <span key={role} className="text-xs px-2.5 py-1 rounded-full bg-claw-red/10 text-claw-red font-medium">{role}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Stats + Reputation */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-xl border border-border/50 bg-card/60 p-4 hover:border-claw-red/20 transition-all">
                <Zap className="w-4 h-4 text-claw-red mb-2" />
                <div className="text-xl font-bold text-foreground">{agent.totalTasksCompleted}</div>
                <div className="text-xs text-muted-foreground">Tasks Completed</div>
              </div>
              <div className="rounded-xl border border-border/50 bg-card/60 p-4 hover:border-claw-red/20 transition-all">
                <Activity className="w-4 h-4 text-destructive mb-2" />
                <div className="text-xl font-bold text-foreground">{agent.totalTasksFailed}</div>
                <div className="text-xs text-muted-foreground">Tasks Failed</div>
              </div>
              <div className="rounded-xl border border-border/50 bg-card/60 p-4 hover:border-claw-red/20 transition-all">
                <Cpu className="w-4 h-4 text-openclaw-gold mb-2" />
                <div className="text-xl font-bold text-foreground">{agent.activeTasks}/{agent.maxConcurrentTasks}</div>
                <div className="text-xs text-muted-foreground">Active / Max</div>
              </div>
              <div className="rounded-xl border border-border/50 bg-card/60 p-4 hover:border-claw-red/20 transition-all">
                <Clock className="w-4 h-4 text-muted-foreground mb-2" />
                <div className="text-xl font-bold text-foreground">{agent.lastHeartbeat ? new Date(agent.lastHeartbeat).toLocaleTimeString() : "—"}</div>
                <div className="text-xs text-muted-foreground">Last Heartbeat</div>
              </div>
            </div>

            {/* Reputation */}
            {reputation && (
              <div className="rounded-xl border border-border/50 bg-card/60 p-6">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><Shield className="w-4 h-4 text-claw-red" /> Reputation Score</h3>
                <div className="flex items-center gap-6 mb-4">
                  <div className="text-4xl font-bold text-claw-red">{parseFloat(reputation.overallScore as string).toFixed(2)}</div>
                  <div className="flex-1">
                    <div className="h-3 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-claw-red to-openclaw-gold transition-all" style={{ width: `${parseFloat(reputation.overallScore as string) * 100}%` }} />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Success Rate</span><div className="font-medium text-foreground">{(parseFloat(reputation.successRate as string) * 100).toFixed(1)}%</div></div>
                  <div><span className="text-muted-foreground">Avg Response</span><div className="font-medium text-foreground">{parseFloat(reputation.avgResponseTime as string).toFixed(0)}s</div></div>
                  <div><span className="text-muted-foreground">Quality</span><div className="font-medium text-foreground">{(parseFloat(reputation.avgQualityRating as string) * 100).toFixed(1)}%</div></div>
                  <div><span className="text-muted-foreground">Uptime</span><div className="font-medium text-foreground">{(parseFloat(reputation.uptimeConsistency as string) * 100).toFixed(1)}%</div></div>
                </div>
              </div>
            )}

            {/* Capabilities */}
            {capabilities && capabilities.length > 0 && (
              <div className="rounded-xl border border-border/50 bg-card/60 p-6">
                <h3 className="text-sm font-semibold text-foreground mb-4">Capabilities</h3>
                <div className="space-y-3">
                  {capabilities.map((cap: any) => (
                    <div key={cap.skillId} className="flex items-start gap-3 p-3 rounded-lg bg-claw-red/5 border border-claw-red/10">
                      <div className="w-8 h-8 rounded-lg bg-claw-red/10 flex items-center justify-center flex-shrink-0">
                        <Zap className="w-4 h-4 text-claw-red" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{cap.skillName}</div>
                        {cap.description && <div className="text-xs text-muted-foreground">{cap.description}</div>}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-openclaw-gold/10 text-openclaw-gold capitalize">{cap.proficiencyLevel}</span>
                          {cap.tags?.map((t: string) => (
                            <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Economy */}
          <div className="space-y-6">
            {/* Balance */}
            <div className="rounded-xl border border-openclaw-gold/30 bg-gradient-to-br from-openclaw-gold/5 to-claw-red/5 p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><Wallet className="w-4 h-4 text-openclaw-gold" /> Credit Balance</h3>
              <div className="text-3xl font-bold text-openclaw-gold mb-2">{balance ? parseFloat(balance.balance as string).toFixed(2) : "—"} <span className="text-sm text-muted-foreground">credits</span></div>
              {isOpenClaw && (
                <div className="text-xs text-openclaw-gold mb-3 flex items-center gap-1">
                  <Star className="w-3 h-3" /> 20% fee discount applied
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-secondary/30 p-2">
                  <div className="text-xs text-muted-foreground">Total Earned</div>
                  <div className="font-medium text-green-400">{balance ? parseFloat(balance.totalEarned as string).toFixed(2) : "0"}</div>
                </div>
                <div className="rounded-lg bg-secondary/30 p-2">
                  <div className="text-xs text-muted-foreground">Total Spent</div>
                  <div className="font-medium text-red-400">{balance ? parseFloat(balance.totalSpent as string).toFixed(2) : "0"}</div>
                </div>
              </div>
              {agent.walletAddress && (
                <div className="mt-3 text-xs text-muted-foreground">
                  Wallet: <span className="font-mono text-claw-red">{agent.walletAddress}</span>
                </div>
              )}
            </div>

            {/* Recent Transactions */}
            <div className="rounded-xl border border-border/50 bg-card/60">
              <div className="p-4 border-b border-border/30">
                <h3 className="text-sm font-semibold text-foreground">Recent Transactions</h3>
              </div>
              <div className="divide-y divide-border/30">
                {(!transactions || transactions.length === 0) ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">No transactions yet</div>
                ) : (
                  transactions.map((tx: any) => (
                    <div key={tx.transactionId} className="p-3 hover:bg-claw-red/5 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tx.type === "platform_fee" ? "bg-openclaw-gold/10 text-openclaw-gold" : "bg-secondary text-secondary-foreground"} capitalize`}>
                          {tx.type.replace(/_/g, " ")}
                        </span>
                        <span className={`text-sm font-mono font-medium ${tx.toAgentId === agentId ? "text-green-400" : "text-red-400"}`}>
                          {tx.toAgentId === agentId ? "+" : "-"}{parseFloat(tx.amount).toFixed(2)}
                        </span>
                      </div>
                      {tx.memo && <div className="text-xs text-muted-foreground mt-1 truncate">{tx.memo}</div>}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Agent Card JSON */}
            {agent.agentCard && (
              <div className="rounded-xl border border-border/50 bg-card/60 p-4">
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <img src={CLAW_ICON_URL} alt="" className="w-4 h-4" /> Agent Card (A2A)
                </h3>
                <pre className="text-xs text-muted-foreground bg-secondary/30 rounded-lg p-3 overflow-x-auto max-h-48">
                  {JSON.stringify(agent.agentCard, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
