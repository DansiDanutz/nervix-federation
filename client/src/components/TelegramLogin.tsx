/**
 * Telegram Login Widget Component
 * Uses the official Telegram Login Widget + post-login TON wallet linking guide
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, CheckCircle, AlertCircle, Wallet, ArrowRight,
  Shield, Zap, ExternalLink, X, Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface TelegramAuthResult {
  success: boolean;
  isNew: boolean;
  user: {
    id: number;
    name: string;
    avatarUrl?: string;
    telegramUsername?: string;
    walletLinked: boolean;
    walletAddress?: string;
  };
}

// ─── Wallet Linking Guide Modal ──────────────────────────────────────────────

function WalletLinkingModal({
  userName,
  onLink,
  onSkip,
}: {
  userName: string;
  onLink: () => void;
  onSkip: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-md rounded-2xl border border-[#0098EA]/30 bg-card/95 backdrop-blur-xl p-8 space-y-6 shadow-2xl"
      >
        {/* Close */}
        <button onClick={onSkip} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[#0098EA]/10 border border-[#0098EA]/20 flex items-center justify-center">
            <Wallet className="w-8 h-8 text-[#0098EA]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Link your TON Wallet</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Hi <strong className="text-foreground">{userName}</strong>! You're logged in via Telegram.
            </p>
          </div>
        </div>

        {/* Why link */}
        <div className="space-y-2">
          {[
            { icon: Zap, label: "Instant TON payments", desc: "Receive task rewards directly in your wallet", color: "text-yellow-400" },
            { icon: Shield, label: "Cryptographic identity", desc: "Your wallet becomes your on-chain reputation", color: "text-green-400" },
            { icon: Sparkles, label: "Full platform access", desc: "Trade knowledge, escrow tasks, earn credits", color: "text-[#0098EA]" },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-3 p-3 rounded-xl bg-[#0098EA]/[0.04] border border-[#0098EA]/10">
              <item.icon className={`w-4 h-4 mt-0.5 shrink-0 ${item.color}`} />
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* How to: Telegram Wallet steps */}
        <div className="bg-[#0098EA]/[0.04] border border-[#0098EA]/15 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-[#0098EA] mb-2">📱 How to use Telegram Wallet:</p>
          {[
            "Open Telegram app",
            'Tap the menu → "Wallet" (or search @wallet)',
            "Set up your TON wallet if you haven\'t yet",
            'Click "Connect Wallet" below',
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="w-4 h-4 rounded-full bg-[#0098EA]/20 text-[#0098EA] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
              {step}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={onLink}
            className="w-full bg-[#0098EA] hover:bg-[#0088d4] text-white gap-2 py-6 font-semibold"
            size="lg"
          >
            <Wallet className="w-5 h-5" />
            Connect TON Wallet
            <ArrowRight className="w-4 h-4 ml-auto" />
          </Button>
          <button
            onClick={onSkip}
            className="w-full text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1"
          >
            Skip for now — I'll link it later from Dashboard
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Telegram Login Button ────────────────────────────────────────────────────

export function TelegramLoginButton({ onSuccess }: { onSuccess?: () => void }) {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<TelegramAuthResult["user"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scriptRef = useRef<HTMLDivElement>(null);
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const utils = trpc.useUtils();

  // Fetch bot config on mount
  useEffect(() => {
    fetch("/api/auth/telegram/bot-info")
      .then(r => r.json())
      .then(data => {
        setConfigured(data.configured);
        if (data.configured) setBotUsername(data.botUsername);
      })
      .catch(() => setConfigured(false));
  }, []);

  // Expose callback for Telegram widget
  useEffect(() => {
    (window as any).onTelegramAuth = async (tgUser: TelegramUser) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tgUser),
        });
        const data: TelegramAuthResult = await res.json();
        if (!res.ok) throw new Error((data as any).error || "Auth failed");

        await utils.auth.me.invalidate();

        toast.success(data.isNew ? "Welcome to Nervix! 🎉" : `Welcome back, ${data.user.name}!`);

        setLoggedInUser(data.user);

        // If no wallet linked → show linking guide
        if (!data.user.walletLinked) {
          setShowWalletModal(true);
        } else {
          setTimeout(() => {
            onSuccess?.();
            setLocation("/dashboard");
          }, 500);
        }
      } catch (err: any) {
        setError(err.message || "Telegram login failed");
        toast.error("Login failed", { description: err.message });
      } finally {
        setLoading(false);
      }
    };
    return () => { delete (window as any).onTelegramAuth; };
  }, [utils, onSuccess, setLocation]);

  // Inject Telegram widget script
  useEffect(() => {
    if (!botUsername || !scriptRef.current) return;
    scriptRef.current.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    script.async = true;
    scriptRef.current.appendChild(script);
  }, [botUsername]);

  const handleWalletLink = useCallback(async () => {
    setShowWalletModal(false);
    try {
      // Fetch nonce
      const nonceRes = await fetch("/api/ton-auth/payload");
      const { payload: nonce } = await nonceRes.json();
      if (wallet) await tonConnectUI.disconnect();
      tonConnectUI.setConnectRequestParameters({ state: "ready", value: { tonProof: nonce } });
      const connectResult = await tonConnectUI.connectWallet();
      if (!connectResult) throw new Error("Cancelled");
      const tonProof = connectResult.connectItems?.tonProof;
      if (!tonProof || tonProof.name !== "ton_proof" || "error" in tonProof) throw new Error("No proof");

      const linkRes = await fetch("/api/ton-auth/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: connectResult.account.address,
          network: connectResult.account.chain,
          public_key: connectResult.account.publicKey || "",
          proof: {
            timestamp: tonProof.proof.timestamp,
            domain: tonProof.proof.domain,
            signature: tonProof.proof.signature,
            payload: tonProof.proof.payload,
            state_init: connectResult.account.walletStateInit || "",
          },
        }),
      });
      const linkData = await linkRes.json();
      if (!linkRes.ok) throw new Error(linkData.error);

      toast.success("Wallet linked! 🚀", { description: "Your TON wallet is now connected to your Nervix account." });
      await utils.auth.me.invalidate();
      onSuccess?.();
      setLocation("/dashboard");
    } catch (err: any) {
      if (!err.message?.includes("Cancel")) {
        toast.error("Wallet link failed", { description: err.message });
      }
      onSuccess?.();
      setLocation("/dashboard");
    }
  }, [tonConnectUI, wallet, utils, onSuccess, setLocation]);

  const handleSkip = useCallback(() => {
    setShowWalletModal(false);
    onSuccess?.();
    setLocation("/dashboard");
  }, [onSuccess, setLocation]);

  // Not configured yet
  if (configured === false) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground/50 p-3 rounded-xl border border-border/20 bg-background/40">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        Telegram login not configured yet
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        {showWalletModal && loggedInUser && (
          <WalletLinkingModal
            userName={loggedInUser.name}
            onLink={handleWalletLink}
            onSkip={handleSkip}
          />
        )}
      </AnimatePresence>

      <div className="space-y-3">
        {configured === null || loading ? (
          <div className="w-full py-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            {loading ? "Verifying..." : "Loading..."}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            {/* The actual Telegram widget renders here */}
            <div ref={scriptRef} className="flex justify-center" />
            <p className="text-[10px] text-muted-foreground/40 text-center">
              Official Telegram Login — no password needed
            </p>
          </div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
          </motion.div>
        )}
      </div>
    </>
  );
}

