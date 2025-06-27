# 🚀 WNBA Fantasy Analytics - Local Development Setup

This guide will help you run the complete WNBA Fantasy Analytics platform locally to test all Pro/Pro+ features.

## 📋 Prerequisites

Before starting, ensure you have:
- **Node.js 18+** (`node --version`)
- **PostgreSQL 14+** (running locally or via Docker)
- **Redis** (running locally or via Docker)
- **Git** for cloning

## 🛠️ Quick Setup (Docker Method - Recommended)

### 1. Setup Databases with Docker

```bash
# Start PostgreSQL and Redis with Docker
docker run --name wnba-postgres -e POSTGRES_DB=wnba_fantasy -e POSTGRES_USER=wnba_user -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:15

docker run --name wnba-redis -p 6379:6379 -d redis:7-alpine

# Verify containers are running
docker ps
```

### 2. Clone and Install Dependencies

```bash
# Clone the repository (if not already cloned)
cd /Users/michaelchen/WNBA_Fantasy

# Install all dependencies (root, frontend, backend, shared)
npm install

# Build shared package first
npm run build:shared
```

### 3. Environment Configuration

```bash
# Copy environment template
cp backend/.env.example backend/.env

# Edit the .env file with your settings
nano backend/.env
```

**Edit `backend/.env` with these values:**
```env
# Database
DATABASE_URL="postgresql://wnba_user:postgres@localhost:5432/wnba_fantasy"

# Redis
REDIS_URL="redis://localhost:6379"

# Application
NODE_ENV="development"
PORT="4001"
JWT_SECRET="dev-jwt-secret-change-in-production"

# ESPN API
ESPN_API_BASE_URL="https://site.api.espn.com/apis/site/v2/sports/basketball/wnba"

# Frontend
FRONTEND_URL="http://localhost:4000"
ALLOWED_ORIGINS="http://localhost:4000"

# Optional (for testing subscriptions)
STRIPE_SECRET_KEY="sk_test_your_test_key"
GOOGLE_CLIENT_ID="your-google-client-id"
```

### 4. Database Setup

```bash
# Generate Prisma client
cd backend
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Optional: Seed with sample data
npm run prisma:seed
```

### 5. Start the Application

```bash
# From the root directory, start both frontend and backend
cd /Users/michaelchen/WNBA_Fantasy
npm run dev

# This will start:
# - Backend API: http://localhost:4001
# - Frontend: http://localhost:4000
```

## 🧪 Testing Pro/Pro+ Features

Once the application is running, you can test features in several ways:

### Method 1: API Testing with curl

```bash
# Test basic API health
curl http://localhost:4001/api/health

# Test waiver recommendations (requires authentication in real app)
curl http://localhost:4001/api/waiver/daily-recommendations

# Test hot player detection
curl http://localhost:4001/api/players/hot

# Test matchup analysis
curl http://localhost:4001/api/waiver/matchup/player_123
```

### Method 2: Run Feature Tests

```bash
# Run the comprehensive Pro/Pro+ feature tests
cd backend
npx ts-node src/scripts/test-pro-features.ts
npx ts-node src/scripts/test-advanced-scenarios.ts
npx ts-node src/scripts/test-api-responses.ts
```

### Method 3: Database Exploration

```bash
# Open Prisma Studio to view data
cd backend
npm run prisma:studio
# Opens http://localhost:5555
```

### Method 4: Frontend Testing

Visit these URLs in your browser:
- **Main App**: http://localhost:4000
- **Dashboard**: http://localhost:4000/dashboard
- **Player Analytics**: http://localhost:4000/players
- **Waiver Recommendations**: http://localhost:4000/waiver

## 📊 Loading Sample Data

To test with realistic data:

```bash
# Fetch ESPN data (creates players, games, stats)
cd backend
npm run fetch:espn

# Calculate fantasy scores
npm run update:scores

# Setup sample users and subscriptions
npm run setup:database
```

## 🔧 Advanced Development

### Individual Service Startup

```bash
# Start only backend
npm run dev:backend

# Start only frontend  
npm run dev:frontend

# Start backend with debug logging
DEBUG=* npm run dev:backend
```

### Database Management

```bash
# Reset database
cd backend
npx prisma migrate reset

# View database schema
npx prisma studio

# Generate new migration
npx prisma migrate dev --name add_new_feature
```

### Testing Specific Features

```bash
# Test waiver recommendation algorithm
cd backend
npx ts-node src/scripts/test-advanced-scenarios.ts

# Test ESPN API integration
npm run fetch:espn:force

# Test Pro+ algorithms manually
npx ts-node -e "
import { waiverService } from './src/services/waiverService';
waiverService.generateRecommendations('2025-01-26').then(console.log);
"
```

## 🎯 Feature Testing Checklist

### Pro Tier Features ($14.99/month)
- [ ] **Consistency Scores**: Navigate to `/players` and check consistency grades
- [ ] **Hot Player Detection**: Look for players with >15% improvement  
- [ ] **Trade Calculator**: Test multi-player trade analysis
- [ ] **Advanced Filtering**: Filter by position, team, performance

### Pro+ Tier Features ($24.99/month)  
- [ ] **Daily Waiver Recommendations**: Check `/waiver/recommendations`
- [ ] **Matchup Analysis**: View player vs opponent analysis
- [ ] **Injury Status Filtering**: See injury risk assessments
- [ ] **Custom Algorithm Weights**: Test different scoring priorities
- [ ] **Advanced Analytics**: View position breakdowns and trends

## 🔍 Troubleshooting

### Common Issues

**Database Connection Error:**
```bash
# Check PostgreSQL is running
docker ps | grep postgres
# Or start it
docker start wnba-postgres
```

**Redis Connection Error:**
```bash
# Check Redis is running  
docker ps | grep redis
# Or start it
docker start wnba-redis
```

**Build Errors:**
```bash
# Clean and rebuild
npm run clean  # If script exists
npm install
npm run build:shared
npm run build
```

**Port Already in Use:**
```bash
# Find and kill processes using ports 4000/4001
lsof -ti:4000 | xargs kill -9
lsof -ti:4001 | xargs kill -9
```

### Performance Testing

```bash
# Load test the waiver recommendations endpoint
for i in {1..10}; do
  curl -w "%{time_total}\n" -o /dev/null -s http://localhost:4001/api/waiver/daily-recommendations
done
```

### Monitoring

```bash
# View backend logs
cd backend
tail -f backend.log

# View Redis operations
docker exec -it wnba-redis redis-cli monitor
```

## 📱 Mobile Testing

Test responsive design:
```bash
# Use ngrok to expose local server
npx ngrok http 4000
# Access via mobile browser using ngrok URL
```

## 🚀 Production Simulation

To test in production-like environment:

```bash
# Build for production
npm run build

# Start in production mode
cd backend && npm start &
cd frontend && npm start &
```

## 🎉 You're Ready!

Your WNBA Fantasy Analytics platform is now running locally with all Pro/Pro+ features:

- **Frontend**: http://localhost:4000
- **Backend API**: http://localhost:4001  
- **Database Studio**: http://localhost:5555 (when running)
- **API Docs**: http://localhost:4001/api/docs (if implemented)

## 🔗 Quick Links

- **Test Pro Features**: `npx ts-node src/scripts/test-pro-features.ts`
- **Test Advanced Scenarios**: `npx ts-node src/scripts/test-advanced-scenarios.ts`  
- **View Database**: `npm run prisma:studio`
- **Fetch ESPN Data**: `npm run fetch:espn`
- **Update Fantasy Scores**: `npm run update:scores`

The platform is ready for comprehensive testing of all Pro and Pro+ tier features! 🎯