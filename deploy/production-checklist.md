# Production Deployment Checklist

## 1. Required Environment Variables

### Backend (.env)
```bash
# Database
DATABASE_URL="postgresql://[user]:[password]@[host]:5432/[database]?sslmode=require"
REDIS_URL="rediss://default:[password]@[host]:6379"

# Security
JWT_SECRET="[generate-with: openssl rand -hex 32]"
NEXTAUTH_SECRET="[generate-with: openssl rand -hex 32]"

# Stripe (Get from Stripe Dashboard)
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRO_PRICE_ID="price_..."
STRIPE_PRO_PLUS_PRICE_ID="price_..."

# Google OAuth (Get from Google Cloud Console)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Application
FRONTEND_URL="https://your-domain.com"
ALLOWED_ORIGINS="https://your-domain.com"
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL="https://api.your-domain.com"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."
NEXT_PUBLIC_GOOGLE_CLIENT_ID="..."
NEXTAUTH_URL="https://your-domain.com"
```

## 2. Pre-Deployment Steps

- [ ] Create GitHub repository and push code
- [ ] Set up Stripe account and create subscription products
- [ ] Create Google OAuth app in Google Cloud Console
- [ ] Purchase domain and configure DNS
- [ ] Generate all secret keys

## 3. DigitalOcean Setup

### Create App
```bash
# Update deploy/app.yaml with:
- Your GitHub repo URL
- Your domain name
- All environment variables

# Create app via CLI
doctl apps create --spec deploy/app.yaml
```

### Database Migration Strategy
The Dockerfile is configured to run migrations automatically on deploy.

### Manual Database Commands (if needed)
```bash
# Connect to app console
doctl apps console [app-id] --component backend

# Run migrations manually
npx prisma migrate deploy

# Seed database (first time only)
npx tsx prisma/seed.ts
```

## 4. Post-Deployment Verification

- [ ] Test Google OAuth login
- [ ] Test Stripe subscription flow
- [ ] Verify database connectivity
- [ ] Check Redis caching
- [ ] Monitor logs for errors
- [ ] Test all API endpoints
- [ ] Verify CORS settings

## 5. Monitoring Setup

- [ ] Set up DigitalOcean alerts
- [ ] Configure Sentry error tracking
- [ ] Set up uptime monitoring
- [ ] Configure backup strategy

## 6. Security Checklist

- [ ] SSL certificate active
- [ ] Environment variables secure
- [ ] Rate limiting configured
- [ ] CORS properly restricted
- [ ] Database connections encrypted
- [ ] Secrets rotated from defaults