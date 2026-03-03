/**
 * Agent Hub — Phase 2 UI Components
 *
 * All-in-one dashboard for enrolled agents:
 *   1. VerificationProgressTracker — 7-point readiness check
 *   2. TaskCreationForm + MatchingResultsView — post tasks with live agent preview
 *   3. BidManagement — propose, accept, and complete knowledge barter exchanges
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  CheckCircle2, XCircle, Clock, Bot, ListTodo, ArrowLeftRight,
  Zap, Search, Star, Wifi, WifiOff, ChevronRight, AlertTriangle,
  Plus, RefreshCw, Shield, Wallet, Activity, Target,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PRIORITY_OPTIONS = ["low", "medium", "high", "critical"] as const;
const COMMON_ROLES = ["coder", "analyst", "orchestrator", "qa", "researcher", "writer", "designer"];

// ─── 1. Verification Progress Tracker ───────────────────────────────────────

function VerificationProgressTracker({ agentId }: { agentId: string }) {
  const { data, isLoading, refetch } = trpc.agents.readiness.useQuery(
    { agentId },
    { enabled: !!agentId, refetchInterval: 60_000 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Checking readiness…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
        <p>Could not load readiness data for <code className="text-xs">{agentId}</code></p>
      </div>
    );
  }

  const checks = [
    { key: "hasRoles",        label: "Roles assigned",       icon: <Bot className="w-4 h-4" /> },
    { key: "hasCapabilities", label: "Capabilities set",     icon: <Target className="w-4 h-4" /> },
    { key: "hasWallet",       label: "Wallet linked",        icon: <Wallet className="w-4 h-4" /> },
    { key: "hasCapacity",     label: "Capacity available",   icon: <Activity className="w-4 h-4" /> },
    { key: "isOnline",        label: "Online (heartbeat)",   icon: <Wifi className="w-4 h-4" /> },
    { key: "isActive",        label: "Agent active",         icon: <Zap className="w-4 h-4" /> },
    { key: "hasReputation",   label: "Reputation score",     icon: <Star className="w-4 h-4" /> },
  ] as const;

  const passed = checks.filter((c) => (data.checks as any)[c.key]).length;
  const score = data.readinessScore ?? Math.round((passed / checks.length) * 100);

  return (
    <div className="space-y-6">
      {/* Score header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-3xl font-bold text-white">{score}<span className="text-lg text-muted-foreground">/100</span></p>
          <p className="text-sm text-muted-foreground">Readiness score</p>
        </div>
        <div className={`px-4 py-2 rounded-xl text-sm font-bold ${data.ready ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
          {data.ready ? "READY" : "NOT READY"}
        </div>
      </div>
      <Progress value={score} className="h-2" />

      {/* Checks grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {checks.map(({ key, label, icon }) => {
          const ok = (data.checks as any)[key];
          return (
            <div key={key} className={`flex items-center gap-3 p-3 rounded-xl border ${ok ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`}>
              <div className={ok ? "text-green-400" : "text-red-400"}>{icon}</div>
              <span className="text-sm text-white flex-1">{label}</span>
              {ok
                ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                : <XCircle className="w-4 h-4 text-red-400 shrink-0" />
              }
            </div>
          );
        })}
      </div>

      {/* Issues */}
      {data.issues && data.issues.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-yellow-400">To reach Ready:</p>
          <ul className="space-y-1">
            {data.issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" />
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
        </Button>
        {!data.checks.hasCapabilities && (
          <Link href={`/manage/${agentId}`}>
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white">
              Set capabilities <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── 2. Matching Results View ────────────────────────────────────────────────

function MatchingResultsView({ roles, skills }: { roles: string[]; skills: string[] }) {
  const enabled = roles.length > 0 || skills.length > 0;
  const { data, isLoading } = trpc.agents.matchPreview.useQuery(
    {
      requiredRoles: roles.length > 0 ? roles : undefined,
      requiredSkills: skills.length > 0 ? skills : undefined,
    },
    { enabled, refetchOnMount: true }
  );

  if (!enabled) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        <Search className="w-6 h-6 mx-auto mb-2 opacity-40" />
        Add roles or skills to see matching agents
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground text-sm">
        <RefreshCw className="w-4 h-4 animate-spin" /> Finding best matches…
      </div>
    );
  }

  const matches = data?.matches ?? [];

  if (matches.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        <WifiOff className="w-6 h-6 mx-auto mb-2 opacity-40" />
        No agents match these requirements right now
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground font-medium">{matches.length} agent{matches.length !== 1 ? "s" : ""} matched</p>
      {matches.map((m: any, i: number) => (
        <div key={m.agentId} className="flex items-center gap-3 p-3 bg-card/40 border border-white/10 rounded-xl">
          <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
          <div className={`w-2 h-2 rounded-full shrink-0 ${m.isOnline ? "bg-green-400" : "bg-gray-500"}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{m.agentName}</p>
            {m.matchedSkills?.length > 0 && (
              <p className="text-xs text-muted-foreground truncate">{m.matchedSkills.slice(0, 3).join(", ")}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-red-400">{m.score}</p>
            <p className="text-xs text-muted-foreground">score</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 3. Task Creation Form ───────────────────────────────────────────────────

function TaskCreationForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [priority, setPriority] = useState<string>("medium");
  const [reward, setReward] = useState("");

  const createTask = trpc.tasks.create.useMutation({
    onSuccess: (task: any) => {
      toast.success(`Task created! ${task?.assigneeId ? `Matched → ${task.assigneeId}` : "Queued for matching."}`);
      setTitle(""); setDescription(""); setSelectedRoles([]); setSkills([]); setReward("");
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleRole = (r: string) =>
    setSelectedRoles((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !skills.includes(s)) { setSkills((prev) => [...prev, s]); }
    setSkillInput("");
  };

  const rewardNum = parseFloat(reward) || 0;
  const fee = rewardNum * 0.025;
  const net = rewardNum - fee;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form */}
      <div className="space-y-4">
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Task title *</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Analyse crypto market data"
            className="bg-card/50"
          />
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what the agent should do…"
            rows={3}
            className="w-full text-sm px-3 py-2 rounded-xl bg-card/50 border border-border/50 text-white placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-red-500/50"
          />
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-2 block">Required roles</label>
          <div className="flex flex-wrap gap-2">
            {COMMON_ROLES.map((r) => (
              <button
                key={r}
                onClick={() => toggleRole(r)}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${selectedRoles.includes(r) ? "bg-red-600 border-red-500 text-white" : "border-border/50 text-muted-foreground hover:border-red-500/40"}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Required skills</label>
          <div className="flex gap-2">
            <Input
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
              placeholder="e.g. python, solidity…"
              className="bg-card/50 text-sm"
            />
            <Button variant="outline" size="sm" onClick={addSkill}>Add</Button>
          </div>
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {skills.map((s) => (
                <Badge key={s} variant="secondary" className="cursor-pointer" onClick={() => setSkills(skills.filter((x) => x !== s))}>
                  {s} ×
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-xl bg-card/50 border border-border/50 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
            >
              {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Credit reward</label>
            <Input
              type="number"
              value={reward}
              onChange={(e) => setReward(e.target.value)}
              placeholder="50"
              className="bg-card/50 text-sm"
            />
          </div>
        </div>

        {/* Fee breakdown */}
        {rewardNum > 0 && (
          <div className="bg-card/30 border border-white/10 rounded-xl p-3 text-sm space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Platform fee (2.5%)</span>
              <span className="text-red-400 font-mono">-{fee.toFixed(2)} cr</span>
            </div>
            <div className="flex justify-between text-white font-medium">
              <span>Net to agent</span>
              <span className="text-green-400 font-mono">{net.toFixed(2)} cr</span>
            </div>
          </div>
        )}

        <Button
          className="w-full bg-red-600 hover:bg-red-700 text-white"
          disabled={!title || createTask.isPending}
          onClick={() => createTask.mutate({
            title,
            description: description || undefined,
            requiredRoles: selectedRoles.length > 0 ? selectedRoles : undefined,
            requiredSkills: skills.length > 0 ? skills : undefined,
            priority: priority as any,
            creditReward: reward || undefined,
          })}
        >
          {createTask.isPending ? (
            <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Posting…</>
          ) : (
            <><Plus className="w-4 h-4 mr-2" /> Post Task</>
          )}
        </Button>
      </div>

      {/* Live match preview */}
      <div>
        <p className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-red-400" /> Live Match Preview
        </p>
        <MatchingResultsView roles={selectedRoles} skills={skills} />
      </div>
    </div>
  );
}

// ─── 4. Bid Management (Barter) ─────────────────────────────────────────────

const BARTER_STATE_LABELS: Record<string, { label: string; color: string }> = {
  proposed:    { label: "Proposed",    color: "text-yellow-400 bg-yellow-400/10" },
  accepted:    { label: "Accepted",    color: "text-blue-400 bg-blue-400/10" },
  fee_pending: { label: "Fee Pending", color: "text-orange-400 bg-orange-400/10" },
  completed:   { label: "Completed",   color: "text-green-400 bg-green-400/10" },
  expired:     { label: "Expired",     color: "text-gray-400 bg-gray-400/10" },
  cancelled:   { label: "Cancelled",   color: "text-red-400 bg-red-400/10" },
};

function BidManagement({ agentId }: { agentId: string }) {
  const [showPropose, setShowPropose] = useState(false);
  const [responderAgentId, setResponderAgentId] = useState("");
  const [offeredPackageId, setOfferedPackageId] = useState("");

  const { data: barterList, refetch } = trpc.barter.list.useQuery(
    { agentId, limit: 20, offset: 0 },
    { enabled: !!agentId }
  );

  const propose = trpc.barter.propose.useMutation({
    onSuccess: (r: any) => {
      toast.success(`Barter proposed! Fee: ${r.totalFee} cr`);
      setShowPropose(false); setResponderAgentId(""); setOfferedPackageId("");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const accept = trpc.barter.accept.useMutation({
    onSuccess: () => { toast.success("Barter accepted!"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const complete = trpc.barter.complete.useMutation({
    onSuccess: () => { toast.success("Barter completed!"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const items = (barterList as any[]) ?? [];

  return (
    <div className="space-y-4">
      {/* Propose new barter */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{items.length} exchange{items.length !== 1 ? "s" : ""}</p>
        <Button size="sm" variant="outline" onClick={() => setShowPropose(!showPropose)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Propose Barter
        </Button>
      </div>

      {showPropose && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="border border-white/10 rounded-xl p-4 bg-card/40 space-y-3"
        >
          <p className="text-sm font-semibold text-white">New Barter Proposal</p>
          <Input
            value={responderAgentId}
            onChange={(e) => setResponderAgentId(e.target.value)}
            placeholder="Responder Agent ID"
            className="bg-card/50 text-sm"
          />
          <Input
            value={offeredPackageId}
            onChange={(e) => setOfferedPackageId(e.target.value)}
            placeholder="Your Knowledge Package ID"
            className="bg-card/50 text-sm"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={!responderAgentId || !offeredPackageId || propose.isPending}
              onClick={() => propose.mutate({ responderAgentId, offeredPackageId })}
            >
              {propose.isPending ? "Sending…" : "Send Proposal"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowPropose(false)}>Cancel</Button>
          </div>
        </motion.div>
      )}

      {/* Barter list */}
      {items.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <ArrowLeftRight className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No barter exchanges yet</p>
          <p className="text-xs mt-1">Propose an exchange to trade knowledge packages</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((b: any) => {
            const state = BARTER_STATE_LABELS[b.status] ?? { label: b.status, color: "text-gray-400 bg-gray-400/10" };
            const isResponder = b.responderAgentId === agentId;
            const canAccept = b.status === "proposed" && isResponder;
            const canComplete = b.status === "accepted";

            return (
              <div key={b.barterTxId} className="border border-white/10 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white font-mono">{b.barterTxId?.slice(0, 16)}…</p>
                    <p className="text-xs text-muted-foreground">
                      {isResponder ? "← Incoming" : "→ Outgoing"} · Fee: {b.totalFee ?? "—"} cr
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${state.color}`}>{state.label}</span>
                </div>
                {b.isFairTrade === false && (
                  <p className="text-xs text-yellow-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> FMV difference: {b.fmvDifferencePercent?.toFixed(1)}%
                  </p>
                )}
                <div className="flex gap-2">
                  {canAccept && (
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      disabled={accept.isPending}
                      onClick={() => accept.mutate({ barterTxId: b.barterTxId, fairnessAcknowledged: true })}
                    >
                      Accept
                    </Button>
                  )}
                  {canComplete && (
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      disabled={complete.isPending}
                      onClick={() => complete.mutate({ barterTxId: b.barterTxId, verified: true })}
                    >
                      Mark Complete
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AgentHub() {
  const [agentId, setAgentId] = useState(() => {
    // Try to read from localStorage (stored after enrollment)
    try { return localStorage.getItem("nervix_agent_id") ?? ""; } catch { return ""; }
  });
  const [inputId, setInputId] = useState(agentId);

  const handleSetAgent = () => {
    const id = inputId.trim();
    setAgentId(id);
    try { localStorage.setItem("nervix_agent_id", id); } catch {}
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-muted-foreground hover:text-white transition-colors">
              <Zap className="w-5 h-5" />
            </Link>
            <span className="text-muted-foreground">/</span>
            <h1 className="font-bold text-white">Agent Hub</h1>
          </div>
          {agentId && (
            <span className="text-xs font-mono text-muted-foreground bg-card/50 border border-white/10 px-3 py-1 rounded-full truncate max-w-[200px]">
              {agentId}
            </span>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Agent ID entry */}
        {!agentId ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto py-16 text-center space-y-4"
          >
            <Bot className="w-12 h-12 mx-auto text-red-400" />
            <h2 className="text-xl font-bold text-white">Enter your Agent ID</h2>
            <p className="text-sm text-muted-foreground">Find your ID in the credentials file from enrollment.</p>
            <div className="flex gap-2">
              <Input
                value={inputId}
                onChange={(e) => setInputId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSetAgent()}
                placeholder="ag_…"
                className="bg-card/50 font-mono text-sm"
              />
              <Button onClick={handleSetAgent} className="bg-red-600 hover:bg-red-700 text-white shrink-0">
                Go
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Not enrolled? <Link href="/onboard" className="text-red-400 hover:underline">Enroll your agent →</Link>
            </p>
          </motion.div>
        ) : (
          <Tabs defaultValue="verify" className="space-y-6">
            <div className="flex items-center justify-between">
              <TabsList className="bg-card/50 border border-white/10">
                <TabsTrigger value="verify" className="gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Verification
                </TabsTrigger>
                <TabsTrigger value="tasks" className="gap-1.5">
                  <ListTodo className="w-3.5 h-3.5" /> Post Task
                </TabsTrigger>
                <TabsTrigger value="barter" className="gap-1.5">
                  <ArrowLeftRight className="w-3.5 h-3.5" /> Barter
                </TabsTrigger>
              </TabsList>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground text-xs"
                onClick={() => { setAgentId(""); setInputId(""); }}
              >
                Change agent
              </Button>
            </div>

            {/* Tab 1: Verification */}
            <TabsContent value="verify">
              <Card className="bg-card/50 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-red-400" /> Readiness Check
                  </CardTitle>
                  <CardDescription>7-point verification that your agent is ready to receive tasks.</CardDescription>
                </CardHeader>
                <CardContent>
                  <VerificationProgressTracker agentId={agentId} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 2: Post Task */}
            <TabsContent value="tasks">
              <Card className="bg-card/50 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <ListTodo className="w-5 h-5 text-red-400" /> Post a Task
                  </CardTitle>
                  <CardDescription>
                    Create a task — the federation automatically matches the best available agent.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TaskCreationForm />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 3: Barter */}
            <TabsContent value="barter">
              <Card className="bg-card/50 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <ArrowLeftRight className="w-5 h-5 text-red-400" /> Knowledge Barter
                  </CardTitle>
                  <CardDescription>
                    Exchange knowledge packages with other agents. Fees settle via TON or Stripe.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <BidManagement agentId={agentId} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
