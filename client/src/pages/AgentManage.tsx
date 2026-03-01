import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useRoute, useLocation } from "wouter";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ArrowLeft, Save, Trash2, RefreshCw, Shield, Zap, Wallet,
  Bot, CheckCircle, AlertTriangle, Loader2, Globe, Key,
  Cpu, Target, Settings, Activity, ExternalLink, Pencil,
  Plus, X, RotateCcw, Heart, Wifi, WifiOff, Clock, BarChart3,
  HardDrive, MemoryStick, Server
} from "lucide-react";
import { toast } from "sonner";
import { AGENT_ROLES, ROLE_DESCRIPTIONS } from "../../../shared/nervix-types";
import type { AgentRole } from "../../../shared/nervix-types";

const PROFICIENCY_LEVELS = ["beginner", "intermediate", "advanced", "expert"] as const;
const PROFICIENCY_COLORS: Record<string, string> = {
  beginner: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  intermediate: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  advanced: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  expert: "bg-purple-500/10 text-purple-400 border-purple-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  suspended: "bg-red-500/10 text-red-400 border-red-500/30",
  offline: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
};

type Capability = {
  skillId: string;
  skillName: string;
  description: string;
  tags: string[];
  proficiencyLevel: typeof PROFICIENCY_LEVELS[number];
};

// ─── Heartbeat Status Helpers ────────────────────────────────────────────────
const LIVE_STATUS_CONFIG: Record<string, { color: string; icon: typeof Wifi; label: string }> = {
  online: { color: "text-emerald-400", icon: Wifi, label: "Online" },
  degraded: { color: "text-amber-400", icon: Clock, label: "Degraded" },
  offline: { color: "text-zinc-500", icon: WifiOff, label: "Offline" },
};

function formatElapsed(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s ago`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.round(ms / 3600000)}h ago`;
  return `${Math.round(ms / 86400000)}d ago`;
}

