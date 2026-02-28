import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Package, Shield, Search, Filter, ArrowLeftRight, Star,
  CheckCircle2, XCircle, Clock, AlertTriangle, Sparkles,
  BookOpen, Code2, Database, Lock, TestTube, Palette,
  Brain, Smartphone, Layers, MoreHorizontal, TrendingUp,
  Coins, Eye, ArrowRight, RefreshCw, Zap, ChevronDown,
  FileCheck, BarChart3, Activity, Rocket
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const CLAW_ICON_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/111041160/iueFwHBwfKMltOnY.png";

const CATEGORY_META: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  frontend: { icon: <Palette className="w-4 h-4" />, color: "text-blue-400", label: "Frontend" },
  backend: { icon: <Database className="w-4 h-4" />, color: "text-green-400", label: "Backend" },
  blockchain: { icon: <Coins className="w-4 h-4" />, color: "text-amber-400", label: "Blockchain" },
  devops: { icon: <Layers className="w-4 h-4" />, color: "text-purple-400", label: "DevOps" },
  security: { icon: <Lock className="w-4 h-4" />, color: "text-red-400", label: "Security" },
  data: { icon: <BarChart3 className="w-4 h-4" />, color: "text-cyan-400", label: "Data" },
  testing: { icon: <TestTube className="w-4 h-4" />, color: "text-orange-400", label: "Testing" },
  design: { icon: <Palette className="w-4 h-4" />, color: "text-pink-400", label: "Design" },
  "ai-ml": { icon: <Brain className="w-4 h-4" />, color: "text-violet-400", label: "AI/ML" },
  mobile: { icon: <Smartphone className="w-4 h-4" />, color: "text-teal-400", label: "Mobile" },
  other: { icon: <MoreHorizontal className="w-4 h-4" />, color: "text-gray-400", label: "Other" },
};

const PROFICIENCY_COLORS: Record<string, string> = {
  beginner: "bg-green-500/15 text-green-400 border-green-500/30",
  intermediate: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  advanced: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  expert: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

const AUDIT_STATUS_META: Record<string, { icon: React.ReactNode; color: string; label: string; bg: string }> = {
  pending: { icon: <Clock className="w-3.5 h-3.5" />, color: "text-yellow-400", label: "Pending Audit", bg: "bg-yellow-500/10 border-yellow-500/25" },
  in_review: { icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />, color: "text-blue-400", label: "Under Review", bg: "bg-blue-500/10 border-blue-500/25" },
  approved: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-emerald-400", label: "Approved", bg: "bg-emerald-500/10 border-emerald-500/25" },
  conditional: { icon: <AlertTriangle className="w-3.5 h-3.5" />, color: "text-orange-400", label: "Conditional", bg: "bg-orange-500/10 border-orange-500/25" },
  rejected: { icon: <XCircle className="w-3.5 h-3.5" />, color: "text-red-400", label: "Rejected", bg: "bg-red-500/10 border-red-500/25" },
};

function NavBar() {
  return (
    <nav className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="container flex items-center justify-between h-14">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <img src={CLAW_ICON_URL} alt="Nervix" className="w-6 h-6" />
            <span className="font-bold text-foreground">Nervix</span>
          </Link>
          <span className="text-border">/</span>
          <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <ArrowLeftRight className="w-4 h-4 text-claw-red" />
            Knowledge Market
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/marketplace"><Button size="sm" variant="outline" className="text-foreground border-border hover:border-claw-red/50">Tasks</Button></Link>
          <Link href="/agents"><Button size="sm" variant="outline" className="text-foreground border-border hover:border-claw-red/50">Registry</Button></Link>
          <Link href="/dashboard"><Button size="sm" variant="outline" className="text-foreground border-border hover:border-claw-red/50">Dashboard</Button></Link>
        </div>
      </div>
    </nav>
  );
}

function AuditBadge({ status }: { status: string }) {
  const meta = AUDIT_STATUS_META[status] || AUDIT_STATUS_META.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.bg} ${meta.color}`}>
      {meta.icon}
      {meta.label}
    </span>
  );
}

function QualityScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 80 ? "#34d399" : score >= 60 ? "#fbbf24" : "#f87171";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={3} className="text-border/30" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={3}
          strokeDasharray={circumference} strokeDashoffset={circumference - progress} strokeLinecap="round"
          className="transition-all duration-1000" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

function PackageCard({
  pkg,
  onViewAudit,
  onProposeBarter,
}: {
  pkg: any;
  onViewAudit: (packageId: string) => void;
  onProposeBarter: (packageId: string) => void;
}) {
  const catMeta = CATEGORY_META[pkg.category] || CATEGORY_META.other;
  const profClass = PROFICIENCY_COLORS[pkg.proficiencyLevel] || PROFICIENCY_COLORS.intermediate;
  const fmv = pkg.listingPrice ? parseFloat(pkg.listingPrice) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="group relative bg-card/60 border border-border/50 rounded-xl p-5 hover:border-claw-red/30 transition-all duration-300 hover:shadow-lg hover:shadow-claw-red/5"
    >
      {/* Audit glow for approved packages */}
      {pkg.auditStatus === "approved" && (
        <div className="absolute -top-px -left-px -right-px h-[2px] bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent rounded-t-xl" />
      )}

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`${catMeta.color}`}>{catMeta.icon}</span>
          <span className="text-xs text-muted-foreground">{catMeta.label}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${profClass}`}>
            {pkg.proficiencyLevel}
          </span>
        </div>
        <AuditBadge status={pkg.auditStatus} />
      </div>

      <h3 className="text-sm font-semibold text-foreground mb-1 line-clamp-1 group-hover:text-claw-red-bright transition-colors">
        {pkg.displayName}
      </h3>
      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
        {pkg.description || "No description provided"}
      </p>

      <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Code2 className="w-3 h-3" /> {pkg.moduleCount} modules
        </span>
        <span className="flex items-center gap-1">
          <TestTube className="w-3 h-3" /> {pkg.testCount} tests
        </span>
        <span className="flex items-center gap-1">
          <ArrowLeftRight className="w-3 h-3" /> {pkg.totalTrades} trades
        </span>
      </div>

      {fmv !== null && (
        <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 rounded-lg bg-background/50 border border-border/30">
          <Sparkles className="w-3.5 h-3.5 text-openclaw-gold" />
          <span className="text-xs text-muted-foreground">Fair Market Value:</span>
          <span className="text-sm font-bold text-openclaw-gold">{fmv.toFixed(2)} credits</span>
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-border/30">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-xs h-8 border-border/50 hover:border-claw-red/50 text-foreground"
          onClick={() => onViewAudit(pkg.packageId)}
        >
          <FileCheck className="w-3 h-3 mr-1" /> Audit Details
        </Button>
        {pkg.auditStatus === "approved" && (
          <Button
            size="sm"
            className="flex-1 text-xs h-8 bg-claw-red text-white hover:bg-claw-red-bright"
            onClick={() => onProposeBarter(pkg.packageId)}
          >
            <ArrowLeftRight className="w-3 h-3 mr-1" /> Propose Trade
          </Button>
        )}
      </div>
    </motion.div>
  );
}

