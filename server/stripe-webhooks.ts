/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║       NERVIX STRIPE WEBHOOKS — Event Processing               ║
 * ║                                                               ║
 * ║  Handles Stripe webhook events: checkout completed,           ║
 * ║  subscription changes, invoice payments, refunds.             ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

import type { Request, Response } from "express";
import type Stripe from "stripe";
import { logger } from "./_core/logger";
import { constructWebhookEvent, getPackageById } from "./stripe-integration";
import * as db from "./db";
import { nanoid } from "nanoid";
import { broadcastEvent } from "./sse";
import { SUBSCRIPTION_TIERS } from "../shared/nervix-types";

// ─── Main Webhook Handler ──────────────────────────────────────

export async function handleStripeWebhook(req: Request, res: Response) {
  const signature = req.headers["stripe-signature"] as string;
  if (!signature) {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  let event: Stripe.Event;
  try {
    // req.body must be raw buffer for signature verification
    event = constructWebhookEvent(req.body, signature);
  } catch (err: any) {
    logger.warn("Stripe webhook: signature verification failed: %s", err.message);
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  logger.info("Stripe webhook: %s (id: %s)", event.type, event.id);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionCanceled(event.data.object as Stripe.Subscription);
        break;

      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case "charge.refunded":
        await handleRefund(event.data.object as Stripe.Charge);
        break;

      default:
        logger.debug("Stripe webhook: unhandled event type %s", event.type);
    }

    res.json({ received: true });
  } catch (err: any) {
    logger.error({ err }, "Stripe webhook: error processing %s", event.type);
    res.status(500).json({ error: "Webhook processing failed" });
  }
}