function HeartbeatPanel({ agentId, stats, history, liveStatuses, isLoading, onRefresh }: {
  agentId: string;
  stats: any;
  history: any[] | undefined;
  liveStatuses: any[] | undefined;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const thisAgent = liveStatuses?.find((a: any) => a.agentId === agentId);
  const liveStatus = thisAgent?.liveStatus || "offline";
  const statusCfg = LIVE_STATUS_CONFIG[liveStatus] || LIVE_STATUS_CONFIG.offline;
  const StatusIcon = statusCfg.icon;

  if (isLoading) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Live Status Banner */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${liveStatus === "online" ? "bg-emerald-500/10" : liveStatus === "degraded" ? "bg-amber-500/10" : "bg-zinc-500/10"}`}>
                <StatusIcon className={`w-5 h-5 ${statusCfg.color}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${statusCfg.color}`}>{statusCfg.label}</span>
                  {liveStatus === "online" && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {thisAgent?.lastHeartbeat ? `Last beat: ${formatElapsed(thisAgent.elapsedSinceHeartbeat)}` : "No heartbeats recorded"}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onRefresh}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3 text-center">
              <Heart className="w-4 h-4 mx-auto text-red-400 mb-1" />
              <p className="text-lg font-bold">{stats.totalBeats || 0}</p>
              <p className="text-[10px] text-muted-foreground">Total Beats</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3 text-center">
              <CheckCircle className="w-4 h-4 mx-auto text-emerald-400 mb-1" />
              <p className="text-lg font-bold">{stats.uptimePercent || 0}%</p>
              <p className="text-[10px] text-muted-foreground">Uptime</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3 text-center">
              <BarChart3 className="w-4 h-4 mx-auto text-blue-400 mb-1" />
              <p className="text-lg font-bold">{stats.avgLatency || 0}ms</p>
              <p className="text-[10px] text-muted-foreground">Avg Latency</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3 text-center">
              <Activity className="w-4 h-4 mx-auto text-purple-400 mb-1" />
              <p className="text-lg font-bold">{stats.healthyBeats || 0}</p>
              <p className="text-[10px] text-muted-foreground">Healthy Beats</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Heartbeat History Timeline */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Recent Heartbeats
          </CardTitle>
          <CardDescription className="text-xs">Last 30 heartbeat events with system metrics</CardDescription>
        </CardHeader>
        <CardContent>
          {!history || history.length === 0 ? (
            <div className="text-center py-8">
              <WifiOff className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No heartbeat data yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Heartbeats are recorded when agents send periodic pings via the API
              </p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {history.map((beat: any, i: number) => (
                <div key={beat.id || i} className={`flex items-center gap-3 p-2 rounded-lg text-xs ${beat.healthy ? "bg-emerald-500/5" : "bg-red-500/5"} hover:bg-muted/20 transition-colors`}>
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${beat.healthy ? "bg-emerald-400" : "bg-red-400"}`} />
                  <span className="text-muted-foreground w-28 flex-shrink-0">
                    {new Date(beat.timestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                  {beat.latencyMs != null && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {beat.latencyMs}ms
                    </Badge>
                  )}
                  {beat.cpuUsage != null && (
                    <span className="flex items-center gap-0.5">
                      <Cpu className="w-3 h-3 text-blue-400" />
                      <span>{parseFloat(beat.cpuUsage).toFixed(0)}%</span>
                    </span>
                  )}
                  {beat.memoryUsage != null && (
                    <span className="flex items-center gap-0.5">
                      <Server className="w-3 h-3 text-purple-400" />
                      <span>{parseFloat(beat.memoryUsage).toFixed(0)}%</span>
                    </span>
                  )}
                  {beat.agentVersion && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      v{beat.agentVersion}
                    </Badge>
                  )}
                  {beat.statusMessage && (
                    <span className="text-muted-foreground truncate max-w-[150px]">{beat.statusMessage}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Integration Guide */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            Heartbeat API
          </CardTitle>
          <CardDescription className="text-xs">Send heartbeats from your agent to keep it marked as online</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-zinc-900 rounded-lg p-3 text-xs font-mono text-zinc-300 overflow-x-auto">
            <div className="text-zinc-500 mb-1"># Send heartbeat with system metrics</div>
            <div><span className="text-emerald-400">POST</span> /api/trpc/agents.heartbeat</div>
            <div className="mt-2 text-zinc-500">{'{'}</div>
            <div className="pl-4">"agentId": "{agentId}",</div>
            <div className="pl-4">"latencyMs": 42,</div>
            <div className="pl-4">"cpuUsage": 35.5,</div>
            <div className="pl-4">"memoryUsage": 62.1,</div>
            <div className="pl-4">"healthy": true,</div>
            <div className="pl-4">"agentVersion": "1.0.0"</div>
            <div className="text-zinc-500">{'}'}</div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Send heartbeats every 30-60 seconds. Agents missing 2 intervals are marked degraded; 5 intervals = offline.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function HeartbeatSidebarCard({ agentId, liveStatuses, stats }: {
  agentId: string;
  liveStatuses: any[] | undefined;
  stats: any;
}) {
  const thisAgent = liveStatuses?.find((a: any) => a.agentId === agentId);
  const liveStatus = thisAgent?.liveStatus || "offline";
  const statusCfg = LIVE_STATUS_CONFIG[liveStatus] || LIVE_STATUS_CONFIG.offline;
  const StatusIcon = statusCfg.icon;

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Heart className="w-4 h-4 text-red-400" />
          Heartbeat Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-3">
          <StatusIcon className={`w-4 h-4 ${statusCfg.color}`} />
          <span className={`text-sm font-semibold ${statusCfg.color}`}>{statusCfg.label}</span>
          {liveStatus === "online" && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
        </div>
        {thisAgent?.lastHeartbeat && (
          <p className="text-xs text-muted-foreground mb-2">
            Last: {formatElapsed(thisAgent.elapsedSinceHeartbeat)}
          </p>
        )}
        {stats && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-muted/20 rounded">
              <p className="text-muted-foreground">Uptime</p>
              <p className="font-medium">{stats.uptimePercent || 0}%</p>
            </div>
            <div className="p-2 bg-muted/20 rounded">
              <p className="text-muted-foreground">Avg Latency</p>
              <p className="font-medium">{stats.avgLatency || 0}ms</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AgentManage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/manage/:agentId");
  const agentId = params?.agentId || "";

  // Fetch agent data
  const agentQuery = trpc.agents.getById.useQuery({ agentId }, { enabled: !!agentId });
  const capsQuery = trpc.agents.getCapabilities.useQuery({ agentId }, { enabled: !!agentId });
  const readinessQuery = trpc.agents.readiness.useQuery({ agentId }, { enabled: !!agentId });
  const repQuery = trpc.agents.getReputation.useQuery({ agentId }, { enabled: !!agentId });
  const heartbeatStatsQuery = trpc.agents.heartbeatStats.useQuery({ agentId }, { enabled: !!agentId });
  const heartbeatHistoryQuery = trpc.agents.heartbeatHistory.useQuery({ agentId, limit: 30 }, { enabled: !!agentId });
  const liveStatusesQuery = trpc.agents.liveStatuses.useQuery(undefined, { refetchInterval: 15000 });

  // Mutations
  const updateCardMutation = trpc.agents.updateCard.useMutation();
  const setCapsMutation = trpc.agents.setCapabilities.useMutation();
  const linkWalletMutation = trpc.agents.linkWallet.useMutation();
  const utils = trpc.useUtils();

  // Editable state
  const [description, setDescription] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [hostname, setHostname] = useState("");
  const [region, setRegion] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<AgentRole[]>([]);
  const [walletAddress, setWalletAddress] = useState("");
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillDesc, setNewSkillDesc] = useState("");
  const [newSkillTags, setNewSkillTags] = useState("");
  const [newSkillLevel, setNewSkillLevel] = useState<typeof PROFICIENCY_LEVELS[number]>("intermediate");
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize form from fetched data
  useEffect(() => {
    if (agentQuery.data && !initialized) {
      const a = agentQuery.data;
      setDescription((a as any).description || "");
      setWebhookUrl((a as any).webhookUrl || "");
      setHostname((a as any).hostname || "");
      setRegion((a as any).region || "");
      setSelectedRoles(((a as any).roles || []) as AgentRole[]);
      setWalletAddress((a as any).walletAddress || "");
      setInitialized(true);
    }
  }, [agentQuery.data, initialized]);

  useEffect(() => {
    if (capsQuery.data && !initialized) {
      setCapabilities((capsQuery.data as any[]).map((c: any) => ({
        skillId: c.skillId,
        skillName: c.skillName,
        description: c.description || "",
        tags: c.tags || [],
        proficiencyLevel: c.proficiencyLevel || "intermediate",
      })));
    }
  }, [capsQuery.data, initialized]);

  const toggleRole = useCallback((role: AgentRole) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  }, []);

  const addCapability = useCallback(() => {
    if (!newSkillName.trim()) return;
    const skillId = `skill_${newSkillName.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`;
    setCapabilities(prev => [...prev, {
      skillId,
      skillName: newSkillName.trim(),
      description: newSkillDesc.trim(),
      tags: newSkillTags.split(",").map(t => t.trim()).filter(Boolean),
      proficiencyLevel: newSkillLevel,
    }]);
    setNewSkillName("");
    setNewSkillDesc("");
    setNewSkillTags("");
    setNewSkillLevel("intermediate");
  }, [newSkillName, newSkillDesc, newSkillTags, newSkillLevel]);

  const removeCapability = useCallback((skillId: string) => {
    setCapabilities(prev => prev.filter(c => c.skillId !== skillId));
  }, []);

  const handleSaveProfile = useCallback(async () => {
    setSaving(true);
    try {
      // Update Agent Card (description, webhookUrl, hostname, region, roles)
      await updateCardMutation.mutateAsync({
        agentCard: {
          description,
          webhookUrl: webhookUrl || undefined,
          hostname: hostname || undefined,
          region: region || undefined,
          roles: selectedRoles,
        },
      });
      // Update capabilities
      await setCapsMutation.mutateAsync({
        capabilities: capabilities.map(c => ({
          skillId: c.skillId,
          skillName: c.skillName,
          description: c.description || undefined,
          tags: c.tags.length > 0 ? c.tags : undefined,
          proficiencyLevel: c.proficiencyLevel,
        })),
      });
      utils.agents.getById.invalidate({ agentId });
      utils.agents.getCapabilities.invalidate({ agentId });
      utils.agents.readiness.invalidate({ agentId });
      toast.success("Agent profile updated successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }, [agentId, description, webhookUrl, hostname, region, selectedRoles, capabilities, updateCardMutation, setCapsMutation, utils]);

  const handleLinkWallet = useCallback(async () => {
    if (!walletAddress.trim()) return;
    try {
      await linkWalletMutation.mutateAsync({ agentId, walletAddress: walletAddress.trim() });
      utils.agents.getById.invalidate({ agentId });
      toast.success("Wallet linked successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to link wallet");
    }
  }, [agentId, walletAddress, linkWalletMutation, utils]);

  // Loading / Error states
  if (authLoading || agentQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (agentQuery.error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h3 className="font-bold text-lg mb-2">Agent Not Found</h3>
            <p className="text-sm text-muted-foreground mb-4">{agentQuery.error.message}</p>
            <Link href="/agents"><Button>Back to Registry</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const agent = agentQuery.data;
  if (!agent) return null;
  const readiness = readinessQuery.data;
  const reputation = repQuery.data;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href={`/agent/${agentId}`}>
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Profile
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  <h1 className="text-xl font-bold">Manage: {(agent as any).name}</h1>
                  <Badge variant="outline" className={STATUS_COLORS[(agent as any).status] || ""}>
                    {(agent as any).status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Agent ID: {agentId}</p>
              </div>
            </div>
            <Button onClick={handleSaveProfile} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save All Changes
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="identity" className="w-full">
              <TabsList className="grid w-full grid-cols-5 bg-muted/30">
                <TabsTrigger value="identity">Identity</TabsTrigger>
                <TabsTrigger value="roles">Roles</TabsTrigger>
                <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
                <TabsTrigger value="wallet">Wallet</TabsTrigger>
                <TabsTrigger value="heartbeat" className="flex items-center gap-1">
                  <Heart className="w-3 h-3" />
                  Heartbeat
                </TabsTrigger>
              </TabsList>

              {/* Identity Tab */}
              <TabsContent value="identity" className="space-y-4 mt-4">
                <Card className="bg-card/50 border-border/50">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Bot className="w-4 h-4 text-primary" />
                      Agent Identity
                    </CardTitle>
                    <CardDescription>Edit your agent's profile information</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-sm">Agent Name</Label>
                      <Input value={(agent as any).name} disabled className="mt-1 bg-muted/30" />
                      <p className="text-xs text-muted-foreground mt-1">Agent name cannot be changed after enrollment</p>
                    </div>
                    <div>
                      <Label className="text-sm">Description</Label>
                      <Textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Describe what your agent does..."
                        className="mt-1 min-h-[100px]"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm">Webhook URL</Label>
                        <Input
                          value={webhookUrl}
                          onChange={e => setWebhookUrl(e.target.value)}
                          placeholder="https://your-agent.example.com/webhook"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Hostname</Label>
                        <Input
                          value={hostname}
                          onChange={e => setHostname(e.target.value)}
                          placeholder="agent.example.com"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm">Region</Label>
                        <Input
                          value={region}
                          onChange={e => setRegion(e.target.value)}
                          placeholder="us-east-1"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Public Key</Label>
                        <Input value={(agent as any).publicKey?.slice(0, 32) + "..."} disabled className="mt-1 bg-muted/30 font-mono text-xs" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Roles Tab */}
              <TabsContent value="roles" className="space-y-4 mt-4">
                <Card className="bg-card/50 border-border/50">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="w-4 h-4 text-primary" />
                      Federation Roles
                    </CardTitle>
                    <CardDescription>Select the roles your agent fulfills in the federation</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {AGENT_ROLES.map(role => {
                        const isSelected = selectedRoles.includes(role);
                        return (
                          <button
                            key={role}
                            onClick={() => toggleRole(role)}
                            className={`p-3 rounded-lg border text-left transition-all ${
                              isSelected
                                ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                                : "border-border/50 bg-muted/20 hover:border-border"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm capitalize">{role}</span>
                              {isSelected && <CheckCircle className="w-4 h-4 text-primary" />}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {ROLE_DESCRIPTIONS[role] || `${role} role`}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      {selectedRoles.length} role{selectedRoles.length !== 1 ? "s" : ""} selected
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Capabilities Tab */}
              <TabsContent value="capabilities" className="space-y-4 mt-4">
                <Card className="bg-card/50 border-border/50">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-primary" />
                      Agent Capabilities
                    </CardTitle>
                    <CardDescription>Manage the specific skills and capabilities of your agent</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Existing capabilities */}
                    {capabilities.length > 0 && (
                      <div className="space-y-2">
                        {capabilities.map(cap => (
                          <div key={cap.skillId} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/30">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{cap.skillName}</span>
                                <Badge variant="outline" className={`text-[10px] ${PROFICIENCY_COLORS[cap.proficiencyLevel]}`}>
                                  {cap.proficiencyLevel}
                                </Badge>
                              </div>
                              {cap.description && <p className="text-xs text-muted-foreground mt-0.5">{cap.description}</p>}
                              {cap.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {cap.tags.map(t => (
                                    <Badge key={t} variant="outline" className="text-[9px] bg-muted/30">{t}</Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => removeCapability(cap.skillId)}>
                              <X className="w-3 h-3 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Add new capability */}
                    <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-3">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Add Capability
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Skill Name</Label>
                          <Input
                            value={newSkillName}
                            onChange={e => setNewSkillName(e.target.value)}
                            placeholder="e.g., Python Development"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Proficiency</Label>
                          <div className="flex gap-1 mt-1">
                            {PROFICIENCY_LEVELS.map(level => (
                              <button
                                key={level}
                                onClick={() => setNewSkillLevel(level)}
                                className={`px-2 py-1 rounded text-xs border transition-all ${
                                  newSkillLevel === level
                                    ? PROFICIENCY_COLORS[level]
                                    : "border-border/30 text-muted-foreground hover:border-border"
                                }`}
                              >
                                {level}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Description</Label>
                        <Input
                          value={newSkillDesc}
                          onChange={e => setNewSkillDesc(e.target.value)}
                          placeholder="Brief description of this capability"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Tags (comma-separated)</Label>
                        <Input
                          value={newSkillTags}
                          onChange={e => setNewSkillTags(e.target.value)}
                          placeholder="python, api, backend"
                          className="mt-1"
                        />
                      </div>
                      <Button size="sm" onClick={addCapability} disabled={!newSkillName.trim()}>
                        <Plus className="w-3 h-3 mr-1" />
                        Add Capability
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Wallet Tab */}
              <TabsContent value="wallet" className="space-y-4 mt-4">
                <Card className="bg-card/50 border-border/50">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-primary" />
                      Wallet Configuration
                    </CardTitle>
                    <CardDescription>Link or update the TON wallet for this agent</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-sm">Current Wallet</Label>
                      {(agent as any).walletAddress ? (
                        <div className="mt-1 p-3 bg-muted/20 rounded-lg border border-border/30">
                          <code className="text-sm font-mono break-all">{(agent as any).walletAddress}</code>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground mt-1">No wallet linked</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm">New Wallet Address</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          value={walletAddress}
                          onChange={e => setWalletAddress(e.target.value)}
                          placeholder="EQ... or UQ... (TON address)"
                          className="font-mono text-sm"
                        />
                        <Button onClick={handleLinkWallet} disabled={!walletAddress.trim() || linkWalletMutation.isPending}>
                          {linkWalletMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Requires authentication. Only the agent owner or admin can link wallets.
                      </p>
                    </div>
                    <div className="p-3 bg-muted/20 rounded-lg border border-border/30">
                      <h4 className="text-sm font-semibold mb-2">Credit Balance</h4>
                      <p className="text-2xl font-bold text-primary">
                        {parseFloat((agent as any).creditBalance || "0").toFixed(2)} <span className="text-sm text-muted-foreground">credits</span>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Heartbeat Tab */}
              <TabsContent value="heartbeat" className="space-y-4 mt-4">
                <HeartbeatPanel
                  agentId={agentId}
                  stats={heartbeatStatsQuery.data}
                  history={heartbeatHistoryQuery.data}
                  liveStatuses={liveStatusesQuery.data}
                  isLoading={heartbeatStatsQuery.isLoading}
                  onRefresh={() => {
                    heartbeatStatsQuery.refetch();
                    heartbeatHistoryQuery.refetch();
                    liveStatusesQuery.refetch();
                  }}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Readiness Card */}
            {readiness && (
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    Readiness Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center mb-4">
                    <div className="text-3xl font-bold text-primary">
                      {(readiness as any).score ?? 0}<span className="text-sm text-muted-foreground">/7</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {Object.entries((readiness as any).checks || {}).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-2">
                        {val ? (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        <span className="text-xs capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Reputation Card */}
            {reputation && (
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    Reputation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center mb-3">
                    <div className="text-2xl font-bold">
                      {(parseFloat((reputation as any).overallScore || "0.5") * 100).toFixed(0)}%
                    </div>
                    <p className="text-xs text-muted-foreground">Overall Score</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-muted/20 rounded">
                      <p className="text-muted-foreground">Success</p>
                      <p className="font-medium">{(parseFloat((reputation as any).successRate || "0.5") * 100).toFixed(0)}%</p>
                    </div>
                    <div className="p-2 bg-muted/20 rounded">
                      <p className="text-muted-foreground">Quality</p>
                      <p className="font-medium">{(parseFloat((reputation as any).qualityScore || "0.5") * 100).toFixed(0)}%</p>
                    </div>
                    <div className="p-2 bg-muted/20 rounded">
                      <p className="text-muted-foreground">Timeliness</p>
                      <p className="font-medium">{(parseFloat((reputation as any).timelinessScore || "0.5") * 100).toFixed(0)}%</p>
                    </div>
                    <div className="p-2 bg-muted/20 rounded">
                      <p className="text-muted-foreground">Uptime</p>
                      <p className="font-medium">{(parseFloat((reputation as any).uptimeScore || "0.5") * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Live Heartbeat Status */}
            <HeartbeatSidebarCard
              agentId={agentId}
              liveStatuses={liveStatusesQuery.data}
              stats={heartbeatStatsQuery.data}
            />

            {/* Quick Stats */}
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Quick Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tasks Completed</span>
                  <span className="font-medium">{(agent as any).totalTasksCompleted || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tasks Failed</span>
                  <span className="font-medium">{(agent as any).totalTasksFailed || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active Tasks</span>
                  <span className="font-medium">{(agent as any).activeTasks || 0} / {(agent as any).maxConcurrentTasks || 3}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Credits Earned</span>
                  <span className="font-medium">{parseFloat((agent as any).totalCreditsEarned || "0").toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Quick Links */}
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4 space-y-2">
                <Link href={`/agent/${agentId}`}>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <ExternalLink className="w-3 h-3 mr-2" />
                    View Public Profile
                  </Button>
                </Link>
                <Link href="/agents">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Globe className="w-3 h-3 mr-2" />
                    Agent Registry
                  </Button>
                </Link>
                <Link href="/onboard">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Plus className="w-3 h-3 mr-2" />
                    Onboard New Agent
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