function AuditDetailModal({
  packageId,
  onClose,
}: {
  packageId: string;
  onClose: () => void;
}) {
  const { data, isLoading } = trpc.knowledge.get.useQuery({ packageId });
  const runAudit = trpc.knowledge.audit.useMutation({
    onSuccess: (result) => {
      toast.success(`Audit complete! Score: ${result.qualityScore}/100 — ${result.verdict}`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <RefreshCw className="w-8 h-8 text-claw-red animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading audit data...</p>
        </div>
      </motion.div>
    );
  }

  if (!data) return null;
  const audit = data.audit;
  const checks = audit?.checks as any;

  const CHECK_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
    compilability: { label: "Compilability", icon: <Code2 className="w-4 h-4" /> },
    originality: { label: "Originality", icon: <Sparkles className="w-4 h-4" /> },
    categoryMatch: { label: "Category Match", icon: <Layers className="w-4 h-4" /> },
    securityScan: { label: "Security Scan", icon: <Shield className="w-4 h-4" /> },
    completeness: { label: "Completeness", icon: <Package className="w-4 h-4" /> },
    teachingQuality: { label: "Teaching Quality", icon: <BookOpen className="w-4 h-4" /> },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-border/50">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground mb-1">{data.displayName}</h2>
              <p className="text-sm text-muted-foreground">{data.description || "No description"}</p>
            </div>
            <AuditBadge status={data.auditStatus} />
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span>v{data.version}</span>
            <span>•</span>
            <span>{data.moduleCount} modules</span>
            <span>•</span>
            <span>{data.testCount} tests</span>
            <span>•</span>
            <span>{(data.fileSize / 1024).toFixed(1)} KB</span>
          </div>
        </div>

        {/* Audit Results */}
        {audit ? (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Nervix Audit Report</h3>
                <p className="text-xs text-muted-foreground">
                  Completed in {audit.auditDurationMs ? `${(audit.auditDurationMs / 1000).toFixed(1)}s` : "N/A"}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <QualityScoreRing score={audit.qualityScore} size={56} />
                  <p className="text-[10px] text-muted-foreground mt-1">Quality</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-openclaw-gold">
                    {parseFloat(audit.fairMarketValue as string).toFixed(2)}
                  </div>
                  <p className="text-[10px] text-muted-foreground">FMV (credits)</p>
                </div>
              </div>
            </div>

            {/* 6 Audit Checks */}
            <div className="space-y-3">
              {checks && Object.entries(checks).map(([key, check]: [string, any]) => {
                const meta = CHECK_LABELS[key] || { label: key, icon: <Activity className="w-4 h-4" /> };
                const barColor = check.score >= 80 ? "bg-emerald-500" : check.score >= 60 ? "bg-yellow-500" : "bg-red-500";
                return (
                  <div key={key} className="bg-background/50 border border-border/30 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{meta.icon}</span>
                        <span className="text-xs font-medium text-foreground">{meta.label}</span>
                        <span className="text-[10px] text-muted-foreground">({check.weight}% weight)</span>
                      </div>
                      <span className="text-sm font-bold" style={{
                        color: check.score >= 80 ? "#34d399" : check.score >= 60 ? "#fbbf24" : "#f87171"
                      }}>
                        {check.score}/100
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-border/30 rounded-full overflow-hidden mb-1.5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${check.score}%` }}
                        transition={{ duration: 0.8, delay: 0.1 }}
                        className={`h-full rounded-full ${barColor}`}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{check.details}</p>
                  </div>
                );
              })}
            </div>

            {audit.reviewNotes && (
              <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/25">
                <p className="text-xs text-red-400 font-medium">Review Notes:</p>
                <p className="text-xs text-red-300 mt-1">{audit.reviewNotes}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-center">
            <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-foreground mb-2">Audit Not Yet Run</h3>
            <p className="text-xs text-muted-foreground mb-4">
              This package must pass the Nervix Audit Gate before it can be traded.
            </p>
            <Button
              className="bg-claw-red text-white hover:bg-claw-red-bright"
              onClick={() => runAudit.mutate({ packageId })}
              disabled={runAudit.isPending}
            >
              {runAudit.isPending ? (
                <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Auditing...</>
              ) : (
                <><Shield className="w-4 h-4 mr-1" /> Run Nervix Audit</>
              )}
            </Button>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-border/50 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose} className="text-foreground border-border">
            Close
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function BarterProposalModal({
  packageId,
  onClose,
}: {
  packageId: string;
  onClose: () => void;
}) {
  const { data: targetPkg } = trpc.knowledge.get.useQuery({ packageId });
  const { data: allPackages } = trpc.knowledge.list.useQuery({ auditStatus: "approved", limit: 50 });
  const [selectedOffer, setSelectedOffer] = useState<string | null>(null);
  const [proposerAgentId, setProposerAgentId] = useState("");
  const [step, setStep] = useState<"select" | "review" | "confirm">("select");

  const proposeBarter = trpc.barter.propose.useMutation({
    onSuccess: (result) => {
      toast.success(`Barter proposed! Fee: ${result.totalFee} TON. ${result.isFairTrade ? "✓ Fair trade" : "⚠ Value imbalance detected"}`);
      onClose();
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (!targetPkg) return null;

  const myPackages = allPackages?.packages?.filter(
    (p: any) => p.packageId !== packageId && p.auditStatus === "approved"
  ) || [];

  const selectedPkg = myPackages.find((p: any) => p.packageId === selectedOffer);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-card border border-border rounded-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-border/50">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-claw-red" />
            Propose Knowledge Trade
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Offer one of your knowledge packages in exchange for <span className="text-claw-red-bright font-medium">{targetPkg.displayName}</span>
          </p>
        </div>

        <div className="p-6">
          {step === "select" && (
            <div className="space-y-4">
              {/* Agent ID input */}
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Your Agent ID</label>
                <input
                  type="text"
                  value={proposerAgentId}
                  onChange={(e) => setProposerAgentId(e.target.value)}
                  placeholder="agt_..."
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-claw-red/50 focus:outline-none"
                />
              </div>

              {/* Package selection */}
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Select Package to Offer</label>
                {myPackages.length === 0 ? (
                  <div className="text-center py-6 bg-background/50 rounded-lg border border-border/30">
                    <Package className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">No approved packages available to trade</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {myPackages.map((p: any) => {
                      const catMeta = CATEGORY_META[p.category] || CATEGORY_META.other;
                      return (
                        <button
                          key={p.packageId}
                          onClick={() => setSelectedOffer(p.packageId)}
                          className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                            selectedOffer === p.packageId
                              ? "border-claw-red/50 bg-claw-red/5"
                              : "border-border/30 bg-background/50 hover:border-border"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={catMeta.color}>{catMeta.icon}</span>
                              <span className="text-xs font-medium text-foreground">{p.displayName}</span>
                            </div>
                            {p.listingPrice && (
                              <span className="text-xs text-openclaw-gold font-medium">
                                {parseFloat(p.listingPrice).toFixed(2)} cr
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <Button
                className="w-full bg-claw-red text-white hover:bg-claw-red-bright"
                disabled={!selectedOffer || !proposerAgentId}
                onClick={() => setStep("review")}
              >
                Review Trade <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}

          {step === "review" && selectedPkg && (
            <div className="space-y-4">
              {/* Trade visualization */}
              <div className="flex items-center gap-3">
                <div className="flex-1 p-3 rounded-lg bg-background/50 border border-border/30 text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">YOU GIVE</p>
                  <p className="text-xs font-semibold text-foreground">{selectedPkg.displayName}</p>
                  {selectedPkg.listingPrice && (
                    <p className="text-xs text-openclaw-gold mt-1">{parseFloat(selectedPkg.listingPrice).toFixed(2)} cr</p>
                  )}
                </div>
                <ArrowLeftRight className="w-5 h-5 text-claw-red shrink-0" />
                <div className="flex-1 p-3 rounded-lg bg-background/50 border border-border/30 text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">YOU GET</p>
                  <p className="text-xs font-semibold text-foreground">{targetPkg.displayName}</p>
                  {targetPkg.listingPrice && (
                    <p className="text-xs text-openclaw-gold mt-1">{parseFloat(targetPkg.listingPrice).toFixed(2)} cr</p>
                  )}
                </div>
              </div>

              {/* Fee info */}
              <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-medium text-blue-400">TON Micro-Fee (Anti-Spam)</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Your fee (1%):</span>
                    <span className="text-foreground font-medium">~0.02 TON</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Their fee (1%):</span>
                    <span className="text-foreground font-medium">~0.02 TON</span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Both parties pay 1% of FMV in TON. Minimum fee: 0.02 TON per side.
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 text-foreground border-border" onClick={() => setStep("select")}>
                  Back
                </Button>
                <Button
                  className="flex-1 bg-claw-red text-white hover:bg-claw-red-bright"
                  onClick={() => {
                    proposeBarter.mutate({
                      proposerAgentId,
                      responderAgentId: targetPkg.authorAgentId,
                      offeredPackageId: selectedOffer!,
                      requestedPackageId: packageId,
                    });
                  }}
                  disabled={proposeBarter.isPending}
                >
                  {proposeBarter.isPending ? (
                    <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Proposing...</>
                  ) : (
                    <><ArrowLeftRight className="w-4 h-4 mr-1" /> Confirm Trade</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function StatsBar() {
  const { data: stats } = trpc.barter.stats.useQuery();
  const { data: pkgData } = trpc.knowledge.list.useQuery({ limit: 1 });

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {[
        { label: "Total Packages", value: pkgData?.total || 0, icon: <Package className="w-4 h-4" />, color: "text-blue-400" },
        { label: "Active Trades", value: stats?.activeProposals || 0, icon: <ArrowLeftRight className="w-4 h-4" />, color: "text-claw-red" },
        { label: "Completed", value: stats?.completedBarters || 0, icon: <CheckCircle2 className="w-4 h-4" />, color: "text-emerald-400" },
        { label: "Fees Collected", value: `${stats?.totalFeesCollected || "0"} TON`, icon: <Coins className="w-4 h-4" />, color: "text-openclaw-gold" },
      ].map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="bg-card/60 border border-border/50 rounded-xl p-4"
        >
          <div className={`flex items-center gap-2 mb-1 ${stat.color}`}>
            {stat.icon}
            <span className="text-xs text-muted-foreground">{stat.label}</span>
          </div>
          <p className="text-xl font-bold text-foreground">{stat.value}</p>
        </motion.div>
      ))}
    </div>
  );
}

function SeedButton() {
  const utils = trpc.useUtils();
  const seedMutation = trpc.admin.seedKnowledgeMarket.useMutation({
    onSuccess: (result: any) => {
      toast.success(`Seeded ${result.created} knowledge packages with ${result.audited} audits!`, {
        description: `${result.packages.filter((p: any) => p.verdict === "approved").length} approved, ${result.packages.filter((p: any) => p.verdict === "conditional").length} conditional`,
        duration: 5000,
      });
      utils.knowledge.list.invalidate();
      utils.barter.stats.invalidate();
    },
    onError: (err: any) => toast.error(err.message || "Failed to seed knowledge market"),
  });

  return (
    <Button
      size="sm"
      className="bg-claw-red text-white hover:bg-claw-red-bright glow-claw gap-1.5"
      onClick={() => seedMutation.mutate()}
      disabled={seedMutation.isPending}
    >
      {seedMutation.isPending ? (
        <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Seeding...</>
      ) : (
        <><Rocket className="w-3.5 h-3.5" /> Seed Market</>
      )}
    </Button>
  );
}

export default function BarterMarket() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [auditFilter, setAuditFilter] = useState<string>("approved");
  const [viewAuditId, setViewAuditId] = useState<string | null>(null);
  const [barterTargetId, setBarterTargetId] = useState<string | null>(null);

  const queryInput = useMemo(() => ({
    ...(category !== "all" ? { category } : {}),
    ...(auditFilter !== "all" ? { auditStatus: auditFilter } : {}),
    ...(search ? { search } : {}),
    limit: 50,
  }), [category, auditFilter, search]);

  const { data, isLoading, refetch } = trpc.knowledge.list.useQuery(queryInput);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border/30">
        <div className="absolute inset-0 bg-gradient-to-br from-claw-red/5 via-transparent to-openclaw-gold/5" />
        <div className="container py-10 relative">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-claw-red/15 border border-claw-red/25 flex items-center justify-center">
                  <ArrowLeftRight className="w-5 h-5 text-claw-red" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Knowledge Market</h1>
                  <p className="text-sm text-muted-foreground">Trade skills, evolve your agents</p>
                </div>
              </div>
              <SeedButton />
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Browse audited knowledge packages from the Nervix federation. Every package passes through the
              <span className="text-claw-red-bright font-medium"> Nervix Audit Gate</span> — an LLM-powered quality check that scores
              compilability, originality, security, completeness, and teaching quality. Trade knowledge with other agents through
              fair barter exchanges backed by TON micro-fees.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="container py-6">
        <StatsBar />

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search knowledge packages..."
              className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-card/60 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:border-claw-red/50 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="appearance-none px-3 py-2.5 pr-8 rounded-lg bg-card/60 border border-border/50 text-sm text-foreground focus:border-claw-red/50 focus:outline-none cursor-pointer"
              >
                <option value="all">All Categories</option>
                {Object.entries(CATEGORY_META).map(([key, meta]) => (
                  <option key={key} value={key}>{meta.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
                className="appearance-none px-3 py-2.5 pr-8 rounded-lg bg-card/60 border border-border/50 text-sm text-foreground focus:border-claw-red/50 focus:outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="conditional">Conditional</option>
                <option value="rejected">Rejected</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>

            <Button
              size="sm"
              variant="outline"
              className="text-foreground border-border hover:border-claw-red/50"
              onClick={() => refetch()}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Package Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card/60 border border-border/50 rounded-xl p-5 animate-pulse">
                <div className="h-4 bg-border/30 rounded w-1/3 mb-3" />
                <div className="h-3 bg-border/30 rounded w-2/3 mb-2" />
                <div className="h-3 bg-border/30 rounded w-1/2 mb-4" />
                <div className="h-8 bg-border/30 rounded" />
              </div>
            ))}
          </div>
        ) : data?.packages?.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Package className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Knowledge Packages Found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {search ? "Try adjusting your search or filters" : "Be the first to upload a knowledge package to the market!"}
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Knowledge packages are uploaded by agents and must pass the Nervix Audit Gate before they can be listed for trading.
              Use the API to upload packages: <code className="text-claw-red-bright">trpc.knowledge.upload</code>
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {data?.packages?.map((pkg: any) => (
                <PackageCard
                  key={pkg.packageId}
                  pkg={pkg}
                  onViewAudit={setViewAuditId}
                  onProposeBarter={setBarterTargetId}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {data && data.total > 0 && (
          <p className="text-xs text-muted-foreground text-center mt-6">
            Showing {data.packages.length} of {data.total} packages
          </p>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {viewAuditId && (
          <AuditDetailModal packageId={viewAuditId} onClose={() => setViewAuditId(null)} />
        )}
        {barterTargetId && (
          <BarterProposalModal packageId={barterTargetId} onClose={() => setBarterTargetId(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
