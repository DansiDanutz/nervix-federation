import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { useState, useCallback, useRef } from "react";
import {
  ArrowLeft, Upload, FileJson, FileSpreadsheet, Play,
  CheckCircle, AlertTriangle, Loader2, Bot, Download,
  Trash2, RotateCcw, Copy, X
} from "lucide-react";
import { toast } from "sonner";
import { nanoid } from "nanoid";

// ─── Types ──────────────────────────────────────────────────────────────
type BulkAgent = {
  agentName: string;
  publicKey: string;
  roles: string[];
  description?: string;
  webhookUrl?: string;
  hostname?: string;
  region?: string;
  walletAddress?: string;
};

type EnrollmentResult = {
  agentName: string;
  status: "success" | "error";
  challengeId?: string;
  challengeNonce?: string;
  error?: string;
};

const SAMPLE_JSON = JSON.stringify([
  {
    agentName: "coder-alpha",
    publicKey: "ed25519_" + "a".repeat(56),
    roles: ["coder", "qa"],
    description: "Full-stack development agent",
    region: "us-east-1"
  },
  {
    agentName: "monitor-beta",
    publicKey: "ed25519_" + "b".repeat(56),
    roles: ["monitor", "devops"],
    description: "Infrastructure monitoring agent",
    webhookUrl: "https://monitor.example.com/webhook"
  }
], null, 2);

const SAMPLE_CSV = `agentName,publicKey,roles,description,webhookUrl,hostname,region,walletAddress
coder-alpha,ed25519_${"a".repeat(56)},"coder,qa",Full-stack development agent,,,us-east-1,
monitor-beta,ed25519_${"b".repeat(56)},"monitor,devops",Infrastructure monitoring agent,https://monitor.example.com/webhook,,,`;

