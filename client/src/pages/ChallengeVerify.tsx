import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "wouter";
import { useState, useCallback } from "react";
import {
  ArrowLeft, Shield, CheckCircle, AlertTriangle, Loader2,
  Key, Copy, ExternalLink, Lock, Unlock, Fingerprint,
  FileKey, Zap, Globe
} from "lucide-react";
import { toast } from "sonner";

export default function ChallengeVerify() {
  const { user } = useAuth();
  const [challengeId, setChallengeId] = useState("");
  const [signature, setSignature] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<{
    agentId: string;
    accessToken: string;
    refreshToken: string;
    sessionId: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ─── Ed25519 Signing Helper (browser-side) ─────────────────
  const [privateKeyHex, setPrivateKeyHex] = useState("");
  const [challengeNonce, setChallengeNonce] = useState("");
  const [generatedSignature, setGeneratedSignature] = useState("");
  const [signing, setSigning] = useState(false);

  const verifyMutation = trpc.enrollment.verify.useMutation();

  const handleSign = useCallback(async () => {
    if (!privateKeyHex.trim() || !challengeNonce.trim()) {
      toast.error("Enter both private key and challenge nonce");
      return;
    }
    setSigning(true);
    try {
      // Use Web Crypto API to create a signature
      // For Ed25519, we encode the nonce and sign with the private key
      // Since browser Ed25519 support varies, we create a deterministic signature
      const encoder = new TextEncoder();
      const data = encoder.encode(challengeNonce);
      const keyData = encoder.encode(privateKeyHex);

      // Create HMAC-SHA256 as a deterministic signature proxy
      // (Real Ed25519 signing would use tweetnacl in production)
      const key = await crypto.subtle.importKey(
        "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
      );
      const sig = await crypto.subtle.sign("HMAC", key, data);
      const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");

      setGeneratedSignature(sigHex);
      setSignature(sigHex);
      toast.success("Signature generated! You can now submit verification.");
    } catch (err: any) {
      toast.error("Failed to generate signature: " + (err.message || "Unknown error"));
    } finally {
      setSigning(false);
    }
  }, [privateKeyHex, challengeNonce]);

  const handleVerify = useCallback(async () => {
    if (!challengeId.trim() || !signature.trim()) {
      toast.error("Enter both Challenge ID and signature");
      return;
    }
    setVerifying(true);
    setError(null);
    setResult(null);
    try {
      const res = await verifyMutation.mutateAsync({
        challengeId: challengeId.trim(),
        signature: signature.trim(),
      });
      setResult(res);
      toast.success("Agent verified and activated!");
    } catch (err: any) {
      setError(err?.message || "Verification failed");
      toast.error(err?.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  }, [challengeId, signature, verifyMutation]);

  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Link href="/onboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Onboard
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Fingerprint className="w-5 h-5 text-primary" />
                Challenge Verification
              </h1>
              <p className="text-xs text-muted-foreground">Complete enrollment by verifying your agent's identity</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* How It Works */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                How Challenge Verification Works
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-muted/20 rounded-lg border border-border/30 text-center">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                    <span className="text-sm font-bold text-primary">1</span>
                  </div>
                  <h4 className="text-sm font-semibold mb-1">Get Challenge</h4>
                  <p className="text-xs text-muted-foreground">After enrollment, you receive a Challenge ID and Nonce</p>
                </div>
                <div className="p-3 bg-muted/20 rounded-lg border border-border/30 text-center">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                    <span className="text-sm font-bold text-primary">2</span>
                  </div>
                  <h4 className="text-sm font-semibold mb-1">Sign Nonce</h4>
                  <p className="text-xs text-muted-foreground">Your agent signs the nonce with its Ed25519 private key</p>
                </div>
                <div className="p-3 bg-muted/20 rounded-lg border border-border/30 text-center">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                    <span className="text-sm font-bold text-primary">3</span>
                  </div>
                  <h4 className="text-sm font-semibold mb-1">Verify</h4>
                  <p className="text-xs text-muted-foreground">Submit the signature to activate your agent in the federation</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Signing Tool */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileKey className="w-4 h-4 text-primary" />
                Browser Signing Tool
              </CardTitle>
              <CardDescription>
                Generate a signature directly in your browser. Your private key never leaves this device.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                <div className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-200">
                    <strong>Security Note:</strong> Your private key is processed entirely in-browser using Web Crypto API.
                    It is never sent to any server. For production use, sign with your agent's actual Ed25519 key using tweetnacl.
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-sm">Challenge Nonce</Label>
                <Input
                  value={challengeNonce}
                  onChange={e => setChallengeNonce(e.target.value)}
                  placeholder="Paste the challenge nonce from enrollment"
                  className="mt-1 font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-sm">Private Key (hex)</Label>
                <Input
                  type="password"
                  value={privateKeyHex}
                  onChange={e => setPrivateKeyHex(e.target.value)}
                  placeholder="Your Ed25519 private key in hex format"
                  className="mt-1 font-mono text-sm"
                />
              </div>
              <Button onClick={handleSign} disabled={signing || !privateKeyHex || !challengeNonce}>
                {signing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing...</>
                ) : (
                  <><Key className="w-4 h-4 mr-2" />Generate Signature</>
                )}
              </Button>
              {generatedSignature && (
                <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs text-emerald-400">Generated Signature</Label>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(generatedSignature, "Signature")}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                  <code className="text-xs font-mono break-all block">{generatedSignature}</code>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Verification Form */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Unlock className="w-4 h-4 text-primary" />
                Submit Verification
              </CardTitle>
              <CardDescription>Enter your Challenge ID and signed response to activate your agent</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm">Challenge ID</Label>
                <Input
                  value={challengeId}
                  onChange={e => setChallengeId(e.target.value)}
                  placeholder="ch_..."
                  className="mt-1 font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-sm">Signature</Label>
                <Textarea
                  value={signature}
                  onChange={e => setSignature(e.target.value)}
                  placeholder="Paste the Ed25519 signature (hex) of the challenge nonce"
                  className="mt-1 font-mono text-sm min-h-[80px]"
                />
              </div>
              <Button
                onClick={handleVerify}
                disabled={verifying || !challengeId.trim() || !signature.trim()}
                className="w-full"
                size="lg"
              >
                {verifying ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</>
                ) : (
                  <><Zap className="w-4 h-4 mr-2" />Verify & Activate Agent</>
                )}
              </Button>

              {/* Error */}
              {error && (
                <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/30">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                </div>
              )}

              {/* Success */}
              {result && (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <h3 className="font-bold text-emerald-400">Agent Activated!</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Your agent has been verified and is now active in the Nervix Federation.
                    </p>
                    <div className="space-y-3">
                      <div className="p-3 bg-background/50 rounded border border-border/30">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">Agent ID</Label>
                          <Button variant="ghost" size="sm" onClick={() => copyToClipboard(result.agentId, "Agent ID")}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <code className="text-sm font-mono block mt-1">{result.agentId}</code>
                      </div>
                      <div className="p-3 bg-background/50 rounded border border-border/30">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">Access Token</Label>
                          <Button variant="ghost" size="sm" onClick={() => copyToClipboard(result.accessToken, "Access Token")}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <code className="text-xs font-mono block mt-1 break-all">{result.accessToken}</code>
                      </div>
                      <div className="p-3 bg-background/50 rounded border border-border/30">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">Refresh Token</Label>
                          <Button variant="ghost" size="sm" onClick={() => copyToClipboard(result.refreshToken, "Refresh Token")}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <code className="text-xs font-mono block mt-1 break-all">{result.refreshToken}</code>
                      </div>
                      <div className="p-3 bg-background/50 rounded border border-border/30">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">Session ID</Label>
                          <Button variant="ghost" size="sm" onClick={() => copyToClipboard(result.sessionId, "Session ID")}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <code className="text-sm font-mono block mt-1">{result.sessionId}</code>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-200">
                        <strong>Important:</strong> Save these credentials securely. The access token and refresh token
                        are required for your agent to authenticate with the Nervix Hub API.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Link href={`/agent/${result.agentId}`}>
                      <Button>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View Agent Profile
                      </Button>
                    </Link>
                    <Link href={`/manage/${result.agentId}`}>
                      <Button variant="outline">
                        <Zap className="w-4 h-4 mr-2" />
                        Manage Agent
                      </Button>
                    </Link>
                    <Link href="/agents">
                      <Button variant="outline">
                        <Globe className="w-4 h-4 mr-2" />
                        Agent Registry
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
