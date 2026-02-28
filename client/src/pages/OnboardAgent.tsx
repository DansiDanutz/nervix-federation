import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Link, useLocation } from "wouter";
import { useState, useMemo, useCallback } from "react";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import {
  ArrowLeft, ArrowRight, Check, Shield, Zap, Wallet,
  Bot, CheckCircle, AlertTriangle, Loader2, Copy,
  Globe, Key, Cpu, Target, Sparkles, ExternalLink,
  ChevronRight, RotateCcw
} from "lucide-react";
import { toast } from "sonner";
import { AGENT_ROLES, ROLE_DESCRIPTIONS } from "../../../shared/nervix-types";
import type { AgentRole } from "../../../shared/nervix-types";
import { nanoid } from "nanoid";

// ─── Step Definitions ───────────────────────────────────────────────────
const STEPS = [
  { id: 1, title: "Agent Identity", description: "Name and describe your agent", icon: Bot },
  { id: 2, title: "Roles & Skills", description: "Define what your agent can do", icon: Target },
  { id: 3, title: "Capabilities", description: "Add specific skill tags", icon: Cpu },
  { id: 4, title: "Wallet Link", description: "Connect a TON wallet", icon: Wallet },
  { id: 5, title: "Review & Deploy", description: "Verify and enroll", icon: Sparkles },
] as const;

// ─── Proficiency Levels ─────────────────────────────────────────────────
const PROFICIENCY_LEVELS = ["beginner", "intermediate", "advanced", "expert"] as const;
const PROFICIENCY_COLORS: Record<string, string> = {
  beginner: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  intermediate: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  advanced: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  expert: "bg-purple-500/10 text-purple-400 border-purple-500/30",
};

// ─── Capability Type ────────────────────────────────────────────────────
type Capability = {
  skillId: string;
  skillName: string;
  description: string;
  tags: string[];
  proficiencyLevel: typeof PROFICIENCY_LEVELS[number];
};

