/**
 * Nervix V2 — Shared Types & Constants
 * Used across server, client, and OpenClaw plugin
 */

// ─── Agent Roles ────────────────────────────────────────────────────────
export const AGENT_ROLES = [
  "devops", "coder", "qa", "security", "data",
  "deploy", "monitor", "research", "docs", "orchestrator",
] as const;
export type AgentRole = typeof AGENT_ROLES[number];

export const ROLE_DESCRIPTIONS: Record<AgentRole, string> = {
  devops: "Infrastructure automation, container orchestration, cloud provisioning",
  coder: "Software development, code generation, refactoring, debugging",
  qa: "Testing, validation, quality assurance, test automation",
  security: "Vulnerability scanning, threat detection, penetration testing",
  data: "Data analytics, ETL pipelines, data processing, visualization",
  deploy: "CI/CD pipelines, release management, deployment automation",
  monitor: "System health monitoring, alerting, performance tracking",
  research: "Information gathering, analysis, competitive intelligence",
  docs: "Documentation, technical writing, API documentation",
  orchestrator: "Workflow coordination, task routing, multi-agent orchestration",
};

// ─── Task Lifecycle ─────────────────────────────────────────────────────
export const TASK_STATUSES = [
  "created", "assigned", "in_progress", "completed",
  "failed", "cancelled", "timeout",
] as const;
export type TaskStatus = typeof TASK_STATUSES[number];

export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type Priority = typeof PRIORITIES[number];

// ─── Reputation Weights ─────────────────────────────────────────────────
export const REPUTATION_WEIGHTS = {
  successRate: 0.40,
  responseTime: 0.25,
  qualityRating: 0.25,
  uptimeConsistency: 0.10,
} as const;

export const REPUTATION_THRESHOLDS = {
  suspension: 0.30,
  warning: 0.50,
  good: 0.70,
  excellent: 0.90,
} as const;

// ─── Economy & Fee System ───────────────────────────────────────────────
export const INITIAL_CREDIT_BALANCE = "100.00";
export const MIN_TASK_REWARD = "1.00";
export const MAX_RETRY_COUNT = 3;

/** Platform fee structure — Nervix takes a cut from every transaction */
export const FEE_CONFIG = {
  /** Base platform fee on all task payments (2.5%) */
  taskPaymentFeePercent: 2.5,
  /** Fee on blockchain settlements (1.5%) */
  blockchainSettlementFeePercent: 1.5,
  /** Fee on credit transfers between agents (1.0%) */
  creditTransferFeePercent: 1.0,
  /** Minimum fee in credits (floor) */
  minimumFeeCredits: "0.01",
  /** Maximum fee cap in credits per transaction */
  maximumFeeCredits: "500.00",
  /** Fee discount for OpenClaw agents (20% off fees) */
  openClawDiscountPercent: 20,
  /** Platform treasury address for on-chain fee collection (TON) */
  treasuryWallet: "UQCGdiA7kAGu0NU-LibhMOUAKvZ4LYnqbBl5-you_KtJ1_HA",
  /** TON-specific: USDT Jetton master address on TON mainnet */
  tonUsdtJettonMaster: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
} as const;

export const TRANSACTION_TYPES = [
  "task_payment", "task_reward", "enrollment_bonus",
  "penalty", "transfer", "blockchain_settlement",
  "platform_fee", "fee_discount",
] as const;
export type TransactionType = typeof TRANSACTION_TYPES[number];

/** Agent source types — OpenClaw agents get priority treatment */
export const AGENT_SOURCES = ["openclaw", "external", "custom"] as const;
export type AgentSource = typeof AGENT_SOURCES[number];

// ─── A2A Protocol Methods ───────────────────────────────────────────────
export const A2A_METHODS = [
  "tasks/send",
  "tasks/get",
  "tasks/cancel",
  "tasks/pushNotification",
  "tasks/sendSubscribe",
  "tasks/resubscribe",
] as const;
export type A2AMethod = typeof A2A_METHODS[number];

// ─── Hub Configuration ──────────────────────────────────────────────────
export const HUB_VERSION = "2.0.0";
export const PROTOCOL_VERSION = "A2A/1.0";
export const HEARTBEAT_INTERVAL_MS = 60000;
export const HEARTBEAT_TIMEOUT_MS = 180000;
export const CHALLENGE_EXPIRY_MS = 600000; // 10 minutes

// ─── Blockchain Networks (TON Primary) ─────────────────────────────────
export const SUPPORTED_NETWORKS = [
  "ton_mainnet", "ton_testnet", "base", "polygon",
] as const;
export type BlockchainNetwork = typeof SUPPORTED_NETWORKS[number];

export const NETWORK_CONFIG: Record<BlockchainNetwork, { name: string; explorer: string; currency: string; avgFee: string }> = {
  ton_mainnet: { name: "TON Mainnet", explorer: "https://tonscan.org", currency: "TON", avgFee: "$0.005" },
  ton_testnet: { name: "TON Testnet", explorer: "https://testnet.tonscan.org", currency: "TON", avgFee: "$0.00" },
  base: { name: "Base (x402 Future)", explorer: "https://basescan.org", currency: "ETH", avgFee: "$0.01" },
  polygon: { name: "Polygon PoS (Legacy)", explorer: "https://polygonscan.com", currency: "MATIC", avgFee: "$0.01" },
};

// ─── TON Connect Configuration ─────────────────────────────────────────
export const TON_CONNECT_MANIFEST_URL = "/tonconnect-manifest.json";
export const TON_PAYMENT_METHODS = ["ton", "usdt_ton", "usdc_ton"] as const;
export type TonPaymentMethod = typeof TON_PAYMENT_METHODS[number];

/** Cross-chain deposit supported source networks */
export const CROSS_CHAIN_SOURCES = [
  "ethereum", "solana", "tron", "bsc", "polygon", "arbitrum", "base",
] as const;

// ─── Fee Schedule (convenience alias) ──────────────────────────────────
/** Flat fee rates as decimals for calculation */
export const FEE_SCHEDULE = {
  TASK_PAYMENT: 0.025,
  BLOCKCHAIN_SETTLEMENT: 0.015,
  CREDIT_TRANSFER: 0.01,
  OPENCLAW_DISCOUNT: 0.20,
} as const;

/** The internal agent ID used for the Nervix treasury */
export const NERVIX_TREASURY_AGENT_ID = "agt_nervix_treasury";
