/**
 * TON Wallet Login Component
 * 
 * Provides "Login with Telegram Wallet" functionality using TON Connect's tonProof protocol.
 * 
 * Flow:
 * 1. User clicks "Login with Telegram Wallet"
 * 2. We fetch a nonce from /api/ton-auth/payload
 * 3. TON Connect opens the wallet (Tonkeeper, Telegram Wallet, etc.)
 * 4. Wallet signs the proof with the nonce
 * 5. We send the proof to /api/ton-auth/verify
 * 6. Server verifies the Ed25519 signature and creates a session
 * 7. User is logged in
 */
import { useState, useCallback, useEffect } from "react";
import { useTonConnectUI, useTonWallet, useTonAddress } from "@tonconnect/ui-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, Shield, Check, Loader2, AlertCircle, Link2, ExternalLink, Copy, LogOut, RefreshCw, Bot } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

/** Shorten a TON address for display */
function shortenAddress(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

type LoginState = "idle" | "fetching_nonce" | "waiting_wallet" | "verifying" | "success" | "error";

/**
 * Main wallet login button — triggers the full tonProof authentication flow.
 * Can be used standalone or inside a login page.
 */
export function TonWalletLoginButton({ 
  onSuccess,
  compact = false,
}: { 
  onSuccess?: () => void;
  compact?: boolean;
}) {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const [loginState, setLoginState] = useState<LoginState>("idle");
  const [error, setError] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const handleLogin = useCallback(async () => {
    setLoginState("fetching_nonce");
    setError(null);

    try {
      // 1. Fetch nonce from server
      const nonceRes = await fetch("/api/ton-auth/payload");
      if (!nonceRes.ok) throw new Error("Failed to get authentication payload");
      const { payload: nonce } = await nonceRes.json();

      // 2. Disconnect any existing connection first
      if (wallet) {
        await tonConnectUI.disconnect();
      }

      setLoginState("waiting_wallet");

      // 3. Open TON Connect with tonProof request
      tonConnectUI.setConnectRequestParameters({
        state: "ready",
        value: { tonProof: nonce },
      });

      // 4. Connect — this opens the wallet selector
      const connectResult = await tonConnectUI.connectWallet();

      // 5. Extract the proof from the connect result
      if (!connectResult) {
        throw new Error("Wallet connection cancelled");
      }

      const tonProof = connectResult.connectItems?.tonProof;
      if (!tonProof || tonProof.name !== "ton_proof") {
        throw new Error("Wallet did not provide proof of ownership. Please try again.");
      }

      if ("error" in tonProof) {
        throw new Error(`Wallet proof error: ${(tonProof as any).error?.message || "Unknown error"}`);
      }

      setLoginState("verifying");

      // 6. Build the verification payload
      const account = connectResult.account;
      const verifyPayload = {
        address: account.address,
        network: account.chain,
        public_key: account.publicKey || "",
        proof: {
          timestamp: tonProof.proof.timestamp,
          domain: tonProof.proof.domain,
          signature: tonProof.proof.signature,
          payload: tonProof.proof.payload,
          state_init: account.walletStateInit || "",
        },
      };

      // 7. Send to server for verification
      const verifyRes = await fetch("/api/ton-auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(verifyPayload),
      });

      if (!verifyRes.ok) {
        const errData = await verifyRes.json().catch(() => ({}));
        throw new Error(errData.error || "Proof verification failed");
      }

      const result = await verifyRes.json();

      setLoginState("success");
      toast.success("Wallet authenticated!", {
        description: `Connected as ${shortenAddress(result.user?.walletAddress || account.address)}`,
      });

      // Invalidate auth cache so useAuth picks up the new session
      await utils.auth.me.invalidate();

      onSuccess?.();
    } catch (err: any) {
      console.error("[TonAuth] Login failed:", err);
      setLoginState("error");
      const message = err.message || "Authentication failed";
      setError(message);
      // Don't toast on user cancellation
      if (!message.includes("cancelled") && !message.includes("Interrupted")) {
        toast.error("Wallet login failed", { description: message });
      }
    }
  }, [tonConnectUI, wallet, utils, onSuccess]);

  if (compact) {
    return (
      <Button
        onClick={handleLogin}
        disabled={loginState === "fetching_nonce" || loginState === "waiting_wallet" || loginState === "verifying"}
        className="bg-[#0098EA] hover:bg-[#0088d4] text-white gap-2"
        size="sm"
      >
        {loginState === "fetching_nonce" || loginState === "verifying" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : loginState === "waiting_wallet" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Wallet className="w-4 h-4" />
        )}
        {loginState === "fetching_nonce" ? "Preparing..." :
         loginState === "waiting_wallet" ? "Open Wallet..." :
         loginState === "verifying" ? "Verifying..." :
         "Login with TON Wallet"}
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <Button
        onClick={handleLogin}
        disabled={loginState === "fetching_nonce" || loginState === "waiting_wallet" || loginState === "verifying"}
        className="w-full bg-[#0098EA] hover:bg-[#0088d4] text-white gap-2 py-6 text-base"
        size="lg"
      >
        {loginState === "fetching_nonce" || loginState === "verifying" ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : loginState === "waiting_wallet" ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : loginState === "success" ? (
          <Check className="w-5 h-5" />
        ) : (
          <Wallet className="w-5 h-5" />
        )}
        {loginState === "fetching_nonce" ? "Preparing secure challenge..." :
         loginState === "waiting_wallet" ? "Waiting for wallet approval..." :
         loginState === "verifying" ? "Verifying signature..." :
         loginState === "success" ? "Authenticated!" :
         "Login with Telegram Wallet"}
      </Button>

      {loginState === "waiting_wallet" && (
        <p className="text-xs text-center text-muted-foreground animate-pulse">
          Please approve the connection in your wallet app
        </p>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground/60">
        <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Ed25519 Verified</span>
        <span>•</span>
        <span>Supports Tonkeeper, Telegram Wallet & more</span>
      </div>
    </div>
  );
}

/**
 * Wallet link button — for users already logged in via Manus OAuth
 * who want to link their TON wallet to their account.
 */
export function LinkWalletButton({ onLinked }: { onLinked?: (address: string) => void }) {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const [linking, setLinking] = useState(false);
  const utils = trpc.useUtils();

  const handleLink = useCallback(async () => {
    setLinking(true);
    try {
      // 1. Fetch nonce
      const nonceRes = await fetch("/api/ton-auth/payload");
      if (!nonceRes.ok) throw new Error("Failed to get payload");
      const { payload: nonce } = await nonceRes.json();

      // 2. Disconnect existing if any
      if (wallet) {
        await tonConnectUI.disconnect();
      }

      // 3. Connect with proof
      tonConnectUI.setConnectRequestParameters({
        state: "ready",
        value: { tonProof: nonce },
      });

      const connectResult = await tonConnectUI.connectWallet();
      if (!connectResult) throw new Error("Connection cancelled");

      const tonProof = connectResult.connectItems?.tonProof;
      if (!tonProof || tonProof.name !== "ton_proof" || "error" in tonProof) {
        throw new Error("Wallet did not provide proof");
      }

      // 4. Send to link endpoint
      const account = connectResult.account;
      const linkRes = await fetch("/api/ton-auth/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: account.address,
          network: account.chain,
          public_key: account.publicKey || "",
          proof: {
            timestamp: tonProof.proof.timestamp,
            domain: tonProof.proof.domain,
            signature: tonProof.proof.signature,
            payload: tonProof.proof.payload,
            state_init: account.walletStateInit || "",
          },
        }),
      });

      if (!linkRes.ok) {
        const errData = await linkRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to link wallet");
      }

      const result = await linkRes.json();
      toast.success("Wallet linked!", {
        description: `${shortenAddress(result.walletAddress)} is now linked to your account`,
      });

      await utils.auth.me.invalidate();
      await utils.auth.walletInfo.invalidate();
      onLinked?.(result.walletAddress);
    } catch (err: any) {
      if (!err.message?.includes("cancelled")) {
        toast.error("Failed to link wallet", { description: err.message });
      }
    } finally {
      setLinking(false);
    }
  }, [tonConnectUI, wallet, utils, onLinked]);

  return (
    <Button
      onClick={handleLink}
      disabled={linking}
      variant="outline"
      className="gap-2 border-[#0098EA]/30 text-[#0098EA] hover:bg-[#0098EA]/10"
    >
      {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
      {linking ? "Linking..." : "Link TON Wallet"}
    </Button>
  );
}

