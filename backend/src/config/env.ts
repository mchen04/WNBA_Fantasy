import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001').transform(Number),
  
  // Database
  DATABASE_URL: z.string().url(),
  
  // Redis
  REDIS_URL: z.string().url(),
  
  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  
  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  STRIPE_PRO_PRICE_ID: z.string().startsWith('price_'),
  STRIPE_PRO_PLUS_PRICE_ID: z.string().startsWith('price_'),
  
  // ESPN API
  ESPN_API_KEY: z.string().optional(),
  ESPN_API_BASE_URL: z.string().url(),
  
  // Google OAuth
  GOOGLE_CLIENT_ID: z.string(),
  
  // CORS
  FRONTEND_URL: z.string().url(),
  ALLOWED_ORIGINS: z.string().transform((val) => val.split(',')),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100').transform(Number),
  
  // Jobs
  ENABLE_BACKGROUND_JOBS: z.string().default('true').transform((val) => val === 'true'),
  DATA_FETCH_CRON: z.string().default('*/30 * * * *'),
  DAILY_RECOMMENDATIONS_CRON: z.string().default('0 6 * * *'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE_PATH: z.string().optional(),
  
  // Sentry
  SENTRY_DSN: z.string().optional(),
});

const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:');
      error.errors.forEach((err) => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
};

const env = parseEnv();

export const config = {
  env: env.NODE_ENV,
  port: env.PORT,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  
  database: {
    url: env.DATABASE_URL,
  },
  
  redis: {
    url: env.REDIS_URL,
  },
  
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },
  
  stripe: {
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    proPriceId: env.STRIPE_PRO_PRICE_ID,
    proPlusPriceId: env.STRIPE_PRO_PLUS_PRICE_ID,
  },
  
  espn: {
    apiKey: env.ESPN_API_KEY,
    baseUrl: env.ESPN_API_BASE_URL,
  },
  
  google: {
    clientId: env.GOOGLE_CLIENT_ID,
  },
  
  cors: {
    frontendUrl: env.FRONTEND_URL,
    allowedOrigins: env.ALLOWED_ORIGINS,
  },
  
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },
  
  jobs: {
    enabled: env.ENABLE_BACKGROUND_JOBS,
    dataFetchCron: env.DATA_FETCH_CRON,
    dailyRecommendationsCron: env.DAILY_RECOMMENDATIONS_CRON,
  },
  
  logging: {
    level: env.LOG_LEVEL,
    filePath: env.LOG_FILE_PATH,
  },
  
  sentry: {
    dsn: env.SENTRY_DSN,
  },
} as const;

export type Config = typeof config;