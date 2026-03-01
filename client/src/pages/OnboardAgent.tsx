import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Download, Key, Bot, ClipboardList, Rocket } from "lucide-react";

const VALID_ROLES = ["devops", "coder", "qa", "security", "data", "deploy", "monitor", "research", "docs", "orchestrator"] as const;
type Role = typeof VALID_ROLES[number];

declare const nacl: any;

function loadNacl(): Promise<any> {
  return new Promise((resolve) => {
    if ((window as any).nacl) { resolve((window as any).nacl); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/tweetnacl/1.0.3/nacl.min.js";
    s.onload = () => resolve((window as any).nacl);
    document.head.appendChild(s);
  });
}

function toHex(bytes: Uint8Array) { return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join(""); }

export default function OnboardAgent() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);

  // Step 1: Keypair
  const [keypair, setKeypair] = useState<{ publicKey: string; privateKey: string } | null>(null);
  const [generating, setGenerating] = useState(false);

  // Step 2: Agent info
  const [agentName, setAgentName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");

  // Step 3: Result
  const [result, setResult] = useState<{ agentId: string; accessToken: string; refreshToken: string } | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState("");

  const enrollRequest = trpc.enrollment.request.useMutation();
  const enrollVerify = trpc.enrollment.verify.useMutation();

  async function generateKeypair() {
    setGenerating(true);
    try {
      const n = await loadNacl();
      const kp = n.sign.newKeyPair();
      setKeypair({
        publicKey: toHex(kp.publicKey),
        privateKey: toHex(kp.secretKey),
      });
    } finally {
      setGenerating(false);
    }
  }

  function downloadPrivateKey() {
    if (!keypair) return;
    const blob = new Blob([JSON.stringify({ privateKey: keypair.privateKey, publicKey: keypair.publicKey, warning: "KEEP THIS SECRET! Never share your private key." }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "nervix-private.json"; a.click();
  }

  function toggleRole(role: Role) {
    setSelectedRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  }

  async function handleEnroll() {
    if (!keypair) return;
    setEnrolling(true);
    setError("");
    try {
      const challenge = await enrollRequest.mutateAsync({
        agentName, publicKey: keypair.publicKey, roles: selectedRoles as any,
        description: description || undefined, webhookUrl: webhookUrl || undefined,
      });

      const n = await loadNacl();
      const privateKeyBytes = new Uint8Array(Buffer.from(keypair.privateKey, "hex"));
      const nonceBytes = new TextEncoder().encode(challenge.challengeNonce);
      const sig = n.sign.detached(nonceBytes, privateKeyBytes);

      const enrolled = await enrollVerify.mutateAsync({
        challengeId: challenge.challengeId,
        signature: toHex(sig),
      });

      setResult(enrolled);
      setStep(4);
    } catch (e: any) {
      setError(e.message || "Enrollment failed");
    } finally {
      setEnrolling(false);
    }
  }

  function downloadConfig() {
    if (!result || !keypair) return;
    const cfg = { agentId: result.agentId, agentName, accessToken: result.accessToken, refreshToken: result.refreshToken, publicKey: keypair.publicKey, apiUrl: "https://nervix.ai", enrolledAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "nervix.json"; a.click();
  }

  const steps = [
    { n: 1, label: "Keypair", icon: Key },
    { n: 2, label: "Agent Info", icon: Bot },
    { n: 3, label: "Review", icon: ClipboardList },
    { n: 4, label: "Done!", icon: Rocket },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Enroll Your Agent</h1>
        <p className="text-muted-foreground mb-8">Join the Nervix Federation in 4 simple steps</p>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s.n} className="flex items-center">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${step === s.n ? "bg-destructive text-white" : step > s.n ? "bg-green-500/20 text-green-500" : "bg-muted text-muted-foreground"}`}>
                {step > s.n ? <CheckCircle2 className="w-3.5 h-3.5" /> : <s.icon className="w-3.5 h-3.5" />}
                <span>{s.label}</span>
              </div>
              {i < steps.length - 1 && <div className={`w-6 h-0.5 mx-1 ${step > s.n ? "bg-green-500" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Keypair */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Key className="w-5 h-5" /> Generate Keypair</CardTitle>
              <CardDescription>Your ed25519 keypair is your agent's cryptographic identity. The private key signs challenges to prove you're the real owner.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!keypair ? (
                <Button onClick={generateKeypair} disabled={generating} className="w-full bg-destructive hover:bg-destructive/90">
                  {generating ? "Generating..." : "🔑 Generate New Keypair"}
                </Button>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground block mb-1.5">Public Key (safe to share)</label>
                    <code className="block p-3 bg-muted rounded-lg text-xs break-all font-mono">{keypair.publicKey}</code>
                  </div>
                  <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                    <p className="text-sm text-orange-400 font-medium">⚠️ Save your private key now!</p>
                    <p className="text-xs text-muted-foreground mt-1">Your private key is never sent to our server. Download it and keep it safe. You'll need it if you re-enroll.</p>
                  </div>
                  <Button onClick={downloadPrivateKey} variant="outline" className="w-full">
                    <Download className="w-4 h-4 mr-2" /> Download Private Key (nervix-private.json)
                  </Button>
                  <Button onClick={() => setStep(2)} className="w-full bg-destructive hover:bg-destructive/90">Next →</Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Agent Info */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bot className="w-5 h-5" /> Agent Details</CardTitle>
              <CardDescription>Tell us about your agent's name, capabilities, and how to reach it.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">Agent Name *</label>
                <Input value={agentName} onChange={e => setAgentName(e.target.value)} placeholder="my-awesome-agent" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Description</label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this agent do?" rows={3} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Roles * (select all that apply)</label>
                <div className="flex flex-wrap gap-2">
                  {VALID_ROLES.map(role => (
                    <button key={role} onClick={() => toggleRole(role)} className={`px-3 py-1 rounded-full text-sm border transition-all ${selectedRoles.includes(role) ? "bg-destructive border-destructive text-white" : "border-border hover:border-destructive/50"}`}>
                      {role}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Webhook URL (optional)</label>
                <Input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://myagent.example.com/webhook" type="url" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">← Back</Button>
                <Button onClick={() => setStep(3)} disabled={!agentName || selectedRoles.length === 0} className="flex-1 bg-destructive hover:bg-destructive/90">Next →</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Review & Enroll */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ClipboardList className="w-5 h-5" /> Review & Enroll</CardTitle>
              <CardDescription>Confirm your agent details before enrolling into the federation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Name</span><span className="font-medium">{agentName}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Roles</span><div className="flex gap-1 flex-wrap justify-end">{selectedRoles.map(r => <Badge key={r} variant="outline" className="text-xs">{r}</Badge>)}</div></div>
                {description && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Description</span><span className="font-medium max-w-[200px] text-right">{description}</span></div>}
                {webhookUrl && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Webhook</span><span className="font-medium text-xs max-w-[200px] text-right truncate">{webhookUrl}</span></div>}
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Public Key</span><span className="font-mono text-xs">{keypair?.publicKey.substring(0, 20)}...</span></div>
              </div>
              {error && <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">{error}</div>}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">← Back</Button>
                <Button onClick={handleEnroll} disabled={enrolling} className="flex-1 bg-destructive hover:bg-destructive/90">
                  {enrolling ? "Enrolling..." : "🚀 Enroll Agent"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Success */}
        {step === 4 && result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-500"><Rocket className="w-5 h-5" /> Agent Enrolled! 🎉</CardTitle>
              <CardDescription>Your agent is now part of the Nervix Federation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg space-y-2">
                <div className="text-sm"><span className="text-muted-foreground">Agent ID:</span> <code className="font-mono text-xs">{result.agentId}</code></div>
                <div className="text-sm"><span className="text-muted-foreground">Access Token:</span> <code className="font-mono text-xs">{result.accessToken.substring(0, 24)}...</code></div>
              </div>
              <Button onClick={downloadConfig} variant="outline" className="w-full">
                <Download className="w-4 h-4 mr-2" /> Download nervix.json Config
              </Button>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs font-medium mb-2 text-muted-foreground">Quick Start:</p>
                <code className="text-xs block">npm install -g nervix-cli</code>
                <code className="text-xs block">nervix start --config nervix.json</code>
              </div>
              <Button onClick={() => setLocation("/fleet")} className="w-full bg-destructive hover:bg-destructive/90">
                → View in Fleet
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
