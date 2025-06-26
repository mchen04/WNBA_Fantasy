#!/bin/bash

# WNBA Fantasy Analytics - DigitalOcean Droplet Setup Script
# This script sets up a Ubuntu droplet with all required services

set -e

echo "🚀 Starting WNBA Fantasy Analytics setup..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
echo "🟢 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL 15
echo "🐘 Installing PostgreSQL..."
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget -qO- https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo tee /etc/apt/trusted.gpg.d/pgdg.asc &>/dev/null
sudo apt update
sudo apt install -y postgresql-15 postgresql-client-15

# Install Redis
echo "🔴 Installing Redis..."
sudo apt install -y redis-server

# Install nginx
echo "🌐 Installing Nginx..."
sudo apt install -y nginx

# Install PM2
echo "🔄 Installing PM2..."
sudo npm install -g pm2

# Install certbot for SSL
echo "🔒 Installing Certbot..."
sudo snap install core; sudo snap refresh core
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot

# Setup PostgreSQL
echo "🗄️ Setting up PostgreSQL..."
sudo -u postgres psql <<EOF
CREATE USER wnba_user WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE wnba_fantasy OWNER wnba_user;
GRANT ALL PRIVILEGES ON DATABASE wnba_fantasy TO wnba_user;
EOF

# Configure Redis
echo "⚙️ Configuring Redis..."
sudo sed -i 's/supervised no/supervised systemd/g' /etc/redis/redis.conf
sudo systemctl restart redis.service
sudo systemctl enable redis.service

# Create application directory
echo "📁 Creating application directory..."
sudo mkdir -p /var/www/wnba-fantasy
sudo chown -R $USER:$USER /var/www/wnba-fantasy

# Clone repository
echo "📥 Cloning repository..."
cd /var/www/wnba-fantasy
git clone https://github.com/$GITHUB_USER/wnba-fantasy-analytics.git .

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build shared package
echo "🔨 Building shared package..."
npm run build:shared

# Setup environment files
echo "🔐 Setting up environment files..."
cat > .env <<EOL
NODE_ENV=production
DATABASE_URL=postgresql://wnba_user:$DB_PASSWORD@localhost:5432/wnba_fantasy
REDIS_URL=redis://localhost:6379
EOL

cat > backend/.env <<EOL
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://wnba_user:$DB_PASSWORD@localhost:5432/wnba_fantasy
REDIS_URL=redis://localhost:6379
JWT_SECRET=$JWT_SECRET
STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=$STRIPE_WEBHOOK_SECRET
STRIPE_PRO_PRICE_ID=$STRIPE_PRO_PRICE_ID
STRIPE_PRO_PLUS_PRICE_ID=$STRIPE_PRO_PLUS_PRICE_ID
ESPN_API_BASE_URL=https://site.api.espn.com/apis/site/v2/sports/basketball/wnba
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
FRONTEND_URL=https://$DOMAIN
ALLOWED_ORIGINS=https://$DOMAIN
EOL

cat > frontend/.env.local <<EOL
NEXT_PUBLIC_API_URL=https://$DOMAIN/api
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$STRIPE_PUBLISHABLE_KEY
NEXT_PUBLIC_GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
NEXTAUTH_URL=https://$DOMAIN
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET
DATABASE_URL=postgresql://wnba_user:$DB_PASSWORD@localhost:5432/wnba_fantasy
EOL

# Run database migrations
echo "🗄️ Running database migrations..."
cd backend
npx prisma migrate deploy
npx prisma generate
cd ..

# Build applications
echo "🔨 Building applications..."
npm run build:backend
npm run build:frontend

# Setup PM2
echo "🔄 Setting up PM2..."
cat > ecosystem.config.js <<EOL
module.exports = {
  apps: [
    {
      name: 'wnba-backend',
      script: './backend/dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    },
    {
      name: 'wnba-frontend',
      script: 'npm',
      args: 'start',
      cwd: './frontend',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'wnba-worker',
      script: './worker/dist/index.js',
      instances: 1,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
EOL

# Start applications with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Configure Nginx
echo "🌐 Configuring Nginx..."
sudo tee /etc/nginx/sites-available/wnba-fantasy <<EOL
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOL

sudo ln -s /etc/nginx/sites-available/wnba-fantasy /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Setup SSL
echo "🔒 Setting up SSL..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $EMAIL

# Setup firewall
echo "🔥 Setting up firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

echo "✅ Setup complete! Your WNBA Fantasy Analytics platform is ready."
echo "🌐 Access your site at: https://$DOMAIN"
echo "📊 PM2 status: pm2 status"
echo "📝 View logs: pm2 logs"