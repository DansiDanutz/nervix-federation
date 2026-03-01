import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

// Agent authentication middleware - validates Bearer token from agent_sessions
const requireAgent = t.middleware(async opts => {
  const { ctx, next } = opts;

  const authHeader = ctx.req?.headers?.authorization;
  if (!authHeader?.startsWith("Bearer at_")) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Missing or invalid agent token. Format: Bearer at_..."
    });
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  // Import here to avoid circular dependency
  const db = await import("../db.js");
  const session = await db.getAgentSessionByToken(token);

  if (!session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid agent token"
    });
  }

  if (session.isRevoked) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Agent token has been revoked"
    });
  }

  if (new Date() > session.accessTokenExpiresAt) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Agent token has expired"
    });
  }

  // Update last used timestamp for session activity tracking
  await db.updateAgentSessionLastUsed(session.sessionId);

  return next({
    ctx: {
      ...ctx,
      agentId: session.agentId,
      agentSession: session,
    },
  });
});

export const agentProcedure = t.procedure.use(requireAgent);
