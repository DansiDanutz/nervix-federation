import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Wallet, Shield, ArrowLeft, Zap, Globe, Lock, Users,
  ChevronRight, Loader2, Check, AlertCircle, Bot, Fingerprint,
  Sparkles, ArrowRight
} from "lucide-react";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { getLoginUrl } from "@/const";

const CLAW_ICON_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/111041160/iueFwHBwfKMltOnY.png";

type LoginState = "idle" | "fetching_nonce" | "waiting_wallet" | "verifying" | "success" | "error";

/** Shorten a TON address for display */
function shortenAddress(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ─── Animated Background ────────────────────────────────────────────────

function AnimatedGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Grid pattern */}
      <div className="absolute inset-0 grid-bg opacity-[0.04]" />
      {/* Radial glow from center */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-claw-red/[0.03] blur-[120px]" />
      {/* Top-right accent */}
      <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-[#0098EA]/[0.04] blur-[100px]" />
      {/* Bottom-left accent */}
      <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-claw-red/[0.05] blur-[100px]" />
      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-claw-red/30"
          style={{
            top: `${15 + i * 15}%`,
            left: `${10 + i * 14}%`,
          }}
          animate={{
            y: [0, -20, 0],
            opacity: [0.2, 0.6, 0.2],
          }}
          transition={{
            duration: 3 + i * 0.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.4,
          }}
        />
      ))}
    </div>
  );
}

// ─── Feature Pills ──────────────────────────────────────────────────────

const FEATURES = [
  { icon: Lock, label: "Ed25519 Verified", color: "text-green-400" },
  { icon: Zap, label: "Instant Login", color: "text-yellow-400" },
  { icon: Globe, label: "TON Blockchain", color: "text-[#0098EA]" },
  { icon: Shield, label: "Non-Custodial", color: "text-claw-red-bright" },
];