// ─── Telegram Login Card (for Login page) ────────────────────────────────────

export function TelegramLoginCard({ onSuccess }: { onSuccess: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="relative group"
    >
      <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-[#2AABEE]/30 via-[#2AABEE]/10 to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
      <div className="relative rounded-2xl border border-[#2AABEE]/20 bg-card/80 backdrop-blur-xl p-6 sm:p-8 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#2AABEE]/10 border border-[#2AABEE]/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#2AABEE]">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Telegram Login</h3>
            <p className="text-xs text-muted-foreground">One tap — no password needed</p>
          </div>
          <Badge className="ml-auto bg-[#2AABEE]/10 text-[#2AABEE] border-[#2AABEE]/20 text-[10px]">
            <Zap className="w-3 h-3 mr-1" /> Fastest
          </Badge>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "1-tap login", desc: "No email or password" },
            { label: "TON Wallet ready", desc: "Link in 10 seconds" },
            { label: "Telegram identity", desc: "Username + avatar" },
            { label: "Mobile-first", desc: "Best on Telegram app" },
          ].map((b) => (
            <div key={b.label} className="p-2.5 rounded-lg bg-[#2AABEE]/[0.03] border border-[#2AABEE]/10">
              <div className="text-[11px] font-medium text-foreground">{b.label}</div>
              <div className="text-[10px] text-muted-foreground">{b.desc}</div>
            </div>
          ))}
        </div>

        {/* Login button */}
        <TelegramLoginButton onSuccess={onSuccess} />
      </div>
    </motion.div>
  );
}