/**
 * Full wallet status card — shows connected wallet info, link status, and actions.
 * Used in Dashboard/Settings pages.
 */
export function WalletStatusCard() {
  const wallet = useTonWallet();
  const userAddress = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const [copied, setCopied] = useState(false);
  const { data: walletInfo, isLoading } = trpc.auth.walletInfo.useQuery(undefined, {
    retry: false,
  });

  const handleCopy = () => {
    const addr = walletInfo?.walletAddress || userAddress;
    if (addr) {
      navigator.clipboard.writeText(addr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/60">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading wallet info...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const linkedAddress = walletInfo?.walletAddress;
  const displayAddress = linkedAddress || (wallet ? userAddress : null);

  return (
    <Card className="border-[#0098EA]/20 bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[#0098EA]" />
            TON Wallet
          </CardTitle>
          {linkedAddress ? (
            <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[10px]">
              <Check className="w-3 h-3 mr-1" /> Linked & Verified
            </Badge>
          ) : wallet ? (
            <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-[10px]">
              Connected (Not Linked)
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground text-[10px]">
              Not Connected
            </Badge>
          )}
        </div>
        {linkedAddress && (
          <CardDescription className="text-xs">
            Wallet verified via Ed25519 tonProof — secured on TON blockchain
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {displayAddress ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Address</span>
              <div className="flex items-center gap-1">
                <code className="text-xs font-mono text-foreground">{shortenAddress(displayAddress)}</code>
                <button onClick={handleCopy} className="p-1 hover:bg-white/10 rounded transition-colors">
                  {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                </button>
                <a
                  href={`https://tonscan.org/address/${displayAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </a>
              </div>
            </div>

            {walletInfo?.loginMethod === "telegram_wallet" && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Auth Method</span>
                <span className="text-xs text-[#0098EA]">Telegram Wallet (tonProof)</span>
              </div>
            )}

            {wallet && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Wallet App</span>
                <span className="text-xs text-foreground">{wallet.device.appName}</span>
              </div>
            )}

            {/* Agent Wallet Sync Status */}
            {linkedAddress && walletInfo?.ownedAgents && walletInfo.ownedAgents.length > 0 && (
              <AgentWalletSyncSection agents={walletInfo.ownedAgents} />
            )}

            {!linkedAddress && (
              <div className="pt-2">
                <LinkWalletButton />
              </div>
            )}

            {wallet && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground hover:text-red-400"
                onClick={() => tonConnectUI.disconnect()}
              >
                <LogOut className="w-3 h-3 mr-1" /> Disconnect Wallet
              </Button>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Connect your Telegram Wallet or Tonkeeper to enable on-chain payments and secure your account with wallet-based authentication.
            </p>
            <TonWalletLoginButton />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Agent Wallet Sync Section — shows which agents have synced wallets and provides a sync button.
 */
function AgentWalletSyncSection({ agents }: { agents: { agentId: string; name: string; walletAddress: string | null; isSynced: boolean }[] }) {
  const utils = trpc.useUtils();
  const syncMutation = trpc.auth.syncWalletToAgents.useMutation({
    onSuccess: (data) => {
      if (data.synced > 0) {
        toast.success(`Wallet synced to ${data.synced} agent(s)`);
      } else {
        toast.info("All agents already have your wallet address");
      }
      utils.auth.walletInfo.invalidate();
    },
    onError: (err) => {
      toast.error("Failed to sync wallet", { description: err.message });
    },
  });

  const allSynced = agents.every(a => a.isSynced);
  const unsyncedCount = agents.filter(a => !a.isSynced).length;

  return (
    <div className="border-t border-border/30 pt-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Bot className="w-3 h-3" /> Agent Wallets
        </span>
        {allSynced ? (
          <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[10px]">
            <Check className="w-3 h-3 mr-1" /> All Synced
          </Badge>
        ) : (
          <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-[10px]">
            {unsyncedCount} Unsynced
          </Badge>
        )}
      </div>

      {/* Agent list */}
      <div className="space-y-1">
        {agents.map(agent => (
          <div key={agent.agentId} className="flex items-center justify-between py-1">
            <span className="text-xs text-foreground truncate max-w-[140px]">{agent.name}</span>
            {agent.isSynced ? (
              <span className="text-[10px] text-green-400 flex items-center gap-1">
                <Check className="w-3 h-3" /> Synced
              </span>
            ) : agent.walletAddress ? (
              <span className="text-[10px] text-yellow-400">Different wallet</span>
            ) : (
              <span className="text-[10px] text-muted-foreground">No wallet</span>
            )}
          </div>
        ))}
      </div>

      {/* Sync button */}
      {!allSynced && (
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs gap-1 border-[#0098EA]/30 text-[#0098EA] hover:bg-[#0098EA]/10"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
        >
          {syncMutation.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          Sync Wallet to {unsyncedCount} Agent{unsyncedCount > 1 ? "s" : ""}
        </Button>
      )}
    </div>
  );
}

/**
 * Login page section — shows both Manus OAuth and Telegram Wallet login options.
 */
export function LoginOptions({ onWalletSuccess }: { onWalletSuccess?: () => void }) {
  return (
    <div className="space-y-6">
      {/* Telegram Wallet Login */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Wallet className="w-4 h-4 text-[#0098EA]" />
          Login with Telegram Wallet
        </div>
        <TonWalletLoginButton onSuccess={onWalletSuccess} />
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border/50" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-background px-3 text-muted-foreground">or continue with</span>
        </div>
      </div>

      {/* Manus OAuth */}
      <div className="space-y-3">
        <a href={getManusLoginUrl()}>
          <Button variant="outline" className="w-full gap-2 py-6 text-base border-border/50 hover:border-claw-red/30" size="lg">
            <Shield className="w-5 h-5 text-claw-red" />
            Login with Manus Account
          </Button>
        </a>
        <p className="text-[10px] text-center text-muted-foreground/60">
          Email, Google, Apple, or GitHub via Manus OAuth
        </p>
      </div>
    </div>
  );
}

function getManusLoginUrl(): string {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);
  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");
  return url.toString();
}
