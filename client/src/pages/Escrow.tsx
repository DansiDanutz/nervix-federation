import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { useState, useMemo, useCallback } from "react";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import {
  Shield, Wallet, ArrowLeft, Calculator, FileText, Gem,
  TrendingUp, Lock, CheckCircle, AlertTriangle, Banknote,
  Zap, ExternalLink, Copy, RefreshCw, Send, Loader2, ArrowUpRight
} from "lucide-react";
import { toast } from "sonner";
import { FEE_CONFIG } from "../../../shared/nervix-types";

// ─── Fee Type Constants ────────────────────────────────────────
const FEE_TYPES = [
  { value: 0, label: "Task Payment", bps: 250, description: "Agent completes a task" },
  { value: 1, label: "Blockchain Settlement", bps: 150, description: "On-chain settlement" },
  { value: 2, label: "Credit Transfer", bps: 100, description: "Agent-to-agent transfer" },
];

// ─── Claw Logo SVG ─────────────────────────────────────────────
function ClawIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="currentColor">
      <path d="M50 10 C30 10, 10 30, 15 55 C18 70, 30 80, 45 85 L50 75 L55 85 C70 80, 82 70, 85 55 C90 30, 70 10, 50 10 Z M35 35 C38 25, 45 22, 48 30 L45 50 L38 48 Z M65 35 C62 25, 55 22, 52 30 L55 50 L62 48 Z" />
    </svg>
  );
}

