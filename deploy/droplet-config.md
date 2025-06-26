# DigitalOcean Droplet Deployment Guide

## Recommended Droplet Configuration

### Droplet Specs
- **Size**: Premium Intel (4 vCPUs, 8GB RAM, 160GB SSD) - $48/month
  - Can start with Basic (2 vCPUs, 4GB RAM) - $24/month for testing
- **Region**: Choose closest to your target audience (NYC, SFO, etc.)
- **OS**: Ubuntu 22.04 LTS
- **Authentication**: SSH keys (recommended)

### Additional Resources
- **Managed Database** (Optional but recommended for production):
  - PostgreSQL 15: Basic plan ($15/month)
  - Automated backups and high availability
- **Spaces** (Object Storage): For file uploads/backups ($5/month)
- **Load Balancer** (For scaling): $12/month

## Manual Deployment Steps

### 1. Create Droplet via DigitalOcean Console

1. Log in to DigitalOcean
2. Click "Create" → "Droplets"
3. Choose Ubuntu 22.04 LTS
4. Select droplet size (4GB RAM minimum recommended)
5. Choose datacenter region
6. Add SSH keys
7. Enable backups (recommended)
8. Set hostname: `wnba-fantasy-app`
9. Click "Create Droplet"

### 2. Initial Server Setup

SSH into your droplet:
```bash
ssh root@your-droplet-ip
```

Create a non-root user:
```bash
adduser deploy
usermod -aG sudo deploy
su - deploy
```

### 3. Set Environment Variables

Before running the setup script, export required variables:

```bash
export DOMAIN="your-domain.com"
export EMAIL="your-email@example.com"
export GITHUB_USER="your-github-username"
export DB_PASSWORD="secure-database-password"
export JWT_SECRET="your-jwt-secret"
export NEXTAUTH_SECRET="your-nextauth-secret"
export STRIPE_SECRET_KEY="sk_live_..."
export STRIPE_PUBLISHABLE_KEY="pk_live_..."
export STRIPE_WEBHOOK_SECRET="whsec_..."
export STRIPE_PRO_PRICE_ID="price_..."
export STRIPE_PRO_PLUS_PRICE_ID="price_..."
export GOOGLE_CLIENT_ID="your-google-client-id"
export GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### 4. Run Setup Script

```bash
# Download and run setup script
wget https://raw.githubusercontent.com/your-username/wnba-fantasy/main/deploy/setup-droplet.sh
chmod +x setup-droplet.sh
./setup-droplet.sh
```

### 5. Post-Setup Configuration

#### Configure Domain DNS
Point your domain to the droplet IP:
- A Record: @ → droplet-ip
- A Record: www → droplet-ip

#### Setup Monitoring
```bash
# Install monitoring agent
curl -sSL https://repos.insights.digitalocean.com/install.sh | sudo bash

# Setup log rotation
sudo tee /etc/logrotate.d/wnba-fantasy <<EOF
/var/www/wnba-fantasy/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 deploy deploy
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
```

#### Setup Automated Backups
```bash
# Create backup script
cat > /home/deploy/backup.sh <<'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/deploy/backups"
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U wnba_user wnba_fantasy | gzip > $BACKUP_DIR/db_backup_$DATE.sql.gz

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete
EOF

chmod +x /home/deploy/backup.sh

# Add to crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /home/deploy/backup.sh") | crontab -
```

## Security Hardening

### 1. Configure Firewall (already in script)
```bash
sudo ufw status
```

### 2. Setup Fail2ban
```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 3. Configure SSH
```bash
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/g' /etc/ssh/sshd_config
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/g' /etc/ssh/sshd_config
sudo systemctl restart sshd
```

## Scaling Considerations

### Vertical Scaling
- Resize droplet through DigitalOcean console
- Minimal downtime (1-2 minutes)

### Horizontal Scaling
1. Add Load Balancer
2. Create additional droplets
3. Configure shared Redis/PostgreSQL
4. Use DigitalOcean Spaces for shared storage

### Database Scaling
Consider moving to Managed Database when:
- Traffic increases significantly
- Need automated backups
- Require high availability

## Monitoring & Maintenance

### Health Checks
```bash
# Check services
pm2 status

# Check logs
pm2 logs wnba-backend
pm2 logs wnba-frontend

# Check system resources
htop

# Check disk usage
df -h
```

### Updates
```bash
# Update application
cd /var/www/wnba-fantasy
git pull
npm install
npm run build
pm2 restart all

# Update system
sudo apt update && sudo apt upgrade
```

## Cost Breakdown

### Basic Setup (Development/Testing)
- Droplet (2GB): $12/month
- Total: $12/month

### Recommended Production Setup
- Droplet (8GB): $48/month
- Managed PostgreSQL: $15/month
- Spaces + CDN: $5/month
- Backups: $9.60/month (20% of droplet cost)
- **Total: ~$78/month**

### High-Traffic Setup
- Load Balancer: $12/month
- 2x Droplets (8GB each): $96/month
- Managed PostgreSQL (4GB): $60/month
- Redis Cluster: $60/month
- Spaces + CDN: $5/month
- **Total: ~$233/month**