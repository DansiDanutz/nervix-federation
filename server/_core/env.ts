/**
 * Environment Variable Validation
 *
 * Validates all required environment variables at startup.
 * Throws descriptive errors if validation fails.
 *
 * @module server/_core/env
 */

import { z } from "zod";

/**
 * Zod schema for all environment variables
 */
const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  // Database
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),

  // Authentication
  JWT_SECRET: z
    .string()
    .min(64, "JWT_SECRET must be at least 64 characters for security")
    .refine(
      (val) => !["secret", "password", "jwtsecret"].includes(val.toLowerCase()),
      "JWT_SECRET cannot use common values (secret, password, jwtsecret)"
    ),

  // Supabase
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_SERVICE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_KEY is required")
    .refine((val) => val.startsWith("eyJ") || val.startsWith("service_role"), "SUPABASE_SERVICE_KEY must be a valid Supabase key"),

  // TON Blockchain
  TON_CONTRACT_ADDRESS: z
    .string()
    .length(66, "TON_CONTRACT_ADDRESS must be 66 hex characters")
    .regex(/^[0-9a-fA-F]{66}$/, "TON_CONTRACT_ADDRESS must be a valid hex address")
    .optional(),
  TON_NETWORK: z.enum(["mainnet", "testnet"]).default("mainnet").optional(),

  // Manus OAuth
  OWNER_OPEN_ID: z
    .string()
    .min(1, "OWNER_OPEN_ID is required")
    .optional(),

  // External APIs
  CLAWHUB_API_TOKEN: z.string().min(1).optional(),
  BUILT_IN_FORGE_API_URL: z.string().url().optional(),
  BUILT_IN_FORGE_API_KEY: z.string().min(1).optional(),

  // Stripe (optional for now)
  STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),

  // Telegram (optional)
  TELEGRAM_BOT_TOKEN: z.string().regex(/^\d+:[A-Za-z0-9_-]{35}$/).optional(),
  TELEGRAM_ALERT_CHAT_ID: z.string().min(1).optional(),

  // Security
  TRUST_PROXY: z.coerce.boolean().default(true),
  ENABLE_DEBUG_LOGGING: z.coerce.boolean().default(false),

  // Feature Flags
  ENABLE_STRIPE: z.coerce.boolean().default(false),
  ENABLE_TELEGRAM: z.coerce.boolean().default(false),
  ENABLE_YOUTUBE: z.coerce.boolean().default(false),
});

/**
 * Validated environment variables
 */
let _env: z.infer<typeof envSchema> | null = null;

/**
 * Validates and returns environment variables
 * Caches the result for subsequent calls
 *
 * @returns Validated environment variables
 * @throws Error if validation fails
 */
export function validateEnv(): z.infer<typeof envSchema> {
  if (_env) {
    return _env;
  }

  try {
    _env = envSchema.parse(process.env);
    return _env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((e) => {
        const path = e.path.join(".");
        return `  ❌ ${path}: ${e.message}`;
      }).join("\n");

      throw new Error(
        `Environment validation failed:\n${errors}\n\n` +
        `Required variables:\n` +
        `  - DATABASE_URL (PostgreSQL connection string)\n` +
        `  - JWT_SECRET (>= 64 characters, not a common value)\n` +
        `  - SUPABASE_URL (e.g., https://xxx.supabase.co)\n` +
        `  - SUPABASE_SERVICE_KEY (service_role key)\n` +
        `  - OWNER_OPEN_ID (Manus Open ID)\n\n` +
        `Optional variables:\n` +
        `  - TON_CONTRACT_ADDRESS (66 hex characters)\n` +
        `  - CLAWHUB_API_TOKEN\n` +
        `  - STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET\n` +
        `  - TELEGRAM_BOT_TOKEN, TELEGRAM_ALERT_CHAT_ID`
      );
    }
    throw error;
  }
}

/**
 * Gets a single environment variable
 * Type-safe access to environment variables
 *
 * @param key - Environment variable name
 * @returns Environment variable value
 */
export function env<T extends keyof z.infer<typeof envSchema>>(
  key: T
): z.infer<typeof envSchema>[T] {
  const e = validateEnv();
  return e[key];
}

/**
 * Re-exports all environment variables for convenience
 */
export { validateEnv as default };

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return validateEnv().NODE_ENV === "production";
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return validateEnv().NODE_ENV === "development";
}

/**
 * Check if running in test
 */
export function isTest(): boolean {
  return validateEnv().NODE_ENV === "test";
}
