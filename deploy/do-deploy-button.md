# Deploy to DigitalOcean

[![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/mchen04/WNBA_Fantasy/tree/main)

## Manual Setup Steps

1. Click the button above
2. Connect your GitHub account
3. Configure environment variables:
   - Generate JWT_SECRET: `openssl rand -hex 32`
   - Generate NEXTAUTH_SECRET: `openssl rand -hex 32`
   - Add your Stripe keys (get from Stripe Dashboard)
   - Add your Google OAuth credentials
4. Deploy!

## Post-Deployment

After deployment, you'll need to:
1. Set up a PostgreSQL database
2. Run migrations
3. Configure your domain (optional)