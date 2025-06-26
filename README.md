# WNBA Fantasy Analytics Platform

A comprehensive web-based WNBA fantasy analytics tool providing player statistics, custom scoring, trade analysis, and daily waiver recommendations across three subscription tiers.

## Features

### Free Tier ($0/month)
- Current season player statistics
- Basic sorting and filtering
- Custom fantasy scoring configuration
- Team and player rankings

### Pro Tier ($14.99/month)
- All Free tier features
- Consistency scores with standard deviation analysis
- Hot player detection
- Trending minutes analysis
- Trade calculator with multi-player analysis

### Pro+ Tier ($24.99/month)
- All Pro tier features
- Daily waiver wire recommendations
- Injury status filtering
- Matchup difficulty analysis
- Advanced recommendation algorithms

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis
- **Authentication**: Google OAuth with NextAuth.js
- **Payments**: Stripe
- **Deployment**: DigitalOcean App Platform

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis
- Google OAuth credentials
- Stripe account

### Installation

1. Clone the repository
```bash
git clone https://github.com/your-username/wnba-fantasy-analytics.git
cd wnba-fantasy-analytics
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
# Copy example files
cp .env.example .env
cp frontend/.env.local.example frontend/.env.local
cp backend/.env.example backend/.env
```

4. Set up the database
```bash
# Run Prisma migrations
cd backend
npx prisma migrate dev
npx prisma generate
```

5. Start development servers
```bash
# From root directory
npm run dev
```

This will start:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## Project Structure

```
wnba-fantasy-analytics/
├── frontend/          # Next.js frontend application
├── backend/           # Express.js API server
├── worker/           # Background job processing
├── shared/           # Shared types and utilities
└── package.json      # Monorepo configuration
```

## API Documentation

The backend API provides endpoints for:
- `/api/auth/*` - Authentication
- `/api/players/*` - Player data and statistics
- `/api/scoring/*` - Scoring configurations
- `/api/trade/*` - Trade calculator
- `/api/waiver/*` - Waiver recommendations
- `/api/subscription/*` - Subscription management

## Deployment

The application is configured for deployment on DigitalOcean App Platform. See `.do/app.yaml` for configuration.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.