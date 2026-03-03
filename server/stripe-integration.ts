/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║       NERVIX STRIPE — Fiat Payment Integration Service        ║
 * ║                                                               ║
 * ║  Provides backend methods for Stripe Checkout, subscriptions, ║
 * ║  and credit purchases. Dual-rail with TON escrow.             ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

import Stripe from "stripe";
import { ENV } from "./_core/env";
import { logger } from "./_core/logger";
import {
  CREDIT_PACKAGES,
  FIAT_FEE_CONFIG,
  SUBSCRIPTION_TIERS,
  type CreditPackageId,
  type SubscriptionTierId,
} from "../shared/nervix-types";

// ─── Stripe Client ──────────────────────────────────────────────
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!ENV.stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }
    _stripe = new Stripe(ENV.stripeSecretKey, {
      apiVersion: "2026-02-25.clover",
      appInfo: {
        name: "Nervix Federation",
        version: "1.0.0",
        url: "https://nervix.ai",
      },
    });
  }
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return !!ENV.stripeSecretKey;
}

// ─── Customer Management ────────────────────────────────────────

export async function createOrGetCustomer(opts: {
  email: string;
  name?: string;
  userId: number;
}): Promise<Stripe.Customer> {
  const stripe = getStripe();

  // Search for existing customer by email
  const existing = await stripe.customers.list({
    email: opts.email,
    limit: 1,
  });

  if (existing.data.length > 0) {
    return existing.data[0];
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email: opts.email,
    name: opts.name,
    metadata: {
      nervix_user_id: String(opts.userId),
      platform: "nervix",
    },
  });

  logger.info("Stripe: Created customer %s for user %d", customer.id, opts.userId);
  return customer;
}

// ─── Checkout Sessions (Credit Purchases) ───────────────────────

export async function createCreditCheckoutSession(opts: {
  packageId: CreditPackageId;
  customerId: string;
  userId: number;
  agentId?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();

  const pkg = CREDIT_PACKAGES.find((p) => p.id === opts.packageId);
  if (!pkg) {
    throw new Error(`Invalid package: ${opts.packageId}`);
  }

  const session = await stripe.checkout.sessions.create({
    customer: opts.customerId,
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: pkg.priceUsd * 100, // Stripe uses cents
          product_data: {
            name: `NERVIX ${pkg.label}`,
            description: `${pkg.credits} credits for the NERVIX agent platform`,
            metadata: { package_id: pkg.id },
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: "credit_purchase",
      package_id: pkg.id,
      credits: String(pkg.credits),
      nervix_user_id: String(opts.userId),
      agent_id: opts.agentId || "",
    },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  });

  logger.info(
    "Stripe: Created checkout session %s for package %s (user %d)",
    session.id,
    pkg.id,
    opts.userId
  );
  return session;
}

// ─── Subscription Management ────────────────────────────────────

export async function createSubscriptionCheckout(opts: {
  tierId: SubscriptionTierId;
  customerId: string;
  userId: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();

  const tier = SUBSCRIPTION_TIERS.find((t) => t.id === opts.tierId);
  if (!tier || tier.priceUsd === 0) {
    throw new Error(`Invalid or free tier: ${opts.tierId}`);
  }

  const session = await stripe.checkout.sessions.create({
    customer: opts.customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: tier.priceUsd * 100,
          recurring: { interval: "month" },
          product_data: {
            name: `NERVIX ${tier.name} Plan`,
            description: `${tier.creditsPerMonth} credits/month, ${tier.feeDiscount * 100}% fee discount`,
            metadata: { tier_id: tier.id },
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: "subscription",
      tier_id: tier.id,
      nervix_user_id: String(opts.userId),
    },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  });

  logger.info(
    "Stripe: Created subscription checkout %s for tier %s (user %d)",
    session.id,
    tier.id,
    opts.userId
  );
  return session;
}

export async function cancelSubscription(
  stripeSubscriptionId: string
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: true,
  });
  logger.info("Stripe: Cancelling subscription %s at period end", stripeSubscriptionId);
  return sub;
}

export async function getSubscription(
  stripeSubscriptionId: string
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  return stripe.subscriptions.retrieve(stripeSubscriptionId);
}

// ─── Refunds ────────────────────────────────────────────────────

export async function createRefund(opts: {
  paymentIntentId: string;
  amount?: number; // partial refund in cents, omit for full
  reason?: string;
}): Promise<Stripe.Refund> {
  const stripe = getStripe();
  const refund = await stripe.refunds.create({
    payment_intent: opts.paymentIntentId,
    amount: opts.amount,
    reason: "requested_by_customer",
    metadata: { nervix_reason: opts.reason || "admin_refund" },
  });
  logger.info("Stripe: Refund %s created for PI %s", refund.id, opts.paymentIntentId);
  return refund;
}

// ─── Webhook Signature Verification ─────────────────────────────

export function constructWebhookEvent(
  payload: Buffer,
  signature: string
): Stripe.Event {
  const stripe = getStripe();
  if (!ENV.stripeWebhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET not configured");
  }
  return stripe.webhooks.constructEvent(payload, signature, ENV.stripeWebhookSecret);
}

// ─── Utility ────────────────────────────────────────────────────

export function getPackageById(packageId: string) {
  return CREDIT_PACKAGES.find((p) => p.id === packageId) || null;
}

export function getTierById(tierId: string) {
  return SUBSCRIPTION_TIERS.find((t) => t.id === tierId) || null;
}

/** Calculate credits for a custom USD amount */
export function usdToCredits(amountUsd: number): number {
  return amountUsd / FIAT_FEE_CONFIG.usdPerCredit;
}

/** Calculate USD for a given number of credits */
export function creditsToUsd(credits: number): number {
  return credits * FIAT_FEE_CONFIG.usdPerCredit;
}