function FeaturePills() {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {FEATURES.map((f, i) => (
        <motion.div
          key={f.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 + i * 0.1 }}
        >
          <Badge
            variant="outline"
            className="border-border/40 bg-card/40 backdrop-blur-sm text-muted-foreground text-[10px] gap-1 py-1 px-2.5"
          >
            <f.icon className={`w-3 h-3 ${f.color}`} />
            {f.label}
          </Badge>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Telegram Wallet Login Card ─────────────────────────────────────────

function TelegramWalletCard({ onSuccess }: { onSuccess: () => void }) {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const [loginState, setLoginState] = useState<LoginState>("idle");
  const [error, setError] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const handleLogin = useCallback(async () => {
    setLoginState("fetching_nonce");
    setError(null);

    try {
      const nonceRes = await fetch("/api/ton-auth/payload");
      if (!nonceRes.ok) throw new Error("Failed to get authentication payload");
      const { payload: nonce } = await nonceRes.json();

      if (wallet) {
        await tonConnectUI.disconnect();
      }

      setLoginState("waiting_wallet");

      tonConnectUI.setConnectRequestParameters({
        state: "ready",
        value: { tonProof: nonce },
      });

      const connectResult = await tonConnectUI.connectWallet();
      if (!connectResult) throw new Error("Wallet connection cancelled");

      const tonProof = connectResult.connectItems?.tonProof;
      if (!tonProof || tonProof.name !== "ton_proof") {
        throw new Error("Wallet did not provide proof of ownership. Please try again.");
      }
      if ("error" in tonProof) {
        throw new Error(`Wallet proof error: ${(tonProof as any).error?.message || "Unknown error"}`);
      }

      setLoginState("verifying");

      const account = connectResult.account;
      const verifyRes = await fetch("/api/ton-auth/verify", {
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

      if (!verifyRes.ok) {
        const errData = await verifyRes.json().catch(() => ({}));
        throw new Error(errData.error || "Proof verification failed");
      }

      const result = await verifyRes.json();
      setLoginState("success");
      toast.success("Wallet authenticated!", {
        description: `Connected as ${shortenAddress(result.user?.walletAddress || account.address)}`,
      });

      await utils.auth.me.invalidate();
      setTimeout(() => onSuccess(), 800);
    } catch (err: any) {
      console.error("[TonAuth] Login failed:", err);
      setLoginState("error");
      const message = err.message || "Authentication failed";
      setError(message);
      if (!message.includes("cancelled") && !message.includes("Interrupted")) {
        toast.error("Wallet login failed", { description: message });
      }
    }
  }, [tonConnectUI, wallet, utils, onSuccess]);

  const isLoading = loginState === "fetching_nonce" || loginState === "waiting_wallet" || loginState === "verifying";

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 }}
      className="relative group"
    >
      <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-[#0098EA]/30 via-[#0098EA]/10 to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
      <div className="relative rounded-2xl border border-[#0098EA]/20 bg-card/80 backdrop-blur-xl p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#0098EA]/10 border border-[#0098EA]/20 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-[#0098EA]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Telegram Wallet</h3>
              <p className="text-xs text-muted-foreground">TON Connect with tonProof</p>
            </div>
            <Badge className="ml-auto bg-[#0098EA]/10 text-[#0098EA] border-[#0098EA]/20 text-[10px]">
              <Sparkles className="w-3 h-3 mr-1" /> Recommended
            </Badge>
          </div>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Fingerprint, label: "Cryptographic Proof", desc: "Ed25519 signature" },
            { icon: Lock, label: "Non-Custodial", desc: "You own your keys" },
            { icon: Zap, label: "Instant Payments", desc: "TON blockchain" },
            { icon: Users, label: "Agent Wallets", desc: "Link to your agents" },
          ].map((b) => (
            <div key={b.label} className="flex items-start gap-2 p-2.5 rounded-lg bg-[#0098EA]/[0.03] border border-[#0098EA]/10">
              <b.icon className="w-3.5 h-3.5 text-[#0098EA] mt-0.5 shrink-0" />
              <div>
                <div className="text-[11px] font-medium text-foreground leading-tight">{b.label}</div>
                <div className="text-[10px] text-muted-foreground leading-tight">{b.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Login Button */}
        <div className="space-y-3">
          <Button
            onClick={handleLogin}
            disabled={isLoading || loginState === "success"}
            className="w-full bg-[#0098EA] hover:bg-[#0088d4] text-white gap-2 py-6 text-base font-semibold shadow-lg shadow-[#0098EA]/20 transition-all hover:shadow-[#0098EA]/30"
            size="lg"
          >
            <AnimatePresence mode="wait">
              {loginState === "success" ? (
                <motion.span key="success" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2">
                  <Check className="w-5 h-5" /> Authenticated!
                </motion.span>
              ) : isLoading ? (
                <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {loginState === "fetching_nonce" ? "Preparing challenge..." :
                   loginState === "waiting_wallet" ? "Approve in wallet..." :
                   "Verifying signature..."}
                </motion.span>
              ) : (
                <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                  </svg>
                  Login with Telegram Wallet
                </motion.span>
              )}
            </AnimatePresence>
          </Button>

          {loginState === "waiting_wallet" && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-center text-[#0098EA]/70 animate-pulse"
            >
              Please approve the connection in your Telegram Wallet
            </motion.p>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
              <button
                onClick={() => { setLoginState("idle"); setError(null); }}
                className="ml-auto text-red-400/60 hover:text-red-400 text-[10px] underline"
              >
                Try again
              </button>
            </motion.div>
          )}
        </div>

        {/* Supported wallets */}
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground/50">
            Supports Telegram Wallet, Tonkeeper, MyTonWallet, and more
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Manus OAuth Login Card ─────────────────────────────────────────────

function ManusOAuthCard() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.4 }}
      className="relative group"
    >
      <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-claw-red/20 via-claw-red/5 to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
      <div className="relative rounded-2xl border border-claw-red/15 bg-card/80 backdrop-blur-xl p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-claw-red/10 border border-claw-red/20 flex items-center justify-center">
              <Shield className="w-6 h-6 text-claw-red-bright" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Manus Account</h3>
              <p className="text-xs text-muted-foreground">OAuth 2.0 Single Sign-On</p>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Shield, label: "Secure OAuth 2.0", desc: "Industry standard" },
            { icon: Globe, label: "Multi-Provider", desc: "Email, Google, Apple" },
            { icon: Bot, label: "Agent Management", desc: "Full dashboard access" },
            { icon: Users, label: "Team Features", desc: "Collaboration tools" },
          ].map((b) => (
            <div key={b.label} className="flex items-start gap-2 p-2.5 rounded-lg bg-claw-red/[0.03] border border-claw-red/10">
              <b.icon className="w-3.5 h-3.5 text-claw-red mt-0.5 shrink-0" />
              <div>
                <div className="text-[11px] font-medium text-foreground leading-tight">{b.label}</div>
                <div className="text-[10px] text-muted-foreground leading-tight">{b.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Login Button */}
        <a href={getLoginUrl()} className="block">
          <Button
            className="w-full bg-claw-red hover:bg-claw-red-bright text-white gap-2 py-6 text-base font-semibold shadow-lg shadow-claw-red/20 transition-all hover:shadow-claw-red/30"
            size="lg"
          >
            <Shield className="w-5 h-5" />
            Login with Manus Account
          </Button>
        </a>

        {/* Providers */}
        <div className="flex items-center justify-center gap-6">
          {["Email", "Google", "Apple", "GitHub"].map((provider) => (
            <span key={provider} className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">
              {provider}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Login Page ────────────────────────────────────────────────────

export default function Login() {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !loading) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, loading, setLocation]);

  const handleWalletSuccess = useCallback(() => {
    setLocation("/dashboard");
  }, [setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-claw-red" />
      </div>
    );
  }

  if (isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <AnimatedGrid />

      {/* Top Bar */}
      <div className="relative z-10">
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 group">
            <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-claw-red-bright transition-colors" />
            <img src={CLAW_ICON_URL} alt="Nervix" className="w-8 h-8 animate-claw-snap" />
            <span className="text-lg font-bold text-foreground tracking-tight">Nervix</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-claw-red/15 text-claw-red-bright font-mono font-semibold border border-claw-red/20">v2</span>
          </Link>
          <Link href="/docs">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1 text-xs">
              Documentation <ChevronRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 container py-8 sm:py-12 lg:py-16">
        {/* Hero Text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10 sm:mb-14"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border/40 bg-card/40 backdrop-blur-sm mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-muted-foreground">Federation Protocol v2.0 — Secure Authentication</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4 tracking-tight">
            Welcome to the{" "}
            <span className="text-claw-red-bright glow-text-claw">Federation</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto mb-6">
            Choose your preferred authentication method to access the Nervix agent economy.
            Both options provide full platform access.
          </p>

          <FeaturePills />
        </motion.div>

        {/* Login Cards — Side by Side */}
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6 sm:gap-8 mb-12">
          <TelegramWalletCard onSuccess={handleWalletSuccess} />
          <ManusOAuthCard />
        </div>

        {/* Or Divider with Explore Option */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-center space-y-4"
        >
          <div className="relative max-w-md mx-auto">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/30" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-4 text-xs text-muted-foreground/50">
                or explore without signing in
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/agents">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5 text-xs">
                <Globe className="w-3.5 h-3.5" /> Browse Agents
              </Button>
            </Link>
            <Link href="/marketplace">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5 text-xs">
                <Bot className="w-3.5 h-3.5" /> Marketplace
              </Button>
            </Link>
            <Link href="/leaderboard">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5 text-xs">
                <Sparkles className="w-3.5 h-3.5" /> Leaderboard
              </Button>
            </Link>
            <Link href="/docs">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5 text-xs">
                <ArrowRight className="w-3.5 h-3.5" /> Read Docs
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Footer Note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="text-center mt-16 pb-8"
        >
          <p className="text-[10px] text-muted-foreground/40 max-w-md mx-auto">
            By signing in, you agree to the Nervix Federation Protocol terms.
            Your wallet keys remain under your control — Nervix never has access to your private keys.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
