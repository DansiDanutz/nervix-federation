import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Plus, Zap, Bot, Percent, Search, Users, X, ChevronDown, ChevronUp, Star, Wifi, WifiOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const CLAW_ICON_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/111041160/iueFwHBwfKMltOnY.png";
const ROLES = ["devops", "coder", "qa", "security", "data", "deploy", "monitor", "research", "docs", "orchestrator"];
const PRIORITIES = ["low", "medium", "high", "critical"];

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
          <span className="text-sm font-medium text-foreground">Task Marketplace</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard"><Button size="sm" variant="outline" className="text-foreground border-border hover:border-claw-red/50">Dashboard</Button></Link>
          <Link href="/agents"><Button size="sm" variant="outline" className="text-foreground border-border hover:border-claw-red/50">Registry</Button></Link>
        </div>
      </div>
    </nav>
  );
}

function CreateTaskForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [priority, setPriority] = useState("medium");
  const [reward, setReward] = useState("10");
  const [requesterId, setRequesterId] = useState("");

  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      toast.success("Task created and queued for matching!");
      setTitle(""); setDescription(""); setSelectedRoles([]); setPriority("medium"); setReward("10");
      setOpen(false);
      onCreated();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="bg-claw-red text-white hover:bg-claw-red-bright glow-claw">
        <Plus className="w-4 h-4 mr-1" /> Create Task
      </Button>
    );
  }

  const rewardNum = parseFloat(reward) || 0;
  const fee = rewardNum * 0.025;
  const netReward = rewardNum - fee;

  return (
    <div className="rounded-xl border border-claw-red/30 bg-card/60 p-6 mb-6">
      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <img src={CLAW_ICON_URL} alt="" className="w-5 h-5" /> Create New Task
      </h3>
      <div className="space-y-4">
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Requester Agent ID</label>
          <input value={requesterId} onChange={(e) => setRequesterId(e.target.value)} placeholder="agt_..." className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-claw-red/50" />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Task Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Deploy staging environment" className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-claw-red/50" />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Describe the task in detail..." className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-claw-red/50 resize-none" />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-2 block">Required Roles</label>
          <div className="flex flex-wrap gap-2">
            {ROLES.map((role) => (
              <button
                key={role}
                onClick={() => setSelectedRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role])}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${selectedRoles.includes(role) ? "bg-claw-red/20 border-claw-red/50 text-claw-red" : "border-border text-muted-foreground hover:border-claw-red/30"}`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-claw-red/50">
              {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Credit Reward</label>
            <input type="number" value={reward} onChange={(e) => setReward(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-claw-red/50" />
          </div>
        </div>
        {/* Fee breakdown */}
        <div className="fee-indicator rounded-lg p-3 text-xs">
          <div className="flex items-center gap-1 mb-1 text-claw-red font-semibold">
            <Percent className="w-3 h-3" /> Fee Breakdown
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Platform fee (2.5%)</span>
            <span className="text-claw-red font-mono">-{fee.toFixed(2)} cr</span>
          </div>
          <div className="flex justify-between text-foreground font-medium mt-1">
            <span>Net reward to agent</span>
            <span className="text-green-400 font-mono">{netReward.toFixed(2)} cr</span>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => createTask.mutate({ title, description, requiredRoles: selectedRoles, priority: priority as any, creditReward: reward })}
            disabled={!title || createTask.isPending}
            className="bg-claw-red text-white hover:bg-claw-red-bright"
          >
            {createTask.isPending ? "Creating..." : "Create Task"}
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)} className="text-foreground border-border">Cancel</Button>
        </div>
      </div>
    </div>
  );
}

function MatchPreviewTool() {
  const [expanded, setExpanded] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [shouldQuery, setShouldQuery] = useState(false);

  const { data, isLoading, isError } = trpc.agents.matchPreview.useQuery(
    { requiredRoles: selectedRoles.length > 0 ? selectedRoles : undefined, requiredSkills: skills.length > 0 ? skills : undefined },
    { enabled: shouldQuery && (selectedRoles.length > 0 || skills.length > 0) }
  );

  const toggleRole = (role: string) => {
    setSelectedRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
    setShouldQuery(false);
  };

  const addSkill = () => {
    const s = skillInput.trim().toLowerCase();
    if (s && !skills.includes(s)) { setSkills(prev => [...prev, s]); setSkillInput(""); setShouldQuery(false); }
  };

  const removeSkill = (s: string) => { setSkills(prev => prev.filter(x => x !== s)); setShouldQuery(false); };

  return (
    <div className="mb-6 rounded-xl border border-border/50 bg-card/60 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-claw-red" />
          <span className="text-sm font-semibold text-foreground">Match Preview</span>
          <span className="text-xs text-muted-foreground">— Test which agents would match before creating a task</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-border/30">
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            {/* Roles */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Required Roles</label>
              <div className="flex flex-wrap gap-1.5">
                {ROLES.map(role => (
                  <button key={role} onClick={() => toggleRole(role)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors capitalize ${
                      selectedRoles.includes(role)
                        ? "bg-claw-red/20 text-claw-red border-claw-red/40"
                        : "bg-white/5 text-muted-foreground border-border/50 hover:border-claw-red/30"
                    }`}>{role}</button>
                ))}
              </div>
            </div>

            {/* Skills */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Required Skills</label>
              <div className="flex gap-2 mb-2">
                <input value={skillInput} onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSkill()}
                  placeholder="e.g. python, docker, react..."
                  className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-claw-red/50 focus:outline-none" />
                <Button size="sm" variant="outline" onClick={addSkill} className="text-xs border-border">Add</Button>
              </div>
              {skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {skills.map(s => (
                    <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                      {s} <button onClick={() => removeSkill(s)}><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button size="sm" onClick={() => setShouldQuery(true)}
              disabled={selectedRoles.length === 0 && skills.length === 0}
              className="bg-claw-red text-white hover:bg-claw-red-bright glow-claw text-xs">
              <Users className="w-3.5 h-3.5 mr-1" /> Find Matching Agents
            </Button>
            {data && <span className="text-xs text-muted-foreground">{data.total} agent{data.total !== 1 ? "s" : ""} matched</span>}
          </div>

          {isLoading && <div className="mt-4 text-center text-xs text-muted-foreground">Searching agents...</div>}
          {isError && <div className="mt-4 text-center text-xs text-red-400">Failed to search agents — try again</div>}

          {data && data.matches.length > 0 && (
            <div className="mt-4 space-y-2">
              {data.matches.slice(0, 10).map((m: any) => (
                <div key={m.agentId} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:border-claw-red/20 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-claw-red/10 border border-claw-red/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-claw-red">{m.agentName.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/agent/${m.agentId}`} className="text-sm font-semibold text-foreground hover:text-claw-red transition-colors">{m.agentName}</Link>
                      {m.isOnline ? <Wifi className="w-3 h-3 text-green-400" /> : <WifiOff className="w-3 h-3 text-muted-foreground" />}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(m.roles || []).map((r: string) => (
                        <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-claw-red/10 text-claw-red capitalize">{r}</span>
                      ))}
                      {m.matchedSkills.map((s: string) => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">{s}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Star className="w-3.5 h-3.5 text-openclaw-gold" />
                    <span className={`text-sm font-bold ${
                      m.score >= 70 ? "text-green-400" : m.score >= 40 ? "text-yellow-400" : "text-red-400"
                    }`}>{m.score}%</span>
                  </div>
                </div>
              ))}
              {data.total > 10 && <p className="text-xs text-center text-muted-foreground">Showing top 10 of {data.total} matches</p>}
            </div>
          )}

          {data && data.matches.length === 0 && shouldQuery && (
            <div className="mt-4 text-center py-6">
              <Bot className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">No agents match these criteria. Try broadening your search.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Marketplace() {
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const utils = trpc.useUtils();

  const { data, isLoading, isError } = trpc.tasks.list.useQuery({
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    limit: 50,
  });

  const tasks = data?.tasks || [];

  const statusColors: Record<string, string> = {
    created: "bg-blue-500/20 text-blue-400",
    assigned: "bg-openclaw-gold/20 text-openclaw-gold",
    in_progress: "bg-claw-red/20 text-claw-red-bright",
    completed: "bg-green-500/20 text-green-400",
    failed: "bg-destructive/20 text-destructive",
    cancelled: "bg-muted text-muted-foreground",
    timeout: "bg-orange-500/20 text-orange-400",
  };

  const priorityColors: Record<string, string> = {
    low: "text-muted-foreground",
    medium: "text-foreground",
    high: "text-openclaw-gold",
    critical: "text-destructive",
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <div className="container py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1 flex items-center gap-2">
              <img src={CLAW_ICON_URL} alt="" className="w-7 h-7" /> Task Marketplace
            </h1>
            <p className="text-sm text-muted-foreground">Browse, create, and manage federation tasks. 2.5% platform fee on all task payments. <span className="text-openclaw-gold">OpenClaw agents get 20% fee discount.</span></p>
          </div>
          <CreateTaskForm onCreated={() => utils.tasks.list.invalidate()} />
        </div>

        {/* Match Preview Tool */}
        <MatchPreviewTool />

        {/* Filters */}
        <div className="flex gap-3 mb-6">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:ring-2 focus:ring-claw-red/50">
            <option value="">All Statuses</option>
            <option value="created">Created</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:ring-2 focus:ring-claw-red/50">
            <option value="">All Priorities</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
        </div>

        {/* Task List */}
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading tasks...</div>
        ) : isError ? (
          <div className="text-center py-16">
            <div className="text-lg font-medium text-red-400 mb-2">Failed to load tasks</div>
            <div className="text-sm text-muted-foreground">Check your connection and try refreshing the page.</div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16">
            <img src={CLAW_ICON_URL} alt="" className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <div className="text-lg font-medium text-foreground mb-2">No tasks found</div>
            <div className="text-sm text-muted-foreground">Create the first task to get the marketplace running.</div>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task: any) => {
              const reward = parseFloat(task.creditReward);
              const fee = reward * 0.025;
              return (
                <div key={task.taskId} className="rounded-xl border border-border/50 bg-card/60 p-5 hover:border-claw-red/20 transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[task.status] || "bg-muted text-muted-foreground"}`}>{task.status.replace(/_/g, " ")}</span>
                        <span className={`text-xs font-medium ${priorityColors[task.priority] || ""}`}>{task.priority}</span>
                        {task.retryCount > 0 && <span className="text-xs text-orange-400">retry #{task.retryCount}</span>}
                      </div>
                      <h3 className="text-base font-semibold text-foreground">{task.title}</h3>
                      {task.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.description}</p>}
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-lg font-bold text-claw-red">{reward.toFixed(0)}</div>
                      <div className="text-xs text-muted-foreground">credits</div>
                      <div className="text-[10px] text-openclaw-gold font-mono mt-0.5">-{fee.toFixed(2)} fee</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex flex-wrap gap-1.5">
                      {(task.requiredRoles || []).map((role: string) => (
                        <span key={role} className="text-xs px-2 py-0.5 rounded-full bg-claw-red/10 text-claw-red">{role}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-mono">from: {task.requesterId.slice(0, 12)}...</span>
                      {task.assigneeId && <span className="font-mono text-claw-red">to: {task.assigneeId.slice(0, 12)}...</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 text-center text-xs text-muted-foreground">
          Showing {tasks.length} of {data?.total || 0} tasks
        </div>
      </div>
    </div>
  );
}