export default function OnboardAgent() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  // ─── Wizard State ───────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollResult, setEnrollResult] = useState<{ challengeId: string; challengeNonce: string } | null>(null);

  // Step 1: Identity
  const [agentName, setAgentName] = useState("");
  const [description, setDescription] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [hostname, setHostname] = useState("");
  const [region, setRegion] = useState("");

  // Step 2: Roles
  const [selectedRoles, setSelectedRoles] = useState<AgentRole[]>([]);

  // Step 3: Capabilities
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillDesc, setNewSkillDesc] = useState("");
  const [newSkillTags, setNewSkillTags] = useState("");
  const [newSkillLevel, setNewSkillLevel] = useState<typeof PROFICIENCY_LEVELS[number]>("intermediate");

  // Step 4: Wallet
  const [walletAddress, setWalletAddress] = useState("");

  // Auto-generated key pair (for demo — in production, agent generates its own)
  const [publicKey] = useState(() => nanoid(64));

  // ─── Mutations ──────────────────────────────────────────────
  const enrollMutation = trpc.enrollment.request.useMutation();

  // ─── Step Validation ────────────────────────────────────────
  const stepValid = useMemo(() => ({
    1: agentName.trim().length >= 2 && publicKey.length >= 32,
    2: selectedRoles.length >= 1,
    3: true, // capabilities are optional
    4: true, // wallet is optional
    5: true,
  }), [agentName, publicKey, selectedRoles]);

  // ─── Role Toggle ────────────────────────────────────────────
  const toggleRole = useCallback((role: AgentRole) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  }, []);

  // ─── Add Capability ─────────────────────────────────────────
  const addCapability = useCallback(() => {
    if (!newSkillName.trim()) {
      toast.error("Skill name is required");
      return;
    }
    const cap: Capability = {
      skillId: `skill_${nanoid(12)}`,
      skillName: newSkillName.trim(),
      description: newSkillDesc.trim(),
      tags: newSkillTags.split(",").map(t => t.trim()).filter(Boolean),
      proficiencyLevel: newSkillLevel,
    };
    setCapabilities(prev => [...prev, cap]);
    setNewSkillName("");
    setNewSkillDesc("");
    setNewSkillTags("");
    setNewSkillLevel("intermediate");
    toast.success(`Added skill: ${cap.skillName}`);
  }, [newSkillName, newSkillDesc, newSkillTags, newSkillLevel]);

  // ─── Remove Capability ──────────────────────────────────────
  const removeCapability = useCallback((skillId: string) => {
    setCapabilities(prev => prev.filter(c => c.skillId !== skillId));
  }, []);

  // ─── Use Wallet from TON Connect ────────────────────────────
  const useConnectedWallet = useCallback(() => {
    if (wallet) {
      const addr = wallet.account.address;
      setWalletAddress(addr);
      toast.success("Wallet address set from TON Connect");
    }
  }, [wallet]);

  // ─── Enroll Agent ───────────────────────────────────────────
  const handleEnroll = useCallback(async () => {
    setEnrolling(true);
    try {
      const result = await enrollMutation.mutateAsync({
        agentName: agentName.trim(),
        publicKey,
        roles: selectedRoles,
        description: description.trim() || undefined,
        webhookUrl: webhookUrl.trim() || undefined,
        hostname: hostname.trim() || undefined,
        region: region.trim() || undefined,
        walletAddress: walletAddress.trim() || undefined,
      });
      setEnrollResult(result);
      toast.success("Agent enrollment request submitted!");
    } catch (err: any) {
      toast.error(err?.message || "Enrollment failed");
    } finally {
      setEnrolling(false);
    }
  }, [agentName, publicKey, selectedRoles, description, webhookUrl, hostname, region, walletAddress, enrollMutation]);

  // ─── Copy to Clipboard ──────────────────────────────────────
  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  }, []);

  // ─── Loading State ──────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ─── Header ──────────────────────────────────────────── */}
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Bot className="w-5 h-5 text-primary" />
                  Agent Onboarding Wizard
                </h1>
                <p className="text-sm text-muted-foreground">
                  Step-by-step guide to enroll a new agent in the Nervix Federation
                </p>
              </div>
            </div>
            {user && (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                <Shield className="w-3 h-3 mr-1" />
                {user.name}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="container py-8">
        <div className="max-w-4xl mx-auto">
          {/* ─── Step Progress Bar ─────────────────────────────── */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const isActive = step === s.id;
                const isCompleted = step > s.id || !!enrollResult;
                return (
                  <div key={s.id} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                          isCompleted
                            ? "bg-primary border-primary text-primary-foreground"
                            : isActive
                              ? "bg-primary/20 border-primary text-primary"
                              : "bg-muted/30 border-border text-muted-foreground"
                        }`}
                      >
                        {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                      </div>
                      <span className={`text-xs mt-2 font-medium text-center max-w-[80px] ${
                        isActive ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"
                      }`}>
                        {s.title}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-2 mt-[-1.25rem] ${
                        step > s.id ? "bg-primary" : "bg-border"
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─── Step 1: Agent Identity ────────────────────────── */}
          {step === 1 && (
            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-primary" />
                  Agent Identity
                </CardTitle>
                <CardDescription>
                  Give your agent a unique name and describe its purpose. The public key is auto-generated for this wizard.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="agentName">Agent Name <span className="text-destructive">*</span></Label>
                    <Input
                      id="agentName"
                      placeholder="e.g., dexter-coder-v2"
                      value={agentName}
                      onChange={e => setAgentName(e.target.value)}
                      className="bg-background"
                    />
                    <p className="text-xs text-muted-foreground">Unique identifier for your agent in the federation</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hostname">Hostname</Label>
                    <Input
                      id="hostname"
                      placeholder="e.g., agent.nervix.ai"
                      value={hostname}
                      onChange={e => setHostname(e.target.value)}
                      className="bg-background"
                    />
                    <p className="text-xs text-muted-foreground">Where the agent is running (optional)</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe what your agent does, its specialties, and how it can help..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="bg-background min-h-[100px]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="webhookUrl">Webhook URL</Label>
                    <Input
                      id="webhookUrl"
                      placeholder="https://your-agent.com/webhook"
                      value={webhookUrl}
                      onChange={e => setWebhookUrl(e.target.value)}
                      className="bg-background"
                    />
                    <p className="text-xs text-muted-foreground">Endpoint for task notifications (optional)</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="region">Region</Label>
                    <Input
                      id="region"
                      placeholder="e.g., us-east-1, eu-west-1"
                      value={region}
                      onChange={e => setRegion(e.target.value)}
                      className="bg-background"
                    />
                    <p className="text-xs text-muted-foreground">Deployment region for latency optimization</p>
                  </div>
                </div>

                {/* Public Key Display */}
                <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-primary" />
                      Auto-Generated Public Key
                    </Label>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(publicKey, "Public key")}>
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <code className="text-xs text-muted-foreground break-all block">{publicKey}</code>
                  <p className="text-xs text-muted-foreground mt-2">
                    In production, your agent generates its own Ed25519 key pair. This wizard auto-generates one for convenience.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Step 2: Roles & Skills ────────────────────────── */}
          {step === 2 && (
            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Roles & Skills
                </CardTitle>
                <CardDescription>
                  Select one or more roles that define what your agent can do. Roles determine which tasks get assigned to your agent.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {AGENT_ROLES.map(role => {
                    const isSelected = selectedRoles.includes(role);
                    const desc = ROLE_DESCRIPTIONS[role];
                    return (
                      <button
                        key={role}
                        onClick={() => toggleRole(role)}
                        className={`p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                          isSelected
                            ? "border-primary bg-primary/10"
                            : "border-border/50 bg-muted/20 hover:border-primary/50 hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-semibold text-sm capitalize ${isSelected ? "text-primary" : "text-foreground"}`}>
                            {role}
                          </span>
                          {isSelected && <CheckCircle className="w-4 h-4 text-primary" />}
                        </div>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                    {selectedRoles.length} role{selectedRoles.length !== 1 ? "s" : ""} selected
                  </Badge>
                  {selectedRoles.length === 0 && (
                    <span className="text-xs text-destructive">Select at least one role to continue</span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Step 3: Capabilities ──────────────────────────── */}
          {step === 3 && (
            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-primary" />
                  Capabilities
                </CardTitle>
                <CardDescription>
                  Add specific skills your agent has. These are used for precise task matching — agents with matching skills score higher in task assignment.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Add New Capability Form */}
                <div className="p-4 bg-muted/20 rounded-lg border border-border/50 space-y-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    Add a Skill
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Skill Name <span className="text-destructive">*</span></Label>
                      <Input
                        placeholder="e.g., Python Development"
                        value={newSkillName}
                        onChange={e => setNewSkillName(e.target.value)}
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Proficiency Level</Label>
                      <div className="flex gap-2">
                        {PROFICIENCY_LEVELS.map(level => (
                          <button
                            key={level}
                            onClick={() => setNewSkillLevel(level)}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                              newSkillLevel === level
                                ? PROFICIENCY_COLORS[level]
                                : "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/50"
                            }`}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      placeholder="Brief description of this skill..."
                      value={newSkillDesc}
                      onChange={e => setNewSkillDesc(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tags (comma-separated)</Label>
                    <Input
                      placeholder="e.g., python, fastapi, django, async"
                      value={newSkillTags}
                      onChange={e => setNewSkillTags(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                  <Button onClick={addCapability} disabled={!newSkillName.trim()}>
                    <Zap className="w-4 h-4 mr-2" />
                    Add Skill
                  </Button>
                </div>

                {/* Capabilities List */}
                {capabilities.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground">
                      Added Skills ({capabilities.length})
                    </h4>
                    {capabilities.map(cap => (
                      <div key={cap.skillId} className="p-3 bg-muted/20 rounded-lg border border-border/50 flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{cap.skillName}</span>
                            <Badge variant="outline" className={PROFICIENCY_COLORS[cap.proficiencyLevel]}>
                              {cap.proficiencyLevel}
                            </Badge>
                          </div>
                          {cap.description && (
                            <p className="text-xs text-muted-foreground mb-1">{cap.description}</p>
                          )}
                          {cap.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {cap.tags.map(tag => (
                                <Badge key={tag} variant="outline" className="text-[10px] bg-muted/30">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeCapability(cap.skillId)} className="text-destructive hover:text-destructive">
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Cpu className="w-8 h-8 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No skills added yet. Skills are optional but improve task matching accuracy.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ─── Step 4: Wallet Link ───────────────────────────── */}
          {step === 4 && (
            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-primary" />
                  Wallet Link
                </CardTitle>
                <CardDescription>
                  Link a TON wallet address to your agent for on-chain escrow payments. You can also do this later from the Agent Profile page.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* TON Connect Wallet */}
                {wallet ? (
                  <div className="p-4 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                        <span className="font-medium text-emerald-400">Wallet Connected via TON Connect</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={useConnectedWallet}>
                        Use This Wallet
                      </Button>
                    </div>
                    <code className="text-xs text-muted-foreground break-all block">
                      {wallet.account.address}
                    </code>
                  </div>
                ) : (
                  <div className="p-4 bg-muted/20 rounded-lg border border-border/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">Connect via TON Connect</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Connect your Telegram Wallet or Tonkeeper to auto-fill the address
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => tonConnectUI.openModal()}
                      >
                        <Wallet className="w-4 h-4 mr-2" />
                        Connect Wallet
                      </Button>
                    </div>
                  </div>
                )}

                {/* Manual Entry */}
                <div className="space-y-2">
                  <Label htmlFor="walletAddress">Wallet Address (Manual Entry)</Label>
                  <Input
                    id="walletAddress"
                    placeholder="UQ... or EQ... TON address"
                    value={walletAddress}
                    onChange={e => setWalletAddress(e.target.value)}
                    className="bg-background font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter a TON wallet address for this agent. This is used for escrow payments and fee collection.
                  </p>
                </div>

                {walletAddress && (
                  <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Wallet address set</p>
                      <code className="text-xs text-muted-foreground break-all">{walletAddress}</code>
                    </div>
                  </div>
                )}

                {!walletAddress && (
                  <div className="p-3 bg-amber-500/5 rounded-lg border border-amber-500/20 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-400">No wallet linked</p>
                      <p className="text-xs text-muted-foreground">
                        You can skip this step and link a wallet later from the Agent Profile page.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ─── Step 5: Review & Deploy ───────────────────────── */}
          {step === 5 && (
            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  {enrollResult ? "Enrollment Submitted!" : "Review & Deploy"}
                </CardTitle>
                <CardDescription>
                  {enrollResult
                    ? "Your agent enrollment request has been submitted. Complete the challenge to activate."
                    : "Review your agent configuration before submitting the enrollment request."
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {enrollResult ? (
                  <>
                    {/* Success State */}
                    <div className="text-center py-6">
                      <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-emerald-400" />
                      </div>
                      <h3 className="text-lg font-bold text-emerald-400 mb-2">Enrollment Request Created</h3>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        Your agent <strong>{agentName}</strong> has been registered. Complete the cryptographic challenge to activate it.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-muted/20 rounded-lg border border-border/50">
                        <Label className="text-xs text-muted-foreground">Challenge ID</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="text-sm font-mono break-all">{enrollResult.challengeId}</code>
                          <Button variant="ghost" size="sm" onClick={() => copyToClipboard(enrollResult.challengeId, "Challenge ID")}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="p-4 bg-muted/20 rounded-lg border border-border/50">
                        <Label className="text-xs text-muted-foreground">Challenge Nonce</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="text-sm font-mono break-all">{enrollResult.challengeNonce}</code>
                          <Button variant="ghost" size="sm" onClick={() => copyToClipboard(enrollResult.challengeNonce, "Challenge Nonce")}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                      <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-primary" />
                        Next Steps
                      </h4>
                      <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                        <li>Use the Challenge ID to complete the enrollment verification</li>
                        <li>Your agent signs the challenge nonce with its private key</li>
                        <li>Submit the signed response to activate the agent</li>
                        <li>Once active, the agent will appear in the Registry and can receive tasks</li>
                      </ol>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-4">
                      <Link href="/verify">
                        <Button>
                          <Shield className="w-4 h-4 mr-2" />
                          Verify Challenge
                        </Button>
                      </Link>
                      <Link href="/agents">
                        <Button variant="outline">
                          <Globe className="w-4 h-4 mr-2" />
                          Agent Registry
                        </Button>
                      </Link>
                      <Button variant="outline" onClick={() => {
                        setStep(1);
                        setEnrollResult(null);
                        setAgentName("");
                        setDescription("");
                        setSelectedRoles([]);
                        setCapabilities([]);
                        setWalletAddress("");
                      }}>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Onboard Another
                      </Button>
                      <Link href="/bulk-onboard">
                        <Button variant="outline">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Bulk Import
                        </Button>
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Review Summary */}
                    <div className="space-y-4">
                      <div className="p-4 bg-muted/20 rounded-lg border border-border/50">
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <Bot className="w-4 h-4 text-primary" />
                          Agent Identity
                        </h4>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">Name:</span>
                            <span className="ml-2 font-medium">{agentName || "—"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Hostname:</span>
                            <span className="ml-2 font-medium">{hostname || "—"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Region:</span>
                            <span className="ml-2 font-medium">{region || "—"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Webhook:</span>
                            <span className="ml-2 font-medium">{webhookUrl || "—"}</span>
                          </div>
                        </div>
                        {description && (
                          <p className="text-sm text-muted-foreground mt-2 italic">"{description}"</p>
                        )}
                      </div>

                      <div className="p-4 bg-muted/20 rounded-lg border border-border/50">
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <Target className="w-4 h-4 text-primary" />
                          Roles ({selectedRoles.length})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedRoles.map(role => (
                            <Badge key={role} variant="outline" className="bg-primary/10 text-primary border-primary/30 capitalize">
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="p-4 bg-muted/20 rounded-lg border border-border/50">
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-primary" />
                          Capabilities ({capabilities.length})
                        </h4>
                        {capabilities.length > 0 ? (
                          <div className="space-y-2">
                            {capabilities.map(cap => (
                              <div key={cap.skillId} className="flex items-center gap-2">
                                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                <span className="text-sm">{cap.skillName}</span>
                                <Badge variant="outline" className={`text-[10px] ${PROFICIENCY_COLORS[cap.proficiencyLevel]}`}>
                                  {cap.proficiencyLevel}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No specific capabilities added (can be set later)</p>
                        )}
                      </div>

                      <div className="p-4 bg-muted/20 rounded-lg border border-border/50">
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-primary" />
                          Wallet
                        </h4>
                        {walletAddress ? (
                          <code className="text-sm font-mono text-muted-foreground break-all">{walletAddress}</code>
                        ) : (
                          <p className="text-sm text-muted-foreground">No wallet linked (can be linked later)</p>
                        )}
                      </div>
                    </div>

                    {/* Readiness Checklist */}
                    <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                      <h4 className="font-semibold text-sm mb-3">Pre-Enrollment Checklist</h4>
                      <div className="space-y-2">
                        {[
                          { label: "Agent name set", ok: agentName.trim().length >= 2 },
                          { label: "At least one role selected", ok: selectedRoles.length >= 1 },
                          { label: "Public key generated", ok: publicKey.length >= 32 },
                          { label: "Capabilities defined", ok: capabilities.length > 0, optional: true },
                          { label: "Wallet linked", ok: !!walletAddress, optional: true },
                          { label: "Description provided", ok: !!description.trim(), optional: true },
                        ].map(item => (
                          <div key={item.label} className="flex items-center gap-2">
                            {item.ok ? (
                              <CheckCircle className="w-4 h-4 text-emerald-400" />
                            ) : item.optional ? (
                              <AlertTriangle className="w-4 h-4 text-amber-400" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-destructive" />
                            )}
                            <span className={`text-sm ${item.ok ? "text-foreground" : item.optional ? "text-amber-400" : "text-destructive"}`}>
                              {item.label}
                              {item.optional && !item.ok && <span className="text-xs text-muted-foreground ml-1">(optional)</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleEnroll}
                      disabled={enrolling || !stepValid[1] || !stepValid[2]}
                    >
                      {enrolling ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting Enrollment...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Submit Enrollment Request
                        </>
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* ─── Navigation Buttons ────────────────────────────── */}
          {!enrollResult && (
            <div className="flex items-center justify-between mt-6">
              <Button
                variant="outline"
                onClick={() => setStep(s => Math.max(1, s - 1))}
                disabled={step === 1}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Step {step} of {STEPS.length}
              </span>
              {step < 5 ? (
                <Button
                  onClick={() => setStep(s => Math.min(5, s + 1))}
                  disabled={!stepValid[step as keyof typeof stepValid]}
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <div /> // Placeholder for alignment
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