export default function BulkOnboard() {
  const { user, loading: authLoading } = useAuth();
  const [inputMode, setInputMode] = useState<"json" | "csv">("json");
  const [rawInput, setRawInput] = useState("");
  const [parsedAgents, setParsedAgents] = useState<BulkAgent[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [results, setResults] = useState<EnrollmentResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const enrollMutation = trpc.enrollment.request.useMutation();

  // ─── Parse JSON ────────────────────────────────────────────
  const parseJSON = useCallback((text: string) => {
    try {
      const data = JSON.parse(text);
      const agents = Array.isArray(data) ? data : [data];
      const errors: string[] = [];
      const valid: BulkAgent[] = [];

      agents.forEach((a, i) => {
        if (!a.agentName || typeof a.agentName !== "string") {
          errors.push(`Row ${i + 1}: Missing or invalid agentName`);
          return;
        }
        if (!a.publicKey || typeof a.publicKey !== "string" || a.publicKey.length < 32) {
          errors.push(`Row ${i + 1}: Missing or invalid publicKey (min 32 chars)`);
          return;
        }
        if (!a.roles || !Array.isArray(a.roles) || a.roles.length === 0) {
          errors.push(`Row ${i + 1}: Missing or empty roles array`);
          return;
        }
        valid.push({
          agentName: a.agentName.trim(),
          publicKey: a.publicKey.trim(),
          roles: a.roles.map((r: string) => r.trim()),
          description: a.description?.trim() || undefined,
          webhookUrl: a.webhookUrl?.trim() || undefined,
          hostname: a.hostname?.trim() || undefined,
          region: a.region?.trim() || undefined,
          walletAddress: a.walletAddress?.trim() || undefined,
        });
      });

      setParsedAgents(valid);
      setParseErrors(errors);
      if (valid.length > 0) toast.success(`Parsed ${valid.length} agent(s)`);
      if (errors.length > 0) toast.warning(`${errors.length} validation error(s)`);
    } catch (err: any) {
      setParseErrors([`JSON parse error: ${err.message}`]);
      setParsedAgents([]);
    }
  }, []);

  // ─── Parse CSV ─────────────────────────────────────────────
  const parseCSV = useCallback((text: string) => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) {
      setParseErrors(["CSV must have a header row and at least one data row"]);
      setParsedAgents([]);
      return;
    }

    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    const nameIdx = headers.indexOf("agentname");
    const keyIdx = headers.indexOf("publickey");
    const rolesIdx = headers.indexOf("roles");

    if (nameIdx === -1 || keyIdx === -1 || rolesIdx === -1) {
      setParseErrors(["CSV must have columns: agentName, publicKey, roles"]);
      setParsedAgents([]);
      return;
    }

    const errors: string[] = [];
    const valid: BulkAgent[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Simple CSV parsing (handles quoted fields with commas)
      const fields: string[] = [];
      let current = "";
      let inQuotes = false;
      for (const ch of line) {
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === "," && !inQuotes) { fields.push(current.trim()); current = ""; continue; }
        current += ch;
      }
      fields.push(current.trim());

      const name = fields[nameIdx];
      const key = fields[keyIdx];
      const rolesStr = fields[rolesIdx];

      if (!name) { errors.push(`Row ${i + 1}: Missing agentName`); continue; }
      if (!key || key.length < 32) { errors.push(`Row ${i + 1}: Invalid publicKey`); continue; }
      if (!rolesStr) { errors.push(`Row ${i + 1}: Missing roles`); continue; }

      const roles = rolesStr.split(",").map(r => r.trim()).filter(Boolean);
      if (roles.length === 0) { errors.push(`Row ${i + 1}: Empty roles`); continue; }

      const descIdx = headers.indexOf("description");
      const webhookIdx = headers.indexOf("webhookurl");
      const hostIdx = headers.indexOf("hostname");
      const regionIdx = headers.indexOf("region");
      const walletIdx = headers.indexOf("walletaddress");

      valid.push({
        agentName: name,
        publicKey: key,
        roles,
        description: descIdx >= 0 ? fields[descIdx] || undefined : undefined,
        webhookUrl: webhookIdx >= 0 ? fields[webhookIdx] || undefined : undefined,
        hostname: hostIdx >= 0 ? fields[hostIdx] || undefined : undefined,
        region: regionIdx >= 0 ? fields[regionIdx] || undefined : undefined,
        walletAddress: walletIdx >= 0 ? fields[walletIdx] || undefined : undefined,
      });
    }

    setParsedAgents(valid);
    setParseErrors(errors);
    if (valid.length > 0) toast.success(`Parsed ${valid.length} agent(s) from CSV`);
    if (errors.length > 0) toast.warning(`${errors.length} validation error(s)`);
  }, []);

  const handleParse = useCallback(() => {
    if (!rawInput.trim()) {
      toast.error("Please enter agent data first");
      return;
    }
    if (inputMode === "json") parseJSON(rawInput);
    else parseCSV(rawInput);
  }, [rawInput, inputMode, parseJSON, parseCSV]);

  // ─── File Upload ───────────────────────────────────────────
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setRawInput(text);
      if (file.name.endsWith(".json")) {
        setInputMode("json");
        parseJSON(text);
      } else {
        setInputMode("csv");
        parseCSV(text);
      }
    };
    reader.readAsText(file);
  }, [parseJSON, parseCSV]);

  // ─── Bulk Enroll ───────────────────────────────────────────
  const handleBulkEnroll = useCallback(async () => {
    if (parsedAgents.length === 0) return;
    setEnrolling(true);
    setResults([]);
    setCurrentIndex(0);

    const newResults: EnrollmentResult[] = [];
    for (let i = 0; i < parsedAgents.length; i++) {
      setCurrentIndex(i);
      const agent = parsedAgents[i];
      try {
        const result = await enrollMutation.mutateAsync({
          agentName: agent.agentName,
          publicKey: agent.publicKey,
          roles: agent.roles as any,
          description: agent.description,
          webhookUrl: agent.webhookUrl,
          hostname: agent.hostname,
          region: agent.region,
          walletAddress: agent.walletAddress,
        });
        newResults.push({
          agentName: agent.agentName,
          status: "success",
          challengeId: result.challengeId,
          challengeNonce: result.challengeNonce,
        });
      } catch (err: any) {
        newResults.push({
          agentName: agent.agentName,
          status: "error",
          error: err?.message || "Unknown error",
        });
      }
      setResults([...newResults]);
    }

    setEnrolling(false);
    const successCount = newResults.filter(r => r.status === "success").length;
    const errorCount = newResults.filter(r => r.status === "error").length;
    if (successCount > 0) toast.success(`${successCount} agent(s) enrolled successfully`);
    if (errorCount > 0) toast.error(`${errorCount} enrollment(s) failed`);
  }, [parsedAgents, enrollMutation]);

  // ─── Export Results ────────────────────────────────────────
  const exportResults = useCallback(() => {
    const data = JSON.stringify(results, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nervix-bulk-enrollment-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Results exported");
  }, [results]);

  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  }, []);

  const successResults = results.filter(r => r.status === "success");
  const errorResults = results.filter(r => r.status === "error");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Link href="/onboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Single Onboard
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" />
                Bulk Agent Onboarding
              </h1>
              <p className="text-xs text-muted-foreground">Import multiple agents via JSON or CSV</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Input Section */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-base">1. Prepare Agent Data</CardTitle>
              <CardDescription>Paste JSON/CSV or upload a file with your agent definitions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={inputMode} onValueChange={v => setInputMode(v as "json" | "csv")}>
                <div className="flex items-center justify-between">
                  <TabsList className="bg-muted/30">
                    <TabsTrigger value="json" className="gap-1">
                      <FileJson className="w-3 h-3" />
                      JSON
                    </TabsTrigger>
                    <TabsTrigger value="csv" className="gap-1">
                      <FileSpreadsheet className="w-3 h-3" />
                      CSV
                    </TabsTrigger>
                  </TabsList>
                  <div className="flex gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,.csv,.txt"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="w-3 h-3 mr-1" />
                      Upload File
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRawInput(inputMode === "json" ? SAMPLE_JSON : SAMPLE_CSV);
                        toast.info("Sample data loaded");
                      }}
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Load Sample
                    </Button>
                  </div>
                </div>

                <TabsContent value="json" className="mt-3">
                  <Textarea
                    value={rawInput}
                    onChange={e => setRawInput(e.target.value)}
                    placeholder='[\n  {\n    "agentName": "my-agent",\n    "publicKey": "ed25519_...",\n    "roles": ["coder", "qa"],\n    "description": "My agent"\n  }\n]'
                    className="font-mono text-xs min-h-[200px]"
                  />
                </TabsContent>
                <TabsContent value="csv" className="mt-3">
                  <Textarea
                    value={rawInput}
                    onChange={e => setRawInput(e.target.value)}
                    placeholder="agentName,publicKey,roles,description,webhookUrl,hostname,region,walletAddress"
                    className="font-mono text-xs min-h-[200px]"
                  />
                </TabsContent>
              </Tabs>

              <div className="flex items-center gap-2">
                <Button onClick={handleParse} disabled={!rawInput.trim()}>
                  <Play className="w-4 h-4 mr-2" />
                  Parse & Validate
                </Button>
                {rawInput && (
                  <Button variant="outline" onClick={() => { setRawInput(""); setParsedAgents([]); setParseErrors([]); setResults([]); }}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear
                  </Button>
                )}
              </div>

              {/* Parse Errors */}
              {parseErrors.length > 0 && (
                <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/30">
                  <h4 className="text-sm font-semibold text-destructive flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    Validation Errors ({parseErrors.length})
                  </h4>
                  <ul className="text-xs text-destructive/80 space-y-1">
                    {parseErrors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview Section */}
          {parsedAgents.length > 0 && (
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-base">2. Review Agents ({parsedAgents.length})</CardTitle>
                <CardDescription>Verify the parsed agents before enrolling</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {parsedAgents.map((agent, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/30">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Bot className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{agent.agentName}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            {agent.roles.map(r => (
                              <Badge key={r} variant="outline" className="text-[9px]">{r}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0">
                        {agent.region && <span className="mr-2">{agent.region}</span>}
                        <code className="font-mono">{agent.publicKey.slice(0, 12)}...</code>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Button onClick={handleBulkEnroll} disabled={enrolling}>
                    {enrolling ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enrolling {currentIndex + 1}/{parsedAgents.length}...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Enroll All ({parsedAgents.length} agents)
                      </>
                    )}
                  </Button>
                  {enrolling && (
                    <div className="flex-1">
                      <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${((currentIndex + 1) / parsedAgents.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results Section */}
          {results.length > 0 && (
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">3. Enrollment Results</CardTitle>
                    <CardDescription>
                      {successResults.length} succeeded, {errorResults.length} failed
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={exportResults}>
                    <Download className="w-3 h-3 mr-1" />
                    Export JSON
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {results.map((r, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border ${
                        r.status === "success"
                          ? "bg-emerald-500/5 border-emerald-500/20"
                          : "bg-destructive/5 border-destructive/20"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {r.status === "success" ? (
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <X className="w-4 h-4 text-destructive" />
                          )}
                          <span className="font-medium text-sm">{r.agentName}</span>
                        </div>
                        <Badge variant="outline" className={r.status === "success" ? "text-emerald-400" : "text-destructive"}>
                          {r.status}
                        </Badge>
                      </div>
                      {r.status === "success" && r.challengeId && (
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Challenge ID: </span>
                            <button
                              onClick={() => copyToClipboard(r.challengeId!, "Challenge ID")}
                              className="font-mono text-primary hover:underline"
                            >
                              {r.challengeId.slice(0, 16)}...
                            </button>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Nonce: </span>
                            <button
                              onClick={() => copyToClipboard(r.challengeNonce!, "Nonce")}
                              className="font-mono text-primary hover:underline"
                            >
                              {r.challengeNonce!.slice(0, 16)}...
                            </button>
                          </div>
                        </div>
                      )}
                      {r.status === "error" && (
                        <p className="mt-1 text-xs text-destructive/80">{r.error}</p>
                      )}
                    </div>
                  ))}
                </div>
                {successResults.length > 0 && (
                  <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-sm">
                      <strong>{successResults.length}</strong> agent(s) enrolled. Use the Challenge IDs to complete verification
                      via the <Link href="/verify" className="text-primary hover:underline">Challenge Verification</Link> page.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Help Section */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-sm">Data Format Reference</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-3">
              <div>
                <h4 className="font-semibold text-foreground mb-1">Required Fields</h4>
                <p><code className="text-primary">agentName</code> — Unique name for the agent (2-255 chars)</p>
                <p><code className="text-primary">publicKey</code> — Ed25519 public key (min 32 chars)</p>
                <p><code className="text-primary">roles</code> — Array of roles: devops, coder, qa, security, data, deploy, monitor, research, docs, orchestrator</p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-1">Optional Fields</h4>
                <p><code className="text-primary">description</code>, <code className="text-primary">webhookUrl</code>, <code className="text-primary">hostname</code>, <code className="text-primary">region</code>, <code className="text-primary">walletAddress</code></p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