export default function Escrow() {
  const { user, isAuthenticated } = useAuth();
  const [feeType, setFeeType] = useState<number>(0);
  const [amount, setAmount] = useState<string>("10");
  const [isOpenClaw, setIsOpenClaw] = useState(true);
  const [lookupId, setLookupId] = useState<string>("");

  // ─── Send to Treasury State ────────────────────────────────
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendAmount, setSendAmount] = useState<string>("");
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  const sendAmountNum = useMemo(() => parseFloat(sendAmount) || 0, [sendAmount]);
  const sendAmountNano = useMemo(() => Math.floor(sendAmountNum * 1e9).toString(), [sendAmountNum]);

  const handleSendToTreasury = useCallback(async () => {
    if (!wallet) {
      toast.error("Please connect your wallet first");
      try { await tonConnectUI.openModal(); } catch {}
      return;
    }
    if (sendAmountNum < 0.01) {
      toast.error("Minimum send amount is 0.01 TON");
      return;
    }
    if (sendAmountNum > 10000) {
      toast.error("Maximum send amount is 10,000 TON");
      return;
    }

    setSendStatus("sending");
    setTxHash(null);

    try {
      const treasuryAddress = FEE_CONFIG.treasuryWallet;
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600, // 10 min
        messages: [
          {
            address: treasuryAddress,
            amount: sendAmountNano,
          },
        ],
      };

      const result = await tonConnectUI.sendTransaction(transaction);
      
      // Extract BOC hash for reference
      const boc = result?.boc;
      if (boc) {
        setTxHash(boc.slice(0, 24) + "...");
      }

      setSendStatus("success");
      toast.success(`Successfully sent ${sendAmountNum} TON to treasury!`);
      
      // Refresh balance after a short delay
      setTimeout(() => {
        walletBalance.refetch();
      }, 5000);
    } catch (err: any) {
      setSendStatus("error");
      if (err?.message?.includes("User rejected") || err?.message?.includes("Cancelled")) {
        toast.error("Transaction cancelled by user");
      } else {
        toast.error(err?.message || "Failed to send transaction");
      }
    }
  }, [wallet, tonConnectUI, sendAmountNum, sendAmountNano]);

  const resetSendDialog = useCallback(() => {
    setSendDialogOpen(false);
    setSendAmount("");
    setSendStatus("idle");
    setTxHash(null);
  }, []);

  // ─── tRPC Queries ──────────────────────────────────────────
  const contractInfo = trpc.escrow.contractInfo.useQuery();
  const treasuryInfo = trpc.escrow.treasuryInfo.useQuery();
  const feeSchedule = trpc.economy.feeSchedule.useQuery();
  const walletBalance = trpc.escrow.treasuryWalletBalance.useQuery(undefined, {
    refetchInterval: 30_000, // Auto-refresh every 30 seconds
  });

  const amountNum = useMemo(() => parseFloat(amount) || 0, [amount]);
  const feePreview = trpc.escrow.previewFee.useQuery(
    { amountTON: amountNum, feeType, isOpenClaw },
    { enabled: amountNum > 0 }
  );

  const escrowLookupId = useMemo(() => parseInt(lookupId) || 0, [lookupId]);
  const escrowLookup = trpc.escrow.getEscrow.useQuery(
    { escrowId: escrowLookupId },
    { enabled: escrowLookupId > 0 }
  );

  const info = contractInfo.data;
  const treasury = treasuryInfo.data;

  return (
    <div className="min-h-screen bg-background">
      {/* ─── Navigation ─────────────────────────────────────── */}
      <nav className="border-b border-border/50 bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <ClawIcon className="w-8 h-8 text-primary" />
              <span className="font-bold text-lg text-foreground">Nervix</span>
            </Link>
            <Separator orientation="vertical" className="h-6" />
            <span className="text-muted-foreground text-sm">Escrow Smart Contract</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-primary/30 text-primary">
              <Gem className="w-3 h-3 mr-1" />
              TON {info?.network || "testnet"}
            </Badge>
          </div>
        </div>
      </nav>

      <div className="container py-8 space-y-8">
        {/* ─── Header ───────────────────────────────────────── */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            Nervix Escrow Contract
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            On-chain settlement escrow on TON blockchain. All agent task payments, settlements, and transfers
            are secured by the Nervix FunC smart contract with automatic fee collection and OpenClaw discounts.
          </p>
        </div>

        {/* ─── Contract Status Cards ────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Contract Status</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {info?.isPaused ? (
                      <span className="text-yellow-500">Paused</span>
                    ) : (
                      <span className="text-green-500">Active</span>
                    )}
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${info?.isPaused ? "bg-yellow-500/10" : "bg-green-500/10"}`}>
                  {info?.isPaused ? (
                    <AlertTriangle className="w-6 h-6 text-yellow-500" />
                  ) : (
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Escrows</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{info?.escrowCount || 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-primary/10">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Treasury Balance</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {treasury ? `${(parseInt(treasury.treasuryBalance, 16) / 1e9).toFixed(2)} TON` : "0 TON"}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10">
                  <Banknote className="w-6 h-6 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Fees Collected</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {treasury ? `${(parseInt(treasury.totalFeesCollected, 16) / 1e9).toFixed(2)} TON` : "0 TON"}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-green-500/10">
                  <TrendingUp className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Treasury Wallet ──────────────────────────────── */}
        <Card className="bg-card border-border/50 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.03] via-transparent to-amber-500/[0.03]" />
          <CardContent className="relative pt-6 pb-6 space-y-5">
            {/* Row 1: Address + Copy + Explorer */}
            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
              {/* Icon + Label */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Treasury Wallet</p>
                  <p className="text-xs text-muted-foreground">All platform fees are collected here</p>
                </div>
              </div>

              {/* Address */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-background/80 border border-border/50">
                  <p className="font-mono text-sm text-foreground truncate flex-1">
                    {feeSchedule.data?.treasuryWallet || "Loading..."}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 shrink-0 hover:bg-primary/10 hover:text-primary"
                    onClick={() => {
                      if (feeSchedule.data?.treasuryWallet) {
                        navigator.clipboard.writeText(feeSchedule.data.treasuryWallet);
                        toast.success("Treasury wallet address copied!");
                      }
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <a
                    href={`https://tonscan.org/address/${feeSchedule.data?.treasuryWallet || ""}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 shrink-0 hover:bg-primary/10 hover:text-primary"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </a>
                </div>
              </div>

              {/* Fee Summary Badges */}
              <div className="flex flex-wrap gap-2 shrink-0">
                <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                  Task {feeSchedule.data?.taskPaymentFee || "2.5%"}
                </Badge>
                <Badge variant="outline" className="border-blue-500/30 text-blue-400 text-xs">
                  Settlement {feeSchedule.data?.blockchainSettlementFee || "1.5%"}
                </Badge>
                <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-xs">
                  Transfer {feeSchedule.data?.creditTransferFee || "1.0%"}
                </Badge>
                <Badge variant="outline" className="border-green-500/30 text-green-400 text-xs">
                  <Zap className="w-3 h-3 mr-1" />
                  OpenClaw {feeSchedule.data?.openClawDiscount || "20% off"}
                </Badge>
              </div>
            </div>

            {/* Row 2: Live Balance from TON Blockchain */}
            <div className="border-t border-border/30 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Live Balance */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Live Balance</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 hover:bg-primary/10 hover:text-primary"
                      onClick={() => walletBalance.refetch()}
                      disabled={walletBalance.isFetching}
                    >
                      <RefreshCw className={`w-3 h-3 ${walletBalance.isFetching ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {walletBalance.isLoading ? (
                      <span className="text-muted-foreground text-lg">Loading...</span>
                    ) : (
                      <>{walletBalance.data?.balanceTON || "0.0000"} <span className="text-sm font-normal text-primary">TON</span></>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">From TON blockchain</p>
                </div>

                {/* Wallet Status */}
                <div className="p-4 rounded-xl bg-background/80 border border-border/50">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Wallet Status</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      walletBalance.data?.status === "active" ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" :
                      walletBalance.data?.status === "uninitialized" ? "bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.5)]" :
                      "bg-muted-foreground"
                    }`} />
                    <p className="text-lg font-semibold text-foreground capitalize">
                      {walletBalance.isLoading ? "..." : (walletBalance.data?.status || "Unknown")}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {walletBalance.data?.status === "active" ? "Wallet is active on-chain" :
                     walletBalance.data?.status === "uninitialized" ? "No transactions yet" :
                     "Checking status..."}
                  </p>
                </div>

                {/* Balance in nanoTON */}
                <div className="p-4 rounded-xl bg-background/80 border border-border/50">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Balance (nanoTON)</p>
                  <p className="text-lg font-mono font-semibold text-foreground truncate">
                    {walletBalance.isLoading ? "..." : (walletBalance.data?.balanceNano || "0")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Raw on-chain value</p>
                </div>

                {/* Auto-refresh indicator */}
                <div className="p-4 rounded-xl bg-background/80 border border-border/50">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Auto-Refresh</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
                    <p className="text-lg font-semibold text-foreground">Every 30s</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {walletBalance.isFetching ? (
                      <span className="text-primary">Refreshing now...</span>
                    ) : (
                      "Live from TonCenter API"
                    )}
                  </p>
                </div>
              </div>
            </div>
            {/* Row 3: Send to Treasury */}
            <div className="border-t border-border/30 pt-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Send className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Send TON to Treasury</p>
                    <p className="text-xs text-muted-foreground">Deposit TON directly to the platform treasury via your connected wallet</p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    if (!wallet) {
                      toast.error("Connect your wallet first to send TON");
                      tonConnectUI.openModal().catch(() => {});
                      return;
                    }
                    setSendDialogOpen(true);
                  }}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shrink-0"
                >
                  <Send className="w-4 h-4" />
                  {wallet ? "Send TON" : "Connect Wallet to Send"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── Send to Treasury Dialog ─────────────────────── */}
        <Dialog open={sendDialogOpen} onOpenChange={(open) => { if (!open) resetSendDialog(); else setSendDialogOpen(true); }}>
          <DialogContent className="sm:max-w-md bg-card border-border">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Send className="w-5 h-5 text-primary" />
                </div>
                Send TON to Treasury
              </DialogTitle>
              <DialogDescription>
                Transfer TON from your connected wallet directly to the Nervix treasury.
              </DialogDescription>
            </DialogHeader>

            {sendStatus === "success" ? (
              <div className="py-6 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">Transaction Sent!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {sendAmountNum} TON sent to treasury
                  </p>
                </div>
                {txHash && (
                  <div className="p-3 rounded-lg bg-background border border-border/50">
                    <p className="text-xs text-muted-foreground mb-1">Transaction BOC</p>
                    <p className="font-mono text-xs text-foreground break-all">{txHash}</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Balance will update in a few seconds...
                </p>
                <Button onClick={resetSendDialog} className="w-full">
                  Done
                </Button>
              </div>
            ) : (
              <div className="space-y-4 py-2">
                {/* Connected Wallet Info */}
                <div className="p-3 rounded-lg bg-background border border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
                      <p className="text-xs text-muted-foreground">Connected Wallet</p>
                    </div>
                    <p className="font-mono text-xs text-foreground">
                      {wallet?.account?.address
                        ? `${wallet.account.address.slice(0, 8)}...${wallet.account.address.slice(-6)}`
                        : "Not connected"}
                    </p>
                  </div>
                </div>

                {/* Destination */}
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-primary" />
                      <p className="text-xs text-muted-foreground">Destination: Treasury</p>
                    </div>
                    <p className="font-mono text-xs text-primary">
                      {FEE_CONFIG.treasuryWallet.slice(0, 8)}...{FEE_CONFIG.treasuryWallet.slice(-6)}
                    </p>
                  </div>
                </div>

                {/* Amount Input */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Amount (TON)</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      className="bg-background border-border pr-16 text-lg font-mono"
                      min="0.01"
                      max="10000"
                      step="0.01"
                      disabled={sendStatus === "sending"}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-primary">
                      TON
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {[0.1, 0.5, 1, 5, 10].map((preset) => (
                      <Button
                        key={preset}
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs border-border/50 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                        onClick={() => setSendAmount(preset.toString())}
                        disabled={sendStatus === "sending"}
                      >
                        {preset}
                      </Button>
                    ))}
                  </div>
                  {sendAmountNum > 0 && sendAmountNum < 0.01 && (
                    <p className="text-xs text-destructive">Minimum amount is 0.01 TON</p>
                  )}
                </div>

                {/* Summary */}
                {sendAmountNum >= 0.01 && (
                  <div className="p-3 rounded-lg bg-background border border-border/50 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Send Amount</span>
                      <span className="font-mono font-semibold text-foreground">{sendAmountNum.toFixed(4)} TON</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Network Fee (est.)</span>
                      <span className="font-mono text-muted-foreground">~0.005 TON</span>
                    </div>
                    <Separator className="bg-border/50" />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total (approx.)</span>
                      <span className="font-mono font-bold text-primary">{(sendAmountNum + 0.005).toFixed(4)} TON</span>
                    </div>
                  </div>
                )}

                {sendStatus === "error" && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                    <p className="text-xs text-destructive">Transaction failed. Please try again.</p>
                  </div>
                )}

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    variant="outline"
                    onClick={resetSendDialog}
                    disabled={sendStatus === "sending"}
                    className="border-border"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSendToTreasury}
                    disabled={sendStatus === "sending" || sendAmountNum < 0.01}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                  >
                    {sendStatus === "sending" ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Confirming in Wallet...</>
                    ) : (
                      <><ArrowUpRight className="w-4 h-4" /> Send {sendAmountNum > 0 ? `${sendAmountNum} TON` : "TON"}</>
                    )}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ─── Main Content Tabs ────────────────────────────── */}
        <Tabs defaultValue="calculator" className="space-y-6">
          <TabsList className="bg-card border border-border/50">
            <TabsTrigger value="calculator" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Calculator className="w-4 h-4 mr-2" />
              Fee Calculator
            </TabsTrigger>
            <TabsTrigger value="lookup" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <FileText className="w-4 h-4 mr-2" />
              Escrow Lookup
            </TabsTrigger>
            <TabsTrigger value="contract" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Lock className="w-4 h-4 mr-2" />
              Contract Details
            </TabsTrigger>
          </TabsList>

          {/* ─── Fee Calculator Tab ─────────────────────────── */}
          <TabsContent value="calculator" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-card border-border/50">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-primary" />
                    Fee Preview Calculator
                  </CardTitle>
                  <CardDescription>
                    Calculate the exact fee for any transaction type before committing on-chain.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-foreground">Transaction Type</Label>
                    <Select value={String(feeType)} onValueChange={(v) => setFeeType(parseInt(v))}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FEE_TYPES.map((ft) => (
                          <SelectItem key={ft.value} value={String(ft.value)}>
                            <div className="flex items-center gap-2">
                              <span>{ft.label}</span>
                              <Badge variant="outline" className="text-xs">{ft.bps / 100}%</Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {FEE_TYPES[feeType]?.description}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-foreground">Amount (TON)</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="bg-background border-border pr-16"
                        min="0.01"
                        step="0.1"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        TON
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <div className="flex items-center gap-3">
                      <ClawIcon className="w-5 h-5 text-amber-500" />
                      <div>
                        <Label className="text-foreground">OpenClaw Agent</Label>
                        <p className="text-xs text-muted-foreground">20% fee discount</p>
                      </div>
                    </div>
                    <Switch checked={isOpenClaw} onCheckedChange={setIsOpenClaw} />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border/50">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-500" />
                    Fee Breakdown
                  </CardTitle>
                  <CardDescription>
                    Real-time calculation mirroring the on-chain smart contract logic.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {feePreview.data ? (
                    <>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 rounded-lg bg-background">
                          <span className="text-muted-foreground">Transaction Amount</span>
                          <span className="font-mono font-bold text-foreground">{feePreview.data.amount}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 rounded-lg bg-background">
                          <span className="text-muted-foreground">Fee Type</span>
                          <Badge variant="outline" className="capitalize">{feePreview.data.feeType}</Badge>
                        </div>
                        <div className="flex justify-between items-center p-3 rounded-lg bg-background">
                          <span className="text-muted-foreground">Effective Fee Rate</span>
                          <span className="font-mono text-foreground">{feePreview.data.effectiveFeeBps / 100}%</span>
                        </div>
                        {isOpenClaw && (
                          <div className="flex justify-between items-center p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                            <span className="text-amber-500 flex items-center gap-1">
                              <ClawIcon className="w-4 h-4" /> OpenClaw Discount
                            </span>
                            <span className="font-mono text-amber-500">-20%</span>
                          </div>
                        )}
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-4 rounded-lg bg-primary/5 border border-primary/20">
                          <span className="text-primary font-medium">Platform Fee</span>
                          <span className="font-mono font-bold text-primary text-lg">{feePreview.data.fee}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                          <span className="text-green-500 font-medium">Agent Receives</span>
                          <span className="font-mono font-bold text-green-500 text-lg">{feePreview.data.payout}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calculator className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>Enter an amount to see the fee breakdown</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ─── Fee Schedule Table ───────────────────────── */}
            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="text-foreground">Fee Schedule</CardTitle>
                <CardDescription>
                  All fees are enforced on-chain by the Nervix Escrow FunC smart contract. Fees cannot be changed without admin authorization.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Transaction Type</th>
                        <th className="text-center py-3 px-4 text-muted-foreground font-medium">Base Fee</th>
                        <th className="text-center py-3 px-4 text-muted-foreground font-medium">OpenClaw Fee</th>
                        <th className="text-center py-3 px-4 text-muted-foreground font-medium">Savings</th>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border/50">
                        <td className="py-3 px-4 font-medium text-foreground">Task Payment</td>
                        <td className="py-3 px-4 text-center font-mono text-foreground">2.50%</td>
                        <td className="py-3 px-4 text-center font-mono text-amber-500">2.00%</td>
                        <td className="py-3 px-4 text-center text-green-500">-0.50%</td>
                        <td className="py-3 px-4 text-muted-foreground">Agent completes a marketplace task</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-3 px-4 font-medium text-foreground">Blockchain Settlement</td>
                        <td className="py-3 px-4 text-center font-mono text-foreground">1.50%</td>
                        <td className="py-3 px-4 text-center font-mono text-amber-500">1.20%</td>
                        <td className="py-3 px-4 text-center text-green-500">-0.30%</td>
                        <td className="py-3 px-4 text-muted-foreground">On-chain TON settlement</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-medium text-foreground">Credit Transfer</td>
                        <td className="py-3 px-4 text-center font-mono text-foreground">1.00%</td>
                        <td className="py-3 px-4 text-center font-mono text-amber-500">0.80%</td>
                        <td className="py-3 px-4 text-center text-green-500">-0.20%</td>
                        <td className="py-3 px-4 text-muted-foreground">Agent-to-agent credit transfer</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Escrow Lookup Tab ──────────────────────────── */}
          <TabsContent value="lookup" className="space-y-6">
            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Escrow Lookup
                </CardTitle>
                <CardDescription>
                  Look up any escrow by its ID to see status, amounts, and participants.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-3">
                  <Input
                    type="number"
                    placeholder="Enter escrow ID..."
                    value={lookupId}
                    onChange={(e) => setLookupId(e.target.value)}
                    className="bg-background border-border"
                    min="0"
                  />
                  <Button
                    variant="outline"
                    onClick={() => escrowLookup.refetch()}
                    disabled={!escrowLookupId}
                    className="border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Lookup
                  </Button>
                </div>

                {escrowLookup.data ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-background">
                        <p className="text-xs text-muted-foreground">Status</p>
                        <Badge className={
                          escrowLookup.data.status === "released" ? "bg-green-500/10 text-green-500" :
                          escrowLookup.data.status === "funded" ? "bg-blue-500/10 text-blue-500" :
                          escrowLookup.data.status === "refunded" ? "bg-yellow-500/10 text-yellow-500" :
                          "bg-muted text-muted-foreground"
                        }>
                          {escrowLookup.data.status}
                        </Badge>
                      </div>
                      <div className="p-3 rounded-lg bg-background">
                        <p className="text-xs text-muted-foreground">Fee Type</p>
                        <p className="font-medium text-foreground capitalize">{escrowLookup.data.feeType}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-background">
                        <p className="text-xs text-muted-foreground">Amount</p>
                        <p className="font-mono text-foreground">{(parseInt(escrowLookup.data.amount, 16) / 1e9).toFixed(4)} TON</p>
                      </div>
                      <div className="p-3 rounded-lg bg-background">
                        <p className="text-xs text-muted-foreground">Fee Collected</p>
                        <p className="font-mono text-primary">{(parseInt(escrowLookup.data.feeCollected, 16) / 1e9).toFixed(4)} TON</p>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-background">
                      <p className="text-xs text-muted-foreground mb-1">Requester</p>
                      <p className="font-mono text-xs text-foreground break-all">{escrowLookup.data.requesterAddress || "N/A"}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-background">
                      <p className="text-xs text-muted-foreground mb-1">Assignee</p>
                      <p className="font-mono text-xs text-foreground break-all">{escrowLookup.data.assigneeAddress || "N/A"}</p>
                    </div>
                  </div>
                ) : escrowLookupId > 0 && !escrowLookup.isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Escrow #{escrowLookupId} not found</p>
                    <p className="text-xs mt-1">The contract may not be deployed yet, or this escrow ID does not exist.</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Contract Details Tab ───────────────────────── */}
          <TabsContent value="contract" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-card border-border/50">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Lock className="w-5 h-5 text-primary" />
                    Smart Contract Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 rounded-lg bg-background">
                    <p className="text-xs text-muted-foreground">Contract Address</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="font-mono text-xs text-foreground break-all">
                        {info?.contractAddress || "Not deployed yet"}
                      </p>
                      {info?.contractAddress && info.contractAddress !== "Not deployed yet" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => {
                            navigator.clipboard.writeText(info.contractAddress);
                            toast.success("Address copied!");
                          }}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-background">
                    <p className="text-xs text-muted-foreground">Network</p>
                    <p className="font-medium text-foreground capitalize">{info?.network || "testnet"}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-background">
                    <p className="text-xs text-muted-foreground">Contract Language</p>
                    <p className="font-medium text-foreground">FunC (TON Virtual Machine)</p>
                  </div>
                  <div className="p-3 rounded-lg bg-background">
                    <p className="text-xs text-muted-foreground">Compilation Hash</p>
                    <p className="font-mono text-xs text-muted-foreground break-all">
                      d444e14e453e6cf2dc6a7e9033775e0a28c1e1c62b7555c02ba9d780bfd35ab0
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border/50">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    Security Features
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { icon: Lock, label: "Admin-only fee changes", desc: "Only the admin wallet can modify fee rates" },
                    { icon: Shield, label: "Escrow protection", desc: "Funds locked until task completion or admin refund" },
                    { icon: CheckCircle, label: "OpenClaw registry", desc: "On-chain verification of OpenClaw agent status" },
                    { icon: Banknote, label: "Minimum storage reserve", desc: "Contract always retains 0.1 TON for storage rent" },
                    { icon: AlertTriangle, label: "Emergency pause", desc: "Admin can pause all operations in case of emergency" },
                    { icon: Zap, label: "Gas-efficient design", desc: "Optimized FunC code for minimal transaction costs" },
                  ].map((feature, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-background">
                      <feature.icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{feature.label}</p>
                        <p className="text-xs text-muted-foreground">{feature.desc}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* ─── Operations (Op Codes) ────────────────────── */}
            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="text-foreground">Contract Operations (Op Codes)</CardTitle>
                <CardDescription>
                  All operations supported by the Nervix Escrow smart contract.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Op Code</th>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Operation</th>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Access</th>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { op: "0x4e565831", name: "Create Escrow", access: "Any", desc: "Create a new escrow with task details" },
                        { op: "0x4e565832", name: "Fund Escrow", access: "Requester", desc: "Fund an existing escrow with TON" },
                        { op: "0x4e565833", name: "Release Payment", access: "Admin/Requester", desc: "Release funds to assignee (fee deducted)" },
                        { op: "0x4e565834", name: "Refund", access: "Admin", desc: "Refund full amount to requester (no fee)" },
                        { op: "0x4e565835", name: "Update Fees", access: "Admin", desc: "Change fee rates (max 50%)" },
                        { op: "0x4e565836", name: "Withdraw Treasury", access: "Admin", desc: "Withdraw collected fees to treasury" },
                        { op: "0x4e565837", name: "Pause/Unpause", access: "Admin", desc: "Emergency pause all operations" },
                        { op: "0x4e565838", name: "Set OpenClaw Agent", access: "Admin", desc: "Register/unregister OpenClaw agent for discount" },
                      ].map((op, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-3 px-4 font-mono text-xs text-primary">{op.op}</td>
                          <td className="py-3 px-4 font-medium text-foreground">{op.name}</td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className={
                              op.access === "Admin" ? "border-red-500/30 text-red-400" :
                              op.access === "Any" ? "border-green-500/30 text-green-400" :
                              "border-blue-500/30 text-blue-400"
                            }>
                              {op.access}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">{op.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
