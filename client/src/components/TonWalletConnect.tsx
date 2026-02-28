import { TonConnectButton, useTonAddress, useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, ExternalLink, Copy, Check, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { useState } from "react";

/** Shorten a TON address for display */
function shortenAddress(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/** TON Connect Wallet Button — wraps the official TonConnectButton with Nervix styling */
export function NervixTonButton() {
  return (
    <div className="ton-connect-wrapper">
      <TonConnectButton />
    </div>
  );
}

/** Full wallet panel showing balance, address, and quick actions */
export function TonWalletPanel() {
  const wallet = useTonWallet();
  const userAddress = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (userAddress) {
      navigator.clipboard.writeText(userAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!wallet) {
    return (
      <Card className="border-red-500/30 bg-black/40 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Wallet className="h-4 w-4 text-red-400" />
            TON Wallet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Connect your Telegram Wallet or Tonkeeper to enable on-chain payments
          </p>
          <TonConnectButton />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-red-500/30 bg-black/40 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Wallet className="h-4 w-4 text-green-400" />
          TON Wallet
          <Badge variant="outline" className="text-green-400 border-green-500/30 text-[10px]">
            Connected
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Address */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Address</span>
          <div className="flex items-center gap-1">
            <code className="text-xs font-mono text-foreground">{shortenAddress(userAddress)}</code>
            <button onClick={handleCopy} className="p-1 hover:bg-white/10 rounded transition-colors">
              {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
            </button>
            <a
              href={`https://tonscan.org/address/${userAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 hover:bg-white/10 rounded transition-colors"
            >
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>
          </div>
        </div>

        {/* Network */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Network</span>
          <Badge variant="outline" className="text-blue-400 border-blue-500/30 text-[10px]">
            TON Mainnet
          </Badge>
        </div>

        {/* Wallet App */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Wallet</span>
          <span className="text-xs text-foreground">{wallet.device.appName}</span>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
            onClick={() => {/* deposit flow */}}
          >
            <ArrowDownLeft className="h-3 w-3 mr-1" />
            Deposit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
            onClick={() => {/* withdraw flow */}}
          >
            <ArrowUpRight className="h-3 w-3 mr-1" />
            Withdraw
          </Button>
        </div>

        {/* Disconnect */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground hover:text-red-400"
          onClick={() => tonConnectUI.disconnect()}
        >
          Disconnect Wallet
        </Button>
      </CardContent>
    </Card>
  );
}

/** Compact wallet indicator for navigation bars */
export function TonWalletIndicator() {
  const wallet = useTonWallet();
  const userAddress = useTonAddress();

  if (!wallet) {
    return (
      <div className="ton-connect-wrapper">
        <TonConnectButton />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
      <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
      <span className="text-xs font-mono text-green-400">{shortenAddress(userAddress)}</span>
    </div>
  );
}