// ─── Event Handlers ────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const metadata = session.metadata || {};
  const type = metadata.type;

  if (type === "credit_purchase") {
    const packageId = metadata.package_id;
    const userId = parseInt(metadata.nervix_user_id || "0", 10);
    const agentId = metadata.agent_id || null;
    const pkg = getPackageById(packageId);

    if (!pkg || !userId) {
      logger.error("Stripe webhook: invalid credit_purchase metadata: %o", metadata);
      return;
    }

    // Extract payment intent ID (can be string or object)
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || null;

    // 1. Update checkout session status
    await db.updateStripeCheckoutSession(session.id, {
      status: "completed",
      stripePaymentIntentId: paymentIntentId,
      completedAt: new Date(),
    });

    // 2. Credit the user's agent (or first agent if no agentId specified)
    const targetAgentId = agentId || await db.getFirstAgentIdForUser(userId);
    if (targetAgentId) {
      await db.addCreditsToAgent(targetAgentId, String(pkg.credits));
      logger.info(
        "Stripe: Credited %d credits to agent %s (user %d, package %s)",
        pkg.credits,
        targetAgentId,
        userId,
        pkg.id
      );
    }

    // 3. Record fiat transaction
    await db.createFiatTransaction({
      transactionId: `ftx_${nanoid(20)}`,
      type: "credit_purchase",
      userId,
      agentId: targetAgentId,
      amountUsd: String(pkg.priceUsd),
      creditsAmount: String(pkg.credits),
      stripePaymentIntentId: paymentIntentId,
      stripeSessionId: session.id,
      memo: `Purchased ${pkg.label} via Stripe Checkout`,
    });

    // 4. Record in economic transactions for unified ledger
    await db.createEconomicTransaction({
      transactionId: `tx_${nanoid(20)}`,
      type: "deposit",
      toAgentId: targetAgentId,
      amount: String(pkg.credits),
      memo: `Fiat deposit: ${pkg.label} ($${pkg.priceUsd} USD)`,
    });

    // 5. Audit log
    await db.createAuditEntry({
      eventId: `evt_${nanoid(16)}`,
      eventType: "stripe.credit_purchase",
      actorId: String(userId),
      actorType: "system",
      action: `Credit purchase: ${pkg.credits} credits ($${pkg.priceUsd}) for agent ${targetAgentId}`,
      details: { packageId: pkg.id, sessionId: session.id, agentId: targetAgentId },
    });

    broadcastEvent("economy.transfer", {
      userId,
      agentId: targetAgentId,
      credits: pkg.credits,
      packageId: pkg.id,
      source: "stripe",
    });
  }
  // Subscription checkouts are handled by customer.subscription.created
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const metadata = subscription.metadata || {};
  const tierId = metadata.tier_id;
  const userId = parseInt(metadata.nervix_user_id || "0", 10);

  if (!tierId || !userId) {
    logger.warn("Stripe webhook: subscription missing metadata: %o", metadata);
    return;
  }

  // In Stripe SDK v20+, period info comes from billing_cycle_anchor + start_date
  const startDate = subscription.start_date
    ? new Date(subscription.start_date * 1000)
    : new Date();

  await db.upsertStripeSubscription({
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: subscription.customer as string,
    userId,
    tierId,
    status: subscription.status as any,
    currentPeriodStart: startDate,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });

  logger.info(
    "Stripe: Subscription %s updated: status=%s tier=%s user=%d",
    subscription.id,
    subscription.status,
    tierId,
    userId
  );
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  await db.updateStripeSubscriptionStatus(subscription.id, "canceled");
  logger.info("Stripe: Subscription %s canceled", subscription.id);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Grant monthly credits for subscription invoices
  // In Stripe v20, subscription is string | Subscription object
  const subscriptionId =
    typeof invoice.parent?.subscription_details?.subscription === "string"
      ? invoice.parent.subscription_details.subscription
      : invoice.parent?.subscription_details?.subscription || null;
  if (!subscriptionId) return;

  const sub = await db.getStripeSubscription(subscriptionId as string);
  if (!sub) return;

  const tier = SUBSCRIPTION_TIERS.find((t) => t.id === sub.tierId);
  if (!tier || tier.creditsPerMonth <= 0) return;

  // Credit the user's first agent
  const agentId = await db.getFirstAgentIdForUser(sub.userId);
  if (agentId) {
    await db.addCreditsToAgent(agentId, String(tier.creditsPerMonth));

    await db.createFiatTransaction({
      transactionId: `ftx_${nanoid(20)}`,
      type: "subscription_payment",
      userId: sub.userId,
      agentId,
      amountUsd: String(tier.priceUsd),
      creditsAmount: String(tier.creditsPerMonth),
      stripePaymentIntentId: invoice.id, // use invoice ID as reference
      memo: `Monthly ${tier.name} plan: ${tier.creditsPerMonth} credits`,
    });

    // Update credits granted this period
    await db.updateSubscriptionCreditsGranted(subscriptionId as string, String(tier.creditsPerMonth));

    logger.info(
      "Stripe: Granted %d monthly credits to agent %s (subscription %s)",
      tier.creditsPerMonth,
      agentId,
      subscriptionId
    );
  }
}

async function handleRefund(charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id || null;
  if (!paymentIntentId) return;

  // Find the original fiat transaction
  const originalTx = await db.getFiatTransactionByPaymentIntent(paymentIntentId);
  if (!originalTx) {
    logger.warn("Stripe webhook: refund for unknown PI %s", paymentIntentId);
    return;
  }

  // Deduct credits (best-effort — if agent spent them, balance may go negative)
  if (originalTx.agentId) {
    await db.deductCreditsFromAgent(originalTx.agentId, originalTx.creditsAmount);
  }

  // Record refund transaction
  await db.createFiatTransaction({
    transactionId: `ftx_${nanoid(20)}`,
    type: "refund",
    userId: originalTx.userId,
    agentId: originalTx.agentId,
    amountUsd: `-${originalTx.amountUsd}`,
    creditsAmount: `-${originalTx.creditsAmount}`,
    stripePaymentIntentId: paymentIntentId,
    memo: `Refund for ${originalTx.transactionId}`,
  });

  // Update checkout session status
  if (originalTx.stripeSessionId) {
    await db.updateStripeCheckoutSession(originalTx.stripeSessionId, { status: "refunded" });
  }

  logger.info("Stripe: Refund processed for PI %s, user %d", paymentIntentId, originalTx.userId);
}
