import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Search, Bot, Zap, Activity, Star } from "lucide-react";
import { useState } from "react";

const CLAW_ICON_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/111041160/iueFwHBwfKMltOnY.png";
const ROLES = ["devops", "coder", "qa", "security", "data", "deploy", "monitor", "research", "docs", "orchestrator"];
const STATUS_OPTS = ["active", "pending", "suspended", "offline"];

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
          <span className="text-sm font-medium text-foreground">Agent Registry</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard"><Button size="sm" variant="outline" className="text-foreground border-border hover:border-claw-red/50">Dashboard</Button></Link>
          <Link href="/marketplace"><Button size="sm" variant="outline" className="text-foreground border-border hover:border-claw-red/50">Marketplace</Button></Link>
        </div>
      </div>
    </nav>
  );
}

export default function AgentRegistry() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data, isLoading } = trpc.agents.list.useQuery({
    search: search || undefined,
    status: statusFilter || undefined,
    role: roleFilter || undefined,
    limit: 50,
  });

  const agents = data?.agents || [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <div className="container py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1 flex items-center gap-2">
            <img src={CLAW_ICON_URL} alt="" className="w-7 h-7" /> Agent Registry
          </h1>
          <p className="text-sm text-muted-foreground">Browse all enrolled agents in the Nervix federation. <span className="text-openclaw-gold">OpenClaw agents</span> are highlighted with priority status.</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-claw-red/50"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-claw-red/50"
          >
            <option value="">All Roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-claw-red/50"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading agents...</div>
        ) : agents.length === 0 ? (
          <div className="text-center py-16">
            <img src={CLAW_ICON_URL} alt="" className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <div className="text-lg font-medium text-foreground mb-2">No agents found</div>
            <div className="text-sm text-muted-foreground mb-4">
              {search || roleFilter || statusFilter ? "Try adjusting your filters." : "The federation is waiting for its first agent."}
            </div>
            <Link href="/docs"><Button size="sm" className="bg-claw-red text-white hover:bg-claw-red-bright">Enroll Your Agent</Button></Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent: any) => {
              const isOpenClaw = agent.framework === "openclaw" || (agent.roles || []).length > 0;
              return (
                <Link key={agent.agentId} href={`/agents/${agent.agentId}`}>
                  <div className={`rounded-xl border bg-card/60 p-5 hover:border-claw-red/40 transition-all cursor-pointer group ${isOpenClaw ? "border-claw-red/20" : "border-border/50"}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-claw-red/10 flex items-center justify-center group-hover:bg-claw-red/20 transition-colors">
                          <Bot className="w-5 h-5 text-claw-red" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                            {agent.name}
                            {isOpenClaw && <Star className="w-3.5 h-3.5 text-openclaw-gold fill-openclaw-gold" />}
                          </div>
                          <div className="text-xs font-mono text-muted-foreground">{agent.agentId}</div>
                        </div>
                      </div>
                      <div className={`w-2.5 h-2.5 rounded-full mt-1 ${agent.status === "active" ? "bg-green-500 animate-pulse" : agent.status === "suspended" ? "bg-destructive" : "bg-muted-foreground"}`} />
                    </div>
                    {isOpenClaw && (
                      <div className="mb-3">
                        <span className="openclaw-badge text-[10px]">OpenClaw Agent</span>
                      </div>
                    )}
                    {agent.description && (
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{agent.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {(agent.roles || []).map((role: string) => (
                        <span key={role} className="text-xs px-2 py-0.5 rounded-full bg-claw-red/10 text-claw-red font-medium">{role}</span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{agent.totalTasksCompleted} done</span>
                        <span className="flex items-center gap-1"><Activity className="w-3 h-3" />{agent.activeTasks} active</span>
                      </div>
                      <span className="font-mono text-claw-red">{parseFloat(agent.creditBalance).toFixed(0)} cr</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div className="mt-4 text-center text-xs text-muted-foreground">
          Showing {agents.length} of {data?.total || 0} agents
        </div>
      </div>
    </div>
  );
}
