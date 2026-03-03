-- ============================================================================
-- NERVIX Stripe Payment Tables Migration
-- Date: 2026-03-03
-- Purpose: Add Stripe customer, checkout, subscription, and fiat transaction
--          tables for dual-rail payment system (Stripe + TON)
-- ============================================================================

-- ─── Enums ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE stripe_session_status AS ENUM ('pending', 'completed', 'expired', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE stripe_subscription_status AS ENUM ('active', 'past_due', 'canceled', 'unpaid', 'trialing', 'incomplete');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Stripe Customers ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stripe_customers (
  id                    SERIAL PRIMARY KEY,
  "userId"              INTEGER NOT NULL,
  "stripeCustomerId"    VARCHAR(128) NOT NULL UNIQUE,
  email                 VARCHAR(320),
  name                  TEXT,
  "defaultPaymentMethod" VARCHAR(128),
  "createdAt"           TIMESTAMP DEFAULT NOW() NOT NULL,
  "updatedAt"           TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stripe_customers_user_id ON stripe_customers("userId");
CREATE INDEX IF NOT EXISTS idx_stripe_customers_stripe_id ON stripe_customers("stripeCustomerId");

-- ─── Stripe Checkout Sessions ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stripe_checkout_sessions (
  id                      SERIAL PRIMARY KEY,
  "sessionId"             VARCHAR(128) NOT NULL UNIQUE,
  "stripeCustomerId"      VARCHAR(128),
  "userId"                INTEGER,
  "agentId"               VARCHAR(64),
  "packageId"             VARCHAR(64) NOT NULL,
  "creditsAmount"         NUMERIC(18, 6) NOT NULL,
  "amountUsd"             NUMERIC(10, 2) NOT NULL,
  status                  stripe_session_status DEFAULT 'pending' NOT NULL,
  "stripePaymentIntentId" VARCHAR(128),
  "completedAt"           TIMESTAMP,
  "createdAt"             TIMESTAMP DEFAULT NOW() NOT NULL,
  "updatedAt"             TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stripe_sessions_user_id ON stripe_checkout_sessions("userId");
CREATE INDEX IF NOT EXISTS idx_stripe_sessions_status ON stripe_checkout_sessions(status);

-- ─── Stripe Subscriptions ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  id                            SERIAL PRIMARY KEY,
  "stripeSubscriptionId"        VARCHAR(128) NOT NULL UNIQUE,
  "stripeCustomerId"            VARCHAR(128) NOT NULL,
  "userId"                      INTEGER NOT NULL,
  "tierId"                      VARCHAR(32) NOT NULL,
  status                        stripe_subscription_status DEFAULT 'active' NOT NULL,
  "currentPeriodStart"          TIMESTAMP,
  "currentPeriodEnd"            TIMESTAMP,
  "cancelAtPeriodEnd"           BOOLEAN DEFAULT FALSE NOT NULL,
  "creditsGrantedThisPeriod"    NUMERIC(18, 6) DEFAULT '0.000000' NOT NULL,
  "createdAt"                   TIMESTAMP DEFAULT NOW() NOT NULL,
  "updatedAt"                   TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stripe_subs_user_id ON stripe_subscriptions("userId");
CREATE INDEX IF NOT EXISTS idx_stripe_subs_status ON stripe_subscriptions(status);

-- ─── Fiat Transactions ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fiat_transactions (
  id                      SERIAL PRIMARY KEY,
  "transactionId"         VARCHAR(64) NOT NULL UNIQUE,
  type                    VARCHAR(64) NOT NULL,
  "userId"                INTEGER NOT NULL,
  "agentId"               VARCHAR(64),
  "amountUsd"             NUMERIC(10, 2) NOT NULL,
  "creditsAmount"         NUMERIC(18, 6) NOT NULL,
  "stripeFee"             NUMERIC(10, 2),
  "platformFee"           NUMERIC(10, 2),
  "stripePaymentIntentId" VARCHAR(128),
  "stripeSessionId"       VARCHAR(128),
  memo                    TEXT,
  "createdAt"             TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fiat_tx_user_id ON fiat_transactions("userId");
CREATE INDEX IF NOT EXISTS idx_fiat_tx_type ON fiat_transactions(type);
CREATE INDEX IF NOT EXISTS idx_fiat_tx_payment_intent ON fiat_transactions("stripePaymentIntentId");

-- ─── Add deposit/withdrawal to existing transaction_type enum ──────────────

DO $$ BEGIN
  ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'deposit';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'withdrawal';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- DONE: Run via Supabase SQL Editor or psql
-- ============================================================================
