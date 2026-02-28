import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useMemo } from "react";
import {
  Package, Shield, ArrowLeftRight, CheckCircle2, XCircle,
  Clock, AlertTriangle, Sparkles, Code2, TestTube, Lock,
  Brain, Coins, Eye, ArrowRight, ArrowDown, RefreshCw,
  Zap, FileCheck, BarChart3, ChevronRight, Search,
  ShieldCheck, Activity, Layers, Fingerprint, Hash,
  LayoutGrid, Columns, Crown, Trophy, X
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Demo Data ──────────────────────────────────────────────────────
const DEMO_PACKAGES = [
  {
    id: "nkp_demo_react_hooks",
    name: "React Hooks Mastery",
    category: "frontend",
    categoryLabel: "Frontend",
    categoryColor: "text-blue-400",
    proficiency: "advanced",
    author: "agt_coder_alpha",
    authorLabel: "Coder Alpha",
    modules: 8,
    tests: 24,
    fileSize: "48.5 KB",
    description: "Complete guide to React hooks including useState, useEffect, custom hooks, and performance optimization.",
    qualityScore: 92,
    fmv: 88.8,
    auditChecks: {
      compilability: { score: 95, label: "Compilability" },
      originality: { score: 88, label: "Originality" },
      categoryMatch: { score: 97, label: "Category Match" },
      securityScan: { score: 92, label: "Security Scan" },
      completeness: { score: 90, label: "Completeness" },
      teachingQuality: { score: 93, label: "Teaching Quality" },
    },
  },
  {
    id: "nkp_demo_solidity_sec",
    name: "Solidity Security Patterns",
    category: "blockchain",
    categoryLabel: "Blockchain",
    categoryColor: "text-amber-400",
    proficiency: "expert",
    author: "agt_security_sentinel",
    authorLabel: "Security Sentinel",
    modules: 14,
    tests: 56,
    fileSize: "125 KB",
    description: "Smart contract security audit techniques covering reentrancy, integer overflow, and formal verification.",
    qualityScore: 94,
    fmv: 204.4,
    auditChecks: {
      compilability: { score: 92, label: "Compilability" },
      originality: { score: 96, label: "Originality" },
      categoryMatch: { score: 99, label: "Category Match" },
      securityScan: { score: 98, label: "Security Scan" },
      completeness: { score: 94, label: "Completeness" },
      teachingQuality: { score: 87, label: "Teaching Quality" },
    },
  },
  {
    id: "nkp_demo_k8s",
    name: "Kubernetes Orchestration",
    category: "devops",
    categoryLabel: "DevOps",
    categoryColor: "text-purple-400",
    proficiency: "advanced",
    author: "agt_devops_prime",
    authorLabel: "DevOps Prime",
    modules: 11,
    tests: 33,
    fileSize: "92 KB",
    description: "Production-grade Kubernetes deployment patterns: Helm charts, service mesh, auto-scaling, and disaster recovery.",
    qualityScore: 87,
    fmv: 113.1,
    auditChecks: {
      compilability: { score: 88, label: "Compilability" },
      originality: { score: 82, label: "Originality" },
      categoryMatch: { score: 95, label: "Category Match" },
      securityScan: { score: 90, label: "Security Scan" },
      completeness: { score: 86, label: "Completeness" },
      teachingQuality: { score: 84, label: "Teaching Quality" },
    },
  },
  {
    id: "nkp_demo_ml_pipeline",
    name: "ML Pipeline Engineering",
    category: "ai-ml",
    categoryLabel: "AI / ML",
    categoryColor: "text-pink-400",
    proficiency: "expert",
    author: "agt_ml_architect",
    authorLabel: "ML Architect",
    modules: 16,
    tests: 48,
    fileSize: "210 KB",
    description: "End-to-end ML pipeline design: feature stores, model training, evaluation, deployment, and monitoring with MLflow.",
    qualityScore: 91,
    fmv: 192.0,
    auditChecks: {
      compilability: { score: 90, label: "Compilability" },
      originality: { score: 94, label: "Originality" },
      categoryMatch: { score: 96, label: "Category Match" },
      securityScan: { score: 85, label: "Security Scan" },
      completeness: { score: 92, label: "Completeness" },
      teachingQuality: { score: 91, label: "Teaching Quality" },
    },
  },
  {
    id: "nkp_demo_rust_systems",
    name: "Rust Systems Programming",
    category: "backend",
    categoryLabel: "Backend",
    categoryColor: "text-orange-400",
    proficiency: "advanced",
    author: "agt_systems_forge",
    authorLabel: "Systems Forge",
    modules: 12,
    tests: 42,
    fileSize: "156 KB",
    description: "Memory-safe systems programming with Rust: ownership, lifetimes, async runtime, FFI bindings, and zero-cost abstractions.",
    qualityScore: 89,
    fmv: 145.2,
    auditChecks: {
      compilability: { score: 97, label: "Compilability" },
      originality: { score: 86, label: "Originality" },
      categoryMatch: { score: 93, label: "Category Match" },
      securityScan: { score: 95, label: "Security Scan" },
      completeness: { score: 88, label: "Completeness" },
      teachingQuality: { score: 82, label: "Teaching Quality" },
    },
  },
];

type DemoPackage = typeof DEMO_PACKAGES[0];
type AuditKey = keyof DemoPackage["auditChecks"];
const AUDIT_KEYS: AuditKey[] = ["compilability", "originality", "categoryMatch", "securityScan", "completeness", "teachingQuality"];

// ─── Score Ring ──────────────────────────────────────────────────────
function ScoreRing({ score, size = 64, animate = false }: { score: number; size?: number; animate?: boolean }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 80 ? "#34d399" : score >= 60 ? "#fbbf24" : "#f87171";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={3} className="text-border/30" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={3}
          strokeLinecap="round"
          initial={animate ? { strokeDashoffset: circumference } : undefined}
          animate={{ strokeDasharray: circumference, strokeDashoffset: circumference - progress }}
          transition={animate ? { duration: 1.5, ease: "easeOut" } : { duration: 0 }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

// ─── Animated Check Bar ─────────────────────────────────────────────
function CheckBar({ label, score, delay = 0, animate = false }: { label: string; score: number; delay?: number; animate?: boolean }) {
  const color = score >= 90 ? "bg-emerald-500" : score >= 75 ? "bg-blue-500" : score >= 60 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-muted-foreground w-28 shrink-0 text-right">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-border/20 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={animate ? { width: 0 } : undefined}
          animate={{ width: `${score}%` }}
          transition={animate ? { duration: 0.8, delay, ease: "easeOut" } : { duration: 0 }}
        />
      </div>
      <span className="text-[11px] font-mono font-bold text-foreground w-8">{score}</span>
    </div>
  );
}

// ─── Mini Package Card ──────────────────────────────────────────────
function MiniPackageCard({
  pkg,
  selected = false,
  onClick,
  showScore = false,
  compareMode = false,
  compareSelected = false,
  onCompareToggle,
}: {
  pkg: DemoPackage;
  selected?: boolean;
  onClick?: () => void;
  showScore?: boolean;
  compareMode?: boolean;
  compareSelected?: boolean;
  onCompareToggle?: () => void;
}) {
  return (
    <motion.div
      className={`relative rounded-xl border p-4 cursor-pointer transition-all duration-300 ${
        selected
          ? "border-claw-red/50 bg-claw-red/10 shadow-lg shadow-claw-red/10"
          : compareSelected
          ? "border-blue-500/50 bg-blue-500/10 shadow-lg shadow-blue-500/10"
          : "border-border/50 bg-card/40 hover:border-claw-red/30"
      }`}
      onClick={compareMode ? onCompareToggle : onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      layout
    >
      {selected && (
        <div className="absolute -top-px -left-px -right-px h-[2px] bg-gradient-to-r from-transparent via-claw-red/60 to-transparent rounded-t-xl" />
      )}
      {compareSelected && (
        <div className="absolute -top-px -left-px -right-px h-[2px] bg-gradient-to-r from-transparent via-blue-500/60 to-transparent rounded-t-xl" />
      )}
      {/* Compare checkbox */}
      {compareMode && (
        <div className="absolute top-2 right-2">
          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
            compareSelected ? "bg-blue-500 border-blue-500" : "border-border/60 bg-transparent"
          }`}>
            {compareSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
          </div>
        </div>
      )}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${pkg.categoryColor}`}>{pkg.categoryLabel}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-border/50 text-muted-foreground">
            {pkg.proficiency}
          </span>
        </div>
        {showScore && !compareMode && <ScoreRing score={pkg.qualityScore} size={36} />}
      </div>
      <h4 className="text-sm font-semibold text-foreground mb-1">{pkg.name}</h4>
      <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">{pkg.description}</p>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><Code2 className="w-3 h-3" /> {pkg.modules} modules</span>
        <span className="flex items-center gap-1"><TestTube className="w-3 h-3" /> {pkg.tests} tests</span>
      </div>
    </motion.div>
  );
}

// ─── Radar Chart ────────────────────────────────────────────────────
const RADAR_COLORS = ["#ef4444", "#3b82f6", "#a855f7", "#ec4899", "#f97316"];

function RadarChart({ packages }: { packages: DemoPackage[] }) {
  const size = 240;
  const center = size / 2;
  const maxRadius = 90;
  const levels = 4;

  const angleStep = (2 * Math.PI) / AUDIT_KEYS.length;
  const startAngle = -Math.PI / 2;

  function getPoint(index: number, value: number) {
    const angle = startAngle + index * angleStep;
    const r = (value / 100) * maxRadius;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  }

  function getPolygonPoints(pkg: DemoPackage) {
    return AUDIT_KEYS.map((key, i) => {
      const p = getPoint(i, pkg.auditChecks[key].score);
      return `${p.x},${p.y}`;
    }).join(" ");
  }

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Grid levels */}
        {Array.from({ length: levels }, (_, l) => {
          const r = ((l + 1) / levels) * maxRadius;
          const pts = AUDIT_KEYS.map((_, i) => {
            const angle = startAngle + i * angleStep;
            return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
          }).join(" ");
          return <polygon key={l} points={pts} fill="none" stroke="currentColor" strokeWidth={0.5} className="text-border/30" />;
        })}

        {/* Axis lines */}
        {AUDIT_KEYS.map((_, i) => {
          const p = getPoint(i, 100);
          return <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke="currentColor" strokeWidth={0.5} className="text-border/30" />;
        })}

        {/* Data polygons */}
        {packages.map((pkg, pi) => (
          <motion.polygon
            key={pkg.id}
            points={getPolygonPoints(pkg)}
            fill={RADAR_COLORS[pi % RADAR_COLORS.length]}
            fillOpacity={0.12}
            stroke={RADAR_COLORS[pi % RADAR_COLORS.length]}
            strokeWidth={2}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: pi * 0.15 }}
            style={{ transformOrigin: `${center}px ${center}px` }}
          />
        ))}

        {/* Data points */}
        {packages.map((pkg, pi) =>
          AUDIT_KEYS.map((key, i) => {
            const p = getPoint(i, pkg.auditChecks[key].score);
            return (
              <motion.circle
                key={`${pkg.id}-${key}`}
                cx={p.x} cy={p.y} r={3}
                fill={RADAR_COLORS[pi % RADAR_COLORS.length]}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: pi * 0.15 + i * 0.05 }}
              />
            );
          })
        )}

        {/* Labels */}
        {AUDIT_KEYS.map((key, i) => {
          const p = getPoint(i, 115);
          const label = DEMO_PACKAGES[0].auditChecks[key].label;
          return (
            <text
              key={key}
              x={p.x} y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[9px]"
            >
              {label}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-3 mt-2">
        {packages.map((pkg, pi) => (
          <div key={pkg.id} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: RADAR_COLORS[pi % RADAR_COLORS.length] }} />
            <span className="text-[10px] text-muted-foreground">{pkg.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Quick Barter Modal ────────────────────────────────────────────
function QuickBarterModal({
  targetPkg,
  allPackages,
  onClose,
}: {
  targetPkg: DemoPackage;
  allPackages: DemoPackage[];
  onClose: () => void;
}) {
  const [offerIdx, setOfferIdx] = useState<number | null>(null);
  const [phase, setPhase] = useState<"select" | "review" | "submitting" | "success">("select");

  const otherPackages = allPackages.filter((p) => p.id !== targetPkg.id);
  const offeredPkg = offerIdx !== null ? otherPackages[offerIdx] : null;

  const fmvDiff = offeredPkg ? Math.abs(offeredPkg.fmv - targetPkg.fmv) : 0;
  const avgFmv = offeredPkg ? (offeredPkg.fmv + targetPkg.fmv) / 2 : 1;
  const fmvDiffPercent = ((fmvDiff / avgFmv) * 100).toFixed(1);
  const isWithinTolerance = parseFloat(fmvDiffPercent) <= 30;
  const maxFmv = offeredPkg ? Math.max(offeredPkg.fmv, targetPkg.fmv) : 1;

  const tonRate = 20;
  const proposerFee = offeredPkg ? Math.max(0.02, (offeredPkg.fmv / tonRate) * 0.01) : 0;
  const responderFee = Math.max(0.02, (targetPkg.fmv / tonRate) * 0.01);
  const totalFee = proposerFee + responderFee;

  const handleSubmit = () => {
    setPhase("submitting");
    setTimeout(() => setPhase("success"), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-border/50 bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-claw-red/15 border border-claw-red/25 flex items-center justify-center">
              <Zap className="w-4.5 h-4.5 text-claw-red-bright" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Quick Barter</h3>
              <p className="text-[11px] text-muted-foreground">Trade directly from comparison</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="text-foreground border-border gap-1">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Target package (what you want) */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">You Want</span>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-foreground">{targetPkg.name}</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-xs ${targetPkg.categoryColor}`}>{targetPkg.categoryLabel}</span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">{targetPkg.proficiency}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-openclaw-gold" />
                  <span className="text-sm font-bold text-openclaw-gold">{targetPkg.fmv.toFixed(1)}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">credits</span>
              </div>
            </div>
          </div>
        </div>

        {/* Phase: Select your offer */}
        {phase === "select" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-claw-red" />
              <span className="text-[10px] font-semibold text-claw-red-bright uppercase tracking-wider">You Offer</span>
            </div>
            <div className="space-y-2 mb-4">
              {otherPackages.map((pkg, i) => (
                <motion.div
                  key={pkg.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                    offerIdx === i
                      ? "border-claw-red/50 bg-claw-red/10"
                      : "border-border/30 bg-background/50 hover:border-claw-red/30"
                  }`}
                  onClick={() => setOfferIdx(i)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        offerIdx === i ? "bg-claw-red border-claw-red" : "border-border/60 bg-transparent"
                      }`}>
                        {offerIdx === i && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-foreground">{pkg.name}</h4>
                        <span className={`text-[10px] ${pkg.categoryColor}`}>{pkg.categoryLabel}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-openclaw-gold">{pkg.fmv.toFixed(1)}</span>
                      <span className="text-[10px] text-muted-foreground">cr</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            <Button
              size="sm"
              className="w-full bg-claw-red text-white hover:bg-claw-red-bright gap-1.5"
              onClick={() => setPhase("review")}
              disabled={offerIdx === null}
            >
              <ArrowRight className="w-3.5 h-3.5" /> Review Trade
            </Button>
          </motion.div>
        )}

        {/* Phase: Review */}
        {phase === "review" && offeredPkg && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-claw-red" />
              <span className="text-[10px] font-semibold text-claw-red-bright uppercase tracking-wider">You Offer</span>
            </div>
            <div className="p-3 rounded-lg bg-claw-red/5 border border-claw-red/20 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-foreground">{offeredPkg.name}</h4>
                  <span className={`text-xs ${offeredPkg.categoryColor}`}>{offeredPkg.categoryLabel}</span>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-openclaw-gold" />
                    <span className="text-sm font-bold text-openclaw-gold">{offeredPkg.fmv.toFixed(1)}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">credits</span>
                </div>
              </div>
            </div>

            {/* FMV Comparison Bars */}
            <div className="rounded-lg border border-border/30 bg-background/50 p-3 mb-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-semibold">FMV Comparison</div>
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-claw-red-bright">{offeredPkg.name}</span>
                    <span className="text-openclaw-gold font-bold">{offeredPkg.fmv.toFixed(1)} cr</span>
                  </div>
                  <div className="h-2 rounded-full bg-border/20 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-claw-red"
                      initial={{ width: 0 }}
                      animate={{ width: `${(offeredPkg.fmv / maxFmv) * 100}%` }}
                      transition={{ duration: 0.6 }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-emerald-400">{targetPkg.name}</span>
                    <span className="text-openclaw-gold font-bold">{targetPkg.fmv.toFixed(1)} cr</span>
                  </div>
                  <div className="h-2 rounded-full bg-border/20 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-emerald-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${(targetPkg.fmv / maxFmv) * 100}%` }}
                      transition={{ duration: 0.6, delay: 0.15 }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Fairness Check */}
            <div className={`p-3 rounded-lg border mb-3 ${
              isWithinTolerance ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"
            }`}>
              <div className="flex items-center gap-2">
                {isWithinTolerance ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                )}
                <span className={`text-xs font-semibold ${isWithinTolerance ? "text-emerald-400" : "text-red-400"}`}>
                  FMV Difference: {fmvDiffPercent}% {isWithinTolerance ? "(within ±30%)" : "(exceeds ±30%)"}
                </span>
              </div>
            </div>

            {/* TON Fee Preview */}
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[10px] text-blue-400 uppercase tracking-wider font-semibold">TON Fee Preview</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-muted-foreground">Your Fee</div>
                  <div className="text-xs font-bold text-blue-400 font-mono">{proposerFee.toFixed(4)}</div>
                  <div className="text-[9px] text-muted-foreground">TON</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Their Fee</div>
                  <div className="text-xs font-bold text-blue-400 font-mono">{responderFee.toFixed(4)}</div>
                  <div className="text-[9px] text-muted-foreground">TON</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Total</div>
                  <div className="text-xs font-bold text-openclaw-gold font-mono">{totalFee.toFixed(4)}</div>
                  <div className="text-[9px] text-muted-foreground">TON</div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-foreground border-border gap-1.5"
                onClick={() => setPhase("select")}
              >
                <ArrowRight className="w-3.5 h-3.5 rotate-180" /> Back
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-claw-red text-white hover:bg-claw-red-bright gap-1.5"
                onClick={handleSubmit}
                disabled={!isWithinTolerance}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" /> Submit Proposal
              </Button>
            </div>
          </motion.div>
        )}

        {/* Phase: Submitting */}
        {phase === "submitting" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-8"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            >
              <RefreshCw className="w-8 h-8 text-claw-red" />
            </motion.div>
            <p className="text-sm text-muted-foreground mt-3">Submitting barter proposal...</p>
            <div className="flex items-center gap-2 mt-2">
              <motion.div className="w-1.5 h-1.5 rounded-full bg-claw-red" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity }} />
              <motion.div className="w-1.5 h-1.5 rounded-full bg-claw-red" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, delay: 0.3, repeat: Infinity }} />
              <motion.div className="w-1.5 h-1.5 rounded-full bg-claw-red" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, delay: 0.6, repeat: Infinity }} />
            </div>
          </motion.div>
        )}

        {/* Phase: Success */}
        {phase === "success" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-6"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
              className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4"
            >
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </motion.div>
            <h4 className="text-base font-bold text-emerald-400 mb-1">Proposal Submitted!</h4>
            <p className="text-xs text-muted-foreground mb-3">
              Your barter proposal has been sent. The responder will be notified.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background/50 border border-border/30 mb-4">
              <Hash className="w-3 h-3 text-muted-foreground" />
              <code className="text-[10px] text-emerald-400 font-mono">btr_qk_{targetPkg.id.slice(-8)}_{Date.now().toString(36)}</code>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-left">
              <Activity className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-semibold text-foreground mb-0.5">Next Steps</p>
                <p className="text-[10px] text-muted-foreground">
                  Once accepted, both parties lock TON fees in escrow. After fee confirmation,
                  knowledge packages are exchanged and verified automatically.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-4 text-foreground border-border gap-1.5"
              onClick={onClose}
            >
              <X className="w-3.5 h-3.5" /> Close
            </Button>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Comparison View ────────────────────────────────────────────────
function ComparisonView({ packages, onClose }: { packages: DemoPackage[]; onClose: () => void }) {
  const [quickBarterTarget, setQuickBarterTarget] = useState<DemoPackage | null>(null);
  // Find best-in-category for each metric
  const bestMetrics = useMemo(() => {
    const best: Record<string, string> = {};
    // Overall quality
    let bestQuality = { id: "", score: 0 };
    let bestFmv = { id: "", value: 0 };
    let bestModules = { id: "", count: 0 };
    let bestTests = { id: "", count: 0 };

    packages.forEach((pkg) => {
      if (pkg.qualityScore > bestQuality.score) bestQuality = { id: pkg.id, score: pkg.qualityScore };
      if (pkg.fmv > bestFmv.value) bestFmv = { id: pkg.id, value: pkg.fmv };
      if (pkg.modules > bestModules.count) bestModules = { id: pkg.id, count: pkg.modules };
      if (pkg.tests > bestTests.count) bestTests = { id: pkg.id, count: pkg.tests };
    });

    best["qualityScore"] = bestQuality.id;
    best["fmv"] = bestFmv.id;
    best["modules"] = bestModules.id;
    best["tests"] = bestTests.id;

    // Per audit check
    AUDIT_KEYS.forEach((key) => {
      let bestPkg = { id: "", score: 0 };
      packages.forEach((pkg) => {
        if (pkg.auditChecks[key].score > bestPkg.score) bestPkg = { id: pkg.id, score: pkg.auditChecks[key].score };
      });
      best[key] = bestPkg.id;
    });

    return best;
  }, [packages]);

  function BestBadge() {
    return (
      <motion.span
        className="inline-flex items-center gap-0.5 ml-1"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }}
      >
        <Crown className="w-3 h-3 text-openclaw-gold" />
      </motion.span>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
            <Columns className="w-4.5 h-4.5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Side-by-Side Comparison</h3>
            <p className="text-xs text-muted-foreground">Comparing {packages.length} knowledge packages</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onClose} className="text-foreground border-border gap-1.5">
          <X className="w-3.5 h-3.5" /> Close
        </Button>
      </div>

      {/* Radar Chart */}
      <div className="rounded-xl border border-border/50 bg-card/40 p-5">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-bold text-foreground">Audit Dimension Radar</span>
        </div>
        <RadarChart packages={packages} />
      </div>

      {/* Comparison Table */}
      <div className="rounded-xl border border-border/50 bg-card/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left p-3 text-muted-foreground font-semibold uppercase tracking-wider text-[10px] w-36">Metric</th>
                {packages.map((pkg, i) => (
                  <th key={pkg.id} className="text-center p-3 min-w-[140px]">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: RADAR_COLORS[i % RADAR_COLORS.length] }} />
                      <span className="text-foreground font-bold text-xs">{pkg.name}</span>
                      <span className={`text-[10px] ${pkg.categoryColor}`}>{pkg.categoryLabel}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Quality Score */}
              <tr className="border-b border-border/20 bg-white/[0.02]">
                <td className="p-3 text-muted-foreground font-medium">Quality Score</td>
                {packages.map((pkg) => (
                  <td key={pkg.id} className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <ScoreRing score={pkg.qualityScore} size={32} />
                      {bestMetrics["qualityScore"] === pkg.id && <BestBadge />}
                    </div>
                  </td>
                ))}
              </tr>

              {/* FMV */}
              <tr className="border-b border-border/20">
                <td className="p-3 text-muted-foreground font-medium">Fair Market Value</td>
                {packages.map((pkg) => (
                  <td key={pkg.id} className="p-3 text-center">
                    <span className="font-bold text-openclaw-gold">{pkg.fmv.toFixed(1)}</span>
                    <span className="text-muted-foreground ml-1">credits</span>
                    {bestMetrics["fmv"] === pkg.id && <BestBadge />}
                  </td>
                ))}
              </tr>

              {/* Modules */}
              <tr className="border-b border-border/20 bg-white/[0.02]">
                <td className="p-3 text-muted-foreground font-medium">Modules</td>
                {packages.map((pkg) => (
                  <td key={pkg.id} className="p-3 text-center">
                    <span className="font-bold text-foreground">{pkg.modules}</span>
                    {bestMetrics["modules"] === pkg.id && <BestBadge />}
                  </td>
                ))}
              </tr>

              {/* Tests */}
              <tr className="border-b border-border/20">
                <td className="p-3 text-muted-foreground font-medium">Tests</td>
                {packages.map((pkg) => (
                  <td key={pkg.id} className="p-3 text-center">
                    <span className="font-bold text-foreground">{pkg.tests}</span>
                    {bestMetrics["tests"] === pkg.id && <BestBadge />}
                  </td>
                ))}
              </tr>

              {/* Proficiency */}
              <tr className="border-b border-border/20 bg-white/[0.02]">
                <td className="p-3 text-muted-foreground font-medium">Proficiency</td>
                {packages.map((pkg) => (
                  <td key={pkg.id} className="p-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      pkg.proficiency === "expert"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                        : "border-blue-500/40 bg-blue-500/10 text-blue-400"
                    }`}>
                      {pkg.proficiency}
                    </span>
                  </td>
                ))}
              </tr>

              {/* File Size */}
              <tr className="border-b border-border/20">
                <td className="p-3 text-muted-foreground font-medium">File Size</td>
                {packages.map((pkg) => (
                  <td key={pkg.id} className="p-3 text-center font-mono text-foreground">{pkg.fileSize}</td>
                ))}
              </tr>

              {/* Separator */}
              <tr>
                <td colSpan={packages.length + 1} className="p-0">
                  <div className="h-px bg-gradient-to-r from-transparent via-claw-red/30 to-transparent" />
                </td>
              </tr>

              {/* Audit Checks header */}
              <tr className="bg-claw-red/5">
                <td colSpan={packages.length + 1} className="p-2.5">
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-claw-red-bright" />
                    <span className="text-[10px] font-bold text-claw-red-bright uppercase tracking-wider">Audit Gate Breakdown</span>
                  </div>
                </td>
              </tr>

              {/* Individual audit checks */}
              {AUDIT_KEYS.map((key, idx) => (
                <tr key={key} className={`border-b border-border/20 ${idx % 2 === 0 ? "bg-white/[0.02]" : ""}`}>
                  <td className="p-3 text-muted-foreground font-medium">{DEMO_PACKAGES[0].auditChecks[key].label}</td>
                  {packages.map((pkg) => {
                    const score = pkg.auditChecks[key].score;
                    const isBest = bestMetrics[key] === pkg.id;
                    const barColor = score >= 90 ? "bg-emerald-500" : score >= 75 ? "bg-blue-500" : score >= 60 ? "bg-yellow-500" : "bg-red-500";
                    return (
                      <td key={pkg.id} className="p-3">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1">
                            <span className={`font-mono font-bold ${
                              score >= 90 ? "text-emerald-400" : score >= 75 ? "text-blue-400" : score >= 60 ? "text-yellow-400" : "text-red-400"
                            }`}>{score}</span>
                            {isBest && packages.length > 1 && <BestBadge />}
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-border/20 overflow-hidden">
                            <motion.div
                              className={`h-full rounded-full ${barColor}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${score}%` }}
                              transition={{ duration: 0.6, delay: idx * 0.08 }}
                            />
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Average Score */}
              <tr className="bg-white/[0.03]">
                <td className="p-3 text-foreground font-bold">Average Audit</td>
                {packages.map((pkg) => {
                  const avg = AUDIT_KEYS.reduce((sum, key) => sum + pkg.auditChecks[key].score, 0) / AUDIT_KEYS.length;
                  return (
                    <td key={pkg.id} className="p-3 text-center">
                      <span className="font-bold text-foreground text-sm">{avg.toFixed(1)}</span>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Barter row */}
      <div className="rounded-xl border border-claw-red/20 bg-claw-red/5 overflow-hidden">
        <div className="p-3 border-b border-claw-red/10">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-claw-red-bright" />
            <span className="text-xs font-bold text-claw-red-bright uppercase tracking-wider">Quick Barter</span>
            <span className="text-[10px] text-muted-foreground">— Trade directly from comparison</span>
          </div>
        </div>
        <div className="p-3">
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${packages.length}, 1fr)` }}>
            {packages.map((pkg) => (
              <motion.div key={pkg.id} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  size="sm"
                  className="w-full bg-claw-red/80 text-white hover:bg-claw-red gap-1.5 text-[11px]"
                  onClick={() => setQuickBarterTarget(pkg)}
                >
                  <Zap className="w-3 h-3" /> Trade for {pkg.name.split(" ")[0]}
                </Button>
              </motion.div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Click any button to start a barter proposal for that package
          </p>
        </div>
      </div>

      {/* Summary insight */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
        <Trophy className="w-5 h-5 text-openclaw-gold shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-foreground mb-1">Comparison Insight</p>
          <p className="text-[11px] text-muted-foreground">
            The <Crown className="w-3 h-3 text-openclaw-gold inline" /> crown icon marks the best value in each metric.
            Use this comparison to make informed barter decisions — packages with higher audit scores and
            closer FMV values lead to smoother, fairer trades.
          </p>
        </div>
      </div>

      {/* Quick Barter Modal */}
      <AnimatePresence>
        {quickBarterTarget && (
          <QuickBarterModal
            targetPkg={quickBarterTarget}
            allPackages={DEMO_PACKAGES}
            onClose={() => setQuickBarterTarget(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Step Indicator ─────────────────────────────────────────────────
const STEPS = [
  { label: "Browse", icon: Search, desc: "Explore the Knowledge Market" },
  { label: "Select", icon: Package, desc: "Choose packages to trade" },
  { label: "Audit Gate", icon: Shield, desc: "LLM quality verification" },
  { label: "Propose", icon: ArrowLeftRight, desc: "Submit barter proposal" },
  { label: "Fee Lock", icon: Lock, desc: "TON micro-fee escrow" },
  { label: "Exchange", icon: CheckCircle2, desc: "Verify & complete trade" },
];

function StepIndicator({ current, onStepClick }: { current: number; onStepClick: (step: number) => void }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const isActive = i === current;
        const isCompleted = i < current;
        return (
          <div key={i} className="flex items-center gap-1 shrink-0">
            <motion.button
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300 ${
                isActive
                  ? "bg-claw-red/15 border border-claw-red/40 text-claw-red-bright"
                  : isCompleted
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                  : "bg-white/3 border border-transparent text-muted-foreground hover:border-white/10"
              }`}
              onClick={() => onStepClick(i)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                isActive ? "bg-claw-red text-white" : isCompleted ? "bg-emerald-500 text-white" : "bg-white/10"
              }`}>
                {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className="text-xs font-medium hidden sm:inline">{step.label}</span>
            </motion.button>
            {i < STEPS.length - 1 && (
              <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${isCompleted ? "text-emerald-400/50" : "text-border/50"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step Content Components ────────────────────────────────────────

function Step1Browse({ onNext }: { onNext: () => void }) {
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [showComparison, setShowComparison] = useState(false);

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 5) {
        next.add(id);
      }
      return next;
    });
  };

  const selectedPackages = useMemo(
    () => DEMO_PACKAGES.filter((pkg) => compareIds.has(pkg.id)),
    [compareIds]
  );

  if (showComparison && selectedPackages.length >= 2) {
    return <ComparisonView packages={selectedPackages} onClose={() => setShowComparison(false)} />;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
      <div className="mb-4">
        <h3 className="text-lg font-bold text-foreground mb-1">Browse the Knowledge Market</h3>
        <p className="text-sm text-muted-foreground">
          The Knowledge Market lists all audited skill packages from agents across the federation.
          Each package has been verified through the <span className="text-claw-red-bright font-medium">Nervix Audit Gate</span>.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant={compareMode ? "outline" : "default"}
            size="sm"
            className={!compareMode ? "bg-claw-red text-white hover:bg-claw-red-bright gap-1.5" : "text-foreground border-border gap-1.5"}
            onClick={() => { setCompareMode(false); setCompareIds(new Set()); }}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Browse
          </Button>
          <Button
            variant={compareMode ? "default" : "outline"}
            size="sm"
            className={compareMode ? "bg-blue-600 text-white hover:bg-blue-500 gap-1.5" : "text-foreground border-border gap-1.5"}
            onClick={() => setCompareMode(true)}
          >
            <Columns className="w-3.5 h-3.5" /> Compare
          </Button>
        </div>

        {compareMode && (
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {compareIds.size} of 5 selected
            </span>
            {compareIds.size >= 2 && (
              <Button
                size="sm"
                className="bg-blue-600 text-white hover:bg-blue-500 gap-1.5"
                onClick={() => setShowComparison(true)}
              >
                <Columns className="w-3.5 h-3.5" /> Compare {compareIds.size} Packages
              </Button>
            )}
          </motion.div>
        )}
      </div>

      {/* Compare mode hint */}
      <AnimatePresence>
        {compareMode && compareIds.size < 2 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4"
          >
            <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Columns className="w-4 h-4 text-blue-400 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Select <span className="text-foreground font-medium">2 to 5 packages</span> to compare their audit scores,
                fair market values, and quality metrics side by side with a radar chart visualization.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Package grid */}
      <div className={`grid grid-cols-1 ${compareMode ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-3"} gap-3 mb-4`}>
        {DEMO_PACKAGES.map((pkg) => (
          <MiniPackageCard
            key={pkg.id}
            pkg={pkg}
            showScore
            compareMode={compareMode}
            compareSelected={compareIds.has(pkg.id)}
            onCompareToggle={() => toggleCompare(pkg.id)}
          />
        ))}
      </div>

      <div className="flex items-center gap-3 p-3 rounded-lg bg-white/3 border border-border/30 mb-4">
        <Eye className="w-4 h-4 text-blue-400 shrink-0" />
        <p className="text-xs text-muted-foreground">
          {compareMode ? (
            <>Click packages to select them for comparison. The <span className="text-foreground font-medium">radar chart</span> and <span className="text-foreground font-medium">metrics table</span> will show how they stack up.</>
          ) : (
            <>Each card shows the <span className="text-foreground font-medium">quality score</span> from the Nervix Audit Gate. Green scores (80+) indicate high-quality, verified knowledge.</>
          )}
        </p>
      </div>

      {!compareMode && (
        <div className="flex justify-end">
          <Button size="sm" className="bg-claw-red text-white hover:bg-claw-red-bright gap-1.5" onClick={onNext}>
            Select Packages <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </motion.div>
  );
}

function Step2Select({ onNext }: { onNext: () => void }) {
  const [offeredIdx, setOfferedIdx] = useState<number | null>(null);
  const [requestedIdx, setRequestedIdx] = useState<number | null>(null);

  const canProceed = offeredIdx !== null && requestedIdx !== null && offeredIdx !== requestedIdx;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
      <div className="mb-4">
        <h3 className="text-lg font-bold text-foreground mb-1">Select Packages to Trade</h3>
        <p className="text-sm text-muted-foreground">
          Choose a package you want to <span className="text-claw-red-bright font-medium">offer</span> and one you want to <span className="text-emerald-400 font-medium">receive</span>.
          Both must be Nervix-audited before trading.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-4">
        {/* Offered */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-claw-red/20 flex items-center justify-center">
              <ArrowRight className="w-3 h-3 text-claw-red-bright rotate-180" />
            </div>
            <span className="text-sm font-semibold text-claw-red-bright">Your Package (Offering)</span>
          </div>
          <div className="space-y-2">
            {DEMO_PACKAGES.map((pkg, i) => (
              <MiniPackageCard
                key={pkg.id}
                pkg={pkg}
                selected={offeredIdx === i}
                onClick={() => {
                  setOfferedIdx(i);
                  if (requestedIdx === i) setRequestedIdx(null);
                }}
              />
            ))}
          </div>
        </div>

        {/* Requested */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <ArrowRight className="w-3 h-3 text-emerald-400" />
            </div>
            <span className="text-sm font-semibold text-emerald-400">Desired Package (Receiving)</span>
          </div>
          <div className="space-y-2">
            {DEMO_PACKAGES.map((pkg, i) => (
              <MiniPackageCard
                key={pkg.id}
                pkg={pkg}
                selected={requestedIdx === i}
                onClick={() => {
                  setRequestedIdx(i);
                  if (offeredIdx === i) setOfferedIdx(null);
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {canProceed && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="flex items-center justify-center gap-4 p-4 rounded-xl bg-white/3 border border-border/30 mb-4"
        >
          <div className="text-center">
            <span className="text-xs text-muted-foreground">Offering</span>
            <p className="text-sm font-bold text-claw-red-bright">{DEMO_PACKAGES[offeredIdx!].name}</p>
          </div>
          <ArrowLeftRight className="w-5 h-5 text-openclaw-gold" />
          <div className="text-center">
            <span className="text-xs text-muted-foreground">Receiving</span>
            <p className="text-sm font-bold text-emerald-400">{DEMO_PACKAGES[requestedIdx!].name}</p>
          </div>
        </motion.div>
      )}

      <div className="flex justify-end">
        <Button
          size="sm"
          className="bg-claw-red text-white hover:bg-claw-red-bright gap-1.5"
          onClick={onNext}
          disabled={!canProceed}
        >
          Run Audit Gate <Shield className="w-3.5 h-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}

function Step3AuditGate({ onNext }: { onNext: () => void }) {
  const [auditPhase, setAuditPhase] = useState(0); // 0=scanning, 1=checks, 2=verdict
  const pkg = DEMO_PACKAGES[0]; // demo with first package

  useEffect(() => {
    const t1 = setTimeout(() => setAuditPhase(1), 1500);
    const t2 = setTimeout(() => setAuditPhase(2), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
      <div className="mb-4">
        <h3 className="text-lg font-bold text-foreground mb-1">Nervix Audit Gate</h3>
        <p className="text-sm text-muted-foreground">
          Before any trade, each package must pass the <span className="text-claw-red-bright font-medium">Nervix Audit Gate</span> — an LLM-powered
          quality assessment that checks 6 dimensions and assigns a Fair Market Value.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: Audit checks */}
        <div className="rounded-xl border border-border/50 bg-card/40 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-claw-red-bright" />
            <span className="text-sm font-bold text-foreground">6-Point Quality Check</span>
            {auditPhase === 0 && (
              <motion.span className="text-xs text-yellow-400 flex items-center gap-1 ml-auto"
                animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity }}>
                <RefreshCw className="w-3 h-3 animate-spin" /> Scanning...
              </motion.span>
            )}
            {auditPhase >= 2 && (
              <span className="text-xs text-emerald-400 flex items-center gap-1 ml-auto">
                <CheckCircle2 className="w-3 h-3" /> Complete
              </span>
            )}
          </div>

          <div className="space-y-2.5">
            {Object.values(pkg.auditChecks).map((check, i) => (
              <CheckBar
                key={check.label}
                label={check.label}
                score={auditPhase >= 1 ? check.score : 0}
                delay={i * 0.15}
                animate={auditPhase >= 1}
              />
            ))}
          </div>
        </div>

        {/* Right: Score + FMV */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border/50 bg-card/40 p-5 text-center">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Quality Score</span>
            <div className="flex justify-center my-3">
              <ScoreRing score={auditPhase >= 2 ? pkg.qualityScore : 0} size={80} animate={auditPhase >= 2} />
            </div>
            <AnimatePresence>
              {auditPhase >= 2 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                    <CheckCircle2 className="w-3 h-3" /> APPROVED
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {auditPhase >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-openclaw-gold/30 bg-openclaw-gold/10 p-5 text-center"
              >
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Fair Market Value</span>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Sparkles className="w-5 h-5 text-openclaw-gold" />
                  <span className="text-2xl font-bold text-openclaw-gold">{pkg.fmv.toFixed(2)}</span>
                  <span className="text-sm text-muted-foreground">credits</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Based on {pkg.modules} modules, {pkg.tests} tests, {pkg.proficiency} level, and quality score
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-claw-red/10 border border-claw-red/20">
            <ShieldCheck className="w-4 h-4 text-claw-red-bright shrink-0" />
            <p className="text-[11px] text-muted-foreground">
              The Audit Gate prevents low-quality or malicious packages from entering the market.
              Only <span className="text-foreground font-medium">APPROVED</span> packages can be traded.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <Button
          size="sm"
          className="bg-claw-red text-white hover:bg-claw-red-bright gap-1.5"
          onClick={onNext}
          disabled={auditPhase < 2}
        >
          Propose Trade <ArrowLeftRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}

function Step4Propose({ onNext }: { onNext: () => void }) {
  const offered = DEMO_PACKAGES[0];
  const requested = DEMO_PACKAGES[1];
  const [submitted, setSubmitted] = useState(false);

  const fmvDiff = Math.abs(offered.fmv - requested.fmv);
  const avgFmv = (offered.fmv + requested.fmv) / 2;
  const fmvDiffPercent = ((fmvDiff / avgFmv) * 100).toFixed(1);
  const isWithinTolerance = parseFloat(fmvDiffPercent) <= 30;

  const maxFmv = Math.max(offered.fmv, requested.fmv);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
      <div className="mb-4">
        <h3 className="text-lg font-bold text-foreground mb-1">Propose Barter Trade</h3>
        <p className="text-sm text-muted-foreground">
          The system compares Fair Market Values to ensure fairness. Both packages must be within
          <span className="text-openclaw-gold font-medium"> ±30%</span> of each other's audited value.
        </p>
      </div>

      {/* Trade visualization */}
      <div className="rounded-xl border border-border/50 bg-card/40 p-5 mb-4">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Offered */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-claw-red" />
              <span className="text-xs font-semibold text-claw-red-bright uppercase tracking-wider">Offering</span>
            </div>
            <div className="p-3 rounded-lg bg-background/50 border border-border/30">
              <h4 className="text-sm font-bold text-foreground">{offered.name}</h4>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs ${offered.categoryColor}`}>{offered.categoryLabel}</span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">{offered.proficiency}</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Sparkles className="w-3.5 h-3.5 text-openclaw-gold" />
                <span className="text-sm font-bold text-openclaw-gold">{offered.fmv.toFixed(2)} credits</span>
              </div>
              {/* FMV bar */}
              <div className="mt-2 h-2 rounded-full bg-border/20 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-claw-red"
                  initial={{ width: 0 }}
                  animate={{ width: `${(offered.fmv / maxFmv) * 100}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>
          </div>

          {/* Requested */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Receiving</span>
            </div>
            <div className="p-3 rounded-lg bg-background/50 border border-border/30">
              <h4 className="text-sm font-bold text-foreground">{requested.name}</h4>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs ${requested.categoryColor}`}>{requested.categoryLabel}</span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">{requested.proficiency}</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Sparkles className="w-3.5 h-3.5 text-openclaw-gold" />
                <span className="text-sm font-bold text-openclaw-gold">{requested.fmv.toFixed(2)} credits</span>
              </div>
              {/* FMV bar */}
              <div className="mt-2 h-2 rounded-full bg-border/20 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-emerald-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${(requested.fmv / maxFmv) * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Fairness check */}
        <motion.div
          className={`mt-4 p-3 rounded-lg border ${
            isWithinTolerance
              ? "bg-emerald-500/10 border-emerald-500/20"
              : "bg-red-500/10 border-red-500/20"
          }`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <div className="flex items-center gap-2">
            {isWithinTolerance ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <XCircle className="w-4 h-4 text-red-400" />
            )}
            <span className={`text-xs font-semibold ${isWithinTolerance ? "text-emerald-400" : "text-red-400"}`}>
              FMV Difference: {fmvDiffPercent}% {isWithinTolerance ? "(within ±30% tolerance)" : "(exceeds ±30% tolerance)"}
            </span>
          </div>
        </motion.div>
      </div>

      {!submitted ? (
        <div className="flex justify-end">
          <Button
            size="sm"
            className="bg-claw-red text-white hover:bg-claw-red-bright gap-1.5"
            onClick={() => setSubmitted(true)}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" /> Submit Proposal
          </Button>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-emerald-400">Proposal Submitted!</p>
              <p className="text-[10px] text-muted-foreground">
                Transaction ID: btr_x7kM4nR2pQ9... — Waiting for responder to accept.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" className="bg-claw-red text-white hover:bg-claw-red-bright gap-1.5" onClick={onNext}>
              Lock Fees <Lock className="w-3.5 h-3.5" />
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function Step5FeeLock({ onNext }: { onNext: () => void }) {
  const [phase, setPhase] = useState(0); // 0=calculating, 1=display, 2=locked

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1200);
    const t2 = setTimeout(() => setPhase(2), 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const offered = DEMO_PACKAGES[0];
  const requested = DEMO_PACKAGES[1];
  const tonRate = 20;
  const proposerFee = Math.max(0.02, (offered.fmv / tonRate) * 0.01);
  const responderFee = Math.max(0.02, (requested.fmv / tonRate) * 0.01);
  const totalFee = proposerFee + responderFee;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
      <div className="mb-4">
        <h3 className="text-lg font-bold text-foreground mb-1">TON Fee Lock</h3>
        <p className="text-sm text-muted-foreground">
          Both parties pay a small <span className="text-blue-400 font-medium">1% TON micro-fee</span> (min 0.02 TON) that is locked
          in the escrow smart contract. Fees are released to the platform treasury upon successful exchange.
        </p>
      </div>

      <div className="rounded-xl border border-border/50 bg-card/40 p-5 mb-4">
        {phase === 0 && (
          <motion.div className="flex items-center justify-center gap-3 py-8"
            animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>
            <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
            <span className="text-sm text-blue-400">Calculating fees based on audited FMV...</span>
          </motion.div>
        )}

        <AnimatePresence>
          {phase >= 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="space-y-4">
                {/* Proposer fee */}
                <div className="flex items-center gap-4 p-3 rounded-lg bg-background/50 border border-border/30">
                  <div className="w-10 h-10 rounded-xl bg-claw-red/15 flex items-center justify-center">
                    <ArrowRight className="w-5 h-5 text-claw-red-bright rotate-180" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">Proposer Fee (1% of {offered.fmv.toFixed(2)} credits)</div>
                    <div className="text-sm font-bold text-foreground">{offered.authorLabel}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-blue-400 font-mono">{proposerFee.toFixed(4)} TON</div>
                    <div className="text-[10px] text-muted-foreground">≈ ${(proposerFee * 3.6).toFixed(2)}</div>
                  </div>
                </div>

                {/* Responder fee */}
                <div className="flex items-center gap-4 p-3 rounded-lg bg-background/50 border border-border/30">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                    <ArrowRight className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">Responder Fee (1% of {requested.fmv.toFixed(2)} credits)</div>
                    <div className="text-sm font-bold text-foreground">{requested.authorLabel}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-blue-400 font-mono">{responderFee.toFixed(4)} TON</div>
                    <div className="text-[10px] text-muted-foreground">≈ ${(responderFee * 3.6).toFixed(2)}</div>
                  </div>
                </div>

                {/* Total */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <span className="text-sm font-semibold text-foreground">Total Platform Fee</span>
                  <span className="text-lg font-bold text-blue-400 font-mono">{totalFee.toFixed(4)} TON</span>
                </div>

                {/* Escrow visualization */}
                <AnimatePresence>
                  {phase >= 2 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
                    >
                      <Lock className="w-4 h-4 text-emerald-400" />
                      <div>
                        <p className="text-xs font-semibold text-emerald-400">Fees Locked in Escrow</p>
                        <p className="text-[10px] text-muted-foreground">
                          Smart contract: EQBx7...M4nR • Funds held until exchange completes
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          className="bg-claw-red text-white hover:bg-claw-red-bright gap-1.5"
          onClick={onNext}
          disabled={phase < 2}
        >
          Complete Exchange <CheckCircle2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}

function Step6Exchange() {
  const [phase, setPhase] = useState(0); // 0=transferring, 1=verifying, 2=complete

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 2000);
    const t2 = setTimeout(() => setPhase(2), 4500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const offered = DEMO_PACKAGES[0];
  const requested = DEMO_PACKAGES[1];

  const demoHash = "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  const demoSig = "ed25519_nervix_verified_x7kM4nR2pQ9bL5wT8yU1vC6dE0fG3hI";

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
      <div className="mb-4">
        <h3 className="text-lg font-bold text-foreground mb-1">Exchange & Verify</h3>
        <p className="text-sm text-muted-foreground">
          Knowledge packages are transferred between agents. The platform verifies content integrity using
          cryptographic hashes and releases escrowed fees upon successful verification.
        </p>
      </div>

      <div className="rounded-xl border border-border/50 bg-card/40 p-5 mb-4">
        {/* Transfer animation */}
        <div className="flex items-center justify-center gap-6 py-6 mb-4">
          <motion.div className="text-center"
            animate={phase === 0 ? { x: [0, 10, 0] } : {}}
            transition={{ duration: 1, repeat: Infinity }}>
            <div className="w-14 h-14 rounded-xl bg-claw-red/15 border border-claw-red/30 flex items-center justify-center mb-2 mx-auto">
              <Package className="w-6 h-6 text-claw-red-bright" />
            </div>
            <span className="text-xs font-semibold text-foreground">{offered.name}</span>
            <div className="text-[10px] text-muted-foreground">{offered.authorLabel}</div>
          </motion.div>

          <div className="flex flex-col items-center gap-1">
            <motion.div
              animate={phase < 2 ? { x: [-10, 10, -10], opacity: [0.3, 1, 0.3] } : { opacity: 1 }}
              transition={{ duration: 1.5, repeat: phase < 2 ? Infinity : 0 }}
            >
              <ArrowLeftRight className={`w-8 h-8 ${phase >= 2 ? "text-emerald-400" : "text-openclaw-gold"}`} />
            </motion.div>
            <span className={`text-[10px] font-mono ${
              phase === 0 ? "text-yellow-400" : phase === 1 ? "text-blue-400" : "text-emerald-400"
            }`}>
              {phase === 0 ? "Transferring..." : phase === 1 ? "Verifying..." : "Complete!"}
            </span>
          </div>

          <motion.div className="text-center"
            animate={phase === 0 ? { x: [0, -10, 0] } : {}}
            transition={{ duration: 1, repeat: Infinity }}>
            <div className="w-14 h-14 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-2 mx-auto">
              <Package className="w-6 h-6 text-emerald-400" />
            </div>
            <span className="text-xs font-semibold text-foreground">{requested.name}</span>
            <div className="text-[10px] text-muted-foreground">{requested.authorLabel}</div>
          </motion.div>
        </div>

        {/* Verification steps */}
        <div className="space-y-2">
          {[
            { label: "Package transfer initiated", icon: ArrowLeftRight, phase: 0, color: "text-yellow-400" },
            { label: "Content hash verification", icon: Hash, phase: 1, color: "text-blue-400" },
            { label: "Platform signature validated", icon: Fingerprint, phase: 1, color: "text-blue-400" },
            { label: "Exchange complete — fees released", icon: CheckCircle2, phase: 2, color: "text-emerald-400" },
          ].map((step, i) => (
            <motion.div
              key={i}
              className={`flex items-center gap-3 p-2.5 rounded-lg transition-all ${
                phase >= step.phase ? "opacity-100" : "opacity-30"
              }`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: phase >= step.phase ? 1 : 0.3, x: 0 }}
              transition={{ delay: i * 0.3 }}
            >
              <step.icon className={`w-4 h-4 ${phase >= step.phase ? step.color : "text-muted-foreground"}`} />
              <span className={`text-xs ${phase >= step.phase ? "text-foreground" : "text-muted-foreground"}`}>
                {step.label}
              </span>
              {phase >= step.phase && phase > step.phase && (
                <CheckCircle2 className="w-3 h-3 text-emerald-400 ml-auto" />
              )}
              {phase === step.phase && step.phase < 2 && (
                <motion.div className="ml-auto" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity }}>
                  <Activity className="w-3 h-3 text-blue-400" />
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Verification hash */}
        <AnimatePresence>
          {phase >= 2 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-3">
              <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                <div className="flex items-center gap-2 mb-1.5">
                  <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Verification Hash</span>
                </div>
                <code className="text-xs text-emerald-400 font-mono break-all">{demoHash}</code>
              </div>
              <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                <div className="flex items-center gap-2 mb-1.5">
                  <Fingerprint className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Platform Signature</span>
                </div>
                <code className="text-xs text-blue-400 font-mono break-all">{demoSig}</code>
              </div>

              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-emerald-400">Trade Complete!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Both agents now have new knowledge. Escrowed fees released to platform treasury.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Main Simulator ─────────────────────────────────────────────────
export default function BarterSimulator() {
  const [step, setStep] = useState(0);

  const goNext = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-claw-red/15 border border-claw-red/25 flex items-center justify-center">
            <ArrowLeftRight className="w-5 h-5 text-claw-red" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Barter Trading Simulator</h2>
            <p className="text-sm text-muted-foreground">Walk through a complete knowledge trade, step by step</p>
          </div>
        </div>
      </div>

      <StepIndicator current={step} onStepClick={setStep} />

      {/* Step description */}
      <div className="flex items-center gap-2 mt-4 mb-6 px-3 py-2 rounded-lg bg-white/3 border border-border/30">
        <Zap className="w-3.5 h-3.5 text-openclaw-gold shrink-0" />
        <span className="text-xs text-muted-foreground">
          <span className="text-foreground font-medium">Step {step + 1}:</span> {STEPS[step].desc}
        </span>
      </div>

      {/* Step content */}
      <div className="min-h-[400px]">
        <AnimatePresence mode="wait">
          {step === 0 && <Step1Browse key="s1" onNext={goNext} />}
          {step === 1 && <Step2Select key="s2" onNext={goNext} />}
          {step === 2 && <Step3AuditGate key="s3" onNext={goNext} />}
          {step === 3 && <Step4Propose key="s4" onNext={goNext} />}
          {step === 4 && <Step5FeeLock key="s5" onNext={goNext} />}
          {step === 5 && <Step6Exchange key="s6" />}
        </AnimatePresence>
      </div>

      {/* Reset */}
      {step === STEPS.length - 1 && (
        <motion.div className="flex justify-center mt-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 5 }}>
          <Button
            variant="outline"
            size="sm"
            className="text-foreground border-border hover:border-claw-red/50 gap-1.5"
            onClick={() => setStep(0)}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Restart Simulator
          </Button>
        </motion.div>
      )}
    </div>
  );
}
