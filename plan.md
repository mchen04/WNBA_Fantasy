# WNBA Fantasy Analytics Platform - Implementation Plan

## Project Overview
A web-based WNBA fantasy analytics tool providing player statistics, custom scoring, trade analysis, and daily waiver recommendations across three subscription tiers.

## High-Level Architecture

### Three-Tier Web Application Structure
```
Frontend (React/Next.js)
├── Authentication (Google OAuth)
├── Dashboard & Analytics UI
├── Payment Integration (Stripe)
└── Responsive Design

API Layer (Node.js/Express or Python/FastAPI)
├── ESPN API Integration Service
├── Fantasy Scoring Engine
├── Trade Calculator Logic
├── Daily Recommendations Algorithm
└── User Management & Subscription Logic

Database Layer (PostgreSQL)
├── User Data & Subscriptions
├── Player Statistics & Performance
├── Fantasy Scoring Configurations
└── Analytics & Caching Tables
```

## Feature Breakdown by Subscription Tier

### Free Tier ($0/month)
**Core WNBA Stats Access**
- Current season player statistics
- Basic sorting and filtering
- Default fantasy scoring system (Points: 1, Rebounds: 1, Assists: 1, Blocks: 2, Steals: 2, 3PT: 1)
- Custom fantasy scoring configuration
- Team and player rankings based on fantasy scores
- Season totals and per-game averages

### Pro Tier ($14.99/month)
**Advanced Analytics**
- All Free tier features
- **Consistency Scores**: Standard deviation analysis of fantasy performance over configurable periods (7, 14, 30 days)
- **Hot Player Detection**: Players performing above season average in last X days (user configurable: 5, 7, 10, 14 days)
- **Trending Minutes Analysis**: Players with increasing playing time vs season average
- **Trade Calculator**: 
  - Multi-player trade analysis
  - Value assessment based on fantasy scores, consistency, and trends
  - Extra roster slot value calculation (filtered from top 50 fantasy players)
  - Trade impact projections

### Pro+ Tier ($24.99/month)
**Premium Recommendations**
- All Pro tier features
- **Daily Waiver Wire Recommendations**:
  - Top 10 available players for current game day
  - Excludes top X players (default 50, user configurable)
  - Injury status filtering
  - Hot streak consideration in recommendations
  - Matchup difficulty analysis
- **Advanced Algorithms**: Enhanced recommendation engine with multiple weighted factors

## Technical Implementation

### Data Pipeline
**ESPN API Integration**
- Automated data collection every 30 minutes during WNBA season
- Player statistics, game schedules, injury reports
- Real-time game data and box scores
- Data validation and error handling

**Database Schema**
```sql
-- Core Tables
users (id, google_id, email, subscription_tier, created_at)
subscriptions (id, user_id, stripe_subscription_id, status, current_period_end)
players (id, name, team, position, espn_id, active_status)
games (id, date, home_team, away_team, status)
player_stats (id, player_id, game_id, date, points, rebounds, assists, blocks, steals, three_pointers, minutes)

-- Analytics Tables
player_fantasy_scores (id, player_id, date, fantasy_points, scoring_config_id)
consistency_metrics (id, player_id, date, std_dev_7d, std_dev_14d, std_dev_30d)
trending_analysis (id, player_id, date, minutes_trend, performance_trend)
scoring_configurations (id, user_id, points_value, rebounds_value, assists_value, blocks_value, steals_value, threes_value)
```

### Core Algorithms

**Fantasy Scoring Engine**
```python
def calculate_fantasy_score(stats, config):
    return (
        stats.points * config.points_multiplier +
        stats.rebounds * config.rebounds_multiplier +
        stats.assists * config.assists_multiplier +
        stats.blocks * config.blocks_multiplier +
        stats.steals * config.steals_multiplier +
        stats.three_pointers * config.threes_multiplier
    )
```

**Consistency Score Calculation**
```python
def calculate_consistency(player_scores, days=14):
    recent_scores = player_scores.filter(date__gte=today - timedelta(days=days))
    return {
        'std_dev': statistics.stdev(recent_scores),
        'coefficient_variation': statistics.stdev(recent_scores) / statistics.mean(recent_scores),
        'consistency_grade': grade_consistency(statistics.stdev(recent_scores))
    }
```

**Hot Player Detection**
```python
def identify_hot_players(player_id, days=7):
    recent_avg = get_recent_average(player_id, days)
    season_avg = get_season_average(player_id)
    hot_factor = (recent_avg - season_avg) / season_avg
    return hot_factor > 0.15  # 15% above season average
```

**Trade Calculator Logic**
```python
def calculate_trade_value(players_in, players_out):
    total_value_in = sum([get_player_composite_value(p) for p in players_in])
    total_value_out = sum([get_player_composite_value(p) for p in players_out])
    
    # Account for roster slot premium
    slot_difference = len(players_out) - len(players_in)
    slot_value = calculate_waiver_wire_value() * slot_difference
    
    return {
        'net_value': total_value_in - total_value_out + slot_value,
        'recommendation': 'Accept' if net_value > 0 else 'Decline',
        'confidence': calculate_confidence_score(players_in + players_out)
    }
```

**Daily Waiver Recommendations**
```python
def generate_daily_recommendations(exclude_top_n=50):
    today_games = get_games_for_date(today)
    playing_today = get_players_in_games(today_games)
    
    # Filter out top players and injured
    available_players = (playing_today
                        .exclude(fantasy_rank__lte=exclude_top_n)
                        .exclude(injury_status__in=['OUT', 'DOUBTFUL']))
    
    # Score based on multiple factors
    for player in available_players:
        player.recommendation_score = (
            player.projected_fantasy_points * 0.4 +
            player.hot_factor * 0.3 +
            player.minutes_trend * 0.2 +
            player.matchup_favorability * 0.1
        )
    
    return available_players.order_by('-recommendation_score')[:10]
```

## Technology Stack Recommendations

### Frontend
- **Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand or Redux Toolkit
- **Charts**: Recharts or Chart.js
- **Authentication**: NextAuth.js with Google Provider

### Backend
- **API**: Node.js with Express.js (or Python with FastAPI)
- **Database**: PostgreSQL 15+
- **ORM**: Prisma (Node.js) or SQLAlchemy (Python)
- **Caching**: Redis for frequently accessed data
- **Queue**: Bull.js for background jobs (data fetching)

### Infrastructure (DigitalOcean Ecosystem)
- **Hosting**: DigitalOcean App Platform (Frontend + Backend)
- **Database**: DigitalOcean Managed PostgreSQL
- **Cache**: DigitalOcean Managed Redis
- **Storage**: DigitalOcean Spaces (for any file storage needs)
- **CDN**: DigitalOcean CDN
- **Monitoring**: DigitalOcean Monitoring + Sentry for error tracking
- **Payments**: Stripe Checkout + Webhook handling
- **Analytics**: Mixpanel or PostHog

## Development Phases

### Phase 1: Foundation (Weeks 1-3)
- Set up development environment and CI/CD
- Implement user authentication with Google OAuth
- Create basic database schema and migrations
- Build ESPN API integration service
- Develop core fantasy scoring engine

### Phase 2: Free Tier Features (Weeks 4-6)
- Player statistics dashboard
- Custom scoring configuration
- Basic sorting and filtering
- Fantasy rankings and leaderboards
- Responsive UI implementation

### Phase 3: Pro Tier Features (Weeks 7-9)
- Consistency score calculations
- Hot player detection algorithms
- Minutes trending analysis
- Trade calculator functionality
- Advanced filtering and analytics

### Phase 4: Pro+ Features (Weeks 10-11)
- Daily waiver wire recommendation engine
- Injury status integration
- Matchup analysis algorithms
- Advanced recommendation scoring

### Phase 5: Payment & Polish (Weeks 12-13)
- Stripe integration and subscription management
- User subscription tier enforcement
- Performance optimization and caching
- Testing and bug fixes
- Production deployment

## Subscription Management

### Stripe Integration
```javascript
// Subscription tiers
const PRICING_PLANS = {
  free: { price: 0, features: ['basic_stats', 'custom_scoring'] },
  pro: { 
    price: 1499, // $14.99 in cents
    stripe_price_id: 'price_pro_monthly',
    features: ['consistency', 'hot_players', 'trade_calculator'] 
  },
  pro_plus: { 
    price: 2499, // $24.99 in cents
    stripe_price_id: 'price_pro_plus_monthly',
    features: ['daily_recommendations', 'advanced_algorithms'] 
  }
};
```

### Feature Access Control
```javascript
const hasAccess = (userTier, requiredFeature) => {
  const tierFeatures = {
    free: ['basic_stats', 'custom_scoring'],
    pro: ['basic_stats', 'custom_scoring', 'consistency', 'hot_players', 'trade_calculator'],
    pro_plus: ['basic_stats', 'custom_scoring', 'consistency', 'hot_players', 'trade_calculator', 'daily_recommendations']
  };
  
  return tierFeatures[userTier]?.includes(requiredFeature) || false;
};
```

## Performance Considerations

### Data Caching Strategy
- Cache player statistics for 15 minutes
- Cache fantasy rankings for 5 minutes
- Cache consistency scores for 1 hour
- Pre-calculate daily recommendations at 6 AM EST

### Database Optimization
- Index on frequently queried columns (player_id, date, fantasy_score)
- Partitioning for large stats tables by month
- Database connection pooling
- Read replicas for analytics queries

## Security & Compliance

### Data Protection
- Secure API endpoints with authentication middleware
- Rate limiting on ESPN API calls
- Input validation and sanitization
- Webhook signature verification for Stripe

### User Privacy
- Minimal data collection (Google ID, email, subscription status)
- GDPR-compliant data handling
- Secure session management
- Regular security audits

## Launch Strategy

### MVP Requirements
- Functional Free tier with all promised features
- Stable ESPN API integration
- Working payment system for Pro tiers
- Mobile-responsive design

### Success Metrics
- User acquisition rate
- Conversion rate from Free to Pro tiers
- Feature usage analytics
- Customer satisfaction scores
- Monthly recurring revenue (MRR)

## DigitalOcean Deployment Strategy

### DigitalOcean App Platform Benefits
- **Unified Management**: Single platform for frontend and backend
- **Auto-scaling**: Handles traffic spikes automatically
- **Built-in CI/CD**: GitHub integration for automatic deployments
- **Cost Efficiency**: More predictable pricing than AWS/Vercel combo
- **Simplified Database**: Managed PostgreSQL with automatic backups

### Deployment Architecture
```
DigitalOcean App Platform
├── Frontend Service (Next.js)
│   ├── Static site generation
│   ├── Edge caching
│   └── Custom domain + SSL
├── Backend Service (Node.js API)
│   ├── ESPN API integration
│   ├── Fantasy scoring engine
│   ├── Stripe webhook handling
│   └── Background job processing
└── Worker Service (Data fetching)
    ├── Scheduled ESPN API calls
    ├── Daily recommendation generation
    └── Analytics calculations

DigitalOcean Managed Services
├── PostgreSQL Database (Production + Staging)
├── Redis Cache (Session + data caching)
├── Spaces Object Storage (logs, backups)
└── Load Balancer (for high availability)
```

### Cost Optimization
**Estimated Monthly Costs:**
- App Platform (Pro): $12/month (frontend)
- App Platform (Pro): $12/month (backend)
- App Platform (Basic): $5/month (worker)
- Managed PostgreSQL (Basic): $15/month
- Managed Redis (Basic): $15/month
- **Total**: ~$59/month for production environment

### Deployment Configuration
```yaml
# .do/app.yaml
name: wnba-analytics
services:
- name: frontend
  source_dir: /frontend
  github:
    repo: your-username/wnba-analytics
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  
- name: backend
  source_dir: /backend
  github:
    repo: your-username/wnba-analytics
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xs
  envs:
  - key: DATABASE_URL
    scope: RUN_AND_BUILD_TIME
    type: SECRET
  - key: STRIPE_SECRET_KEY
    scope: RUN_TIME
    type: SECRET

- name: worker
  source_dir: /worker
  github:
    repo: your-username/wnba-analytics
    branch: main
  run_command: npm run worker
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs

databases:
- name: wnba-db
  engine: PG
  version: "15"
  
- name: wnba-cache
  engine: REDIS
  version: "7"
```
**Total Duration**: 13 weeks
**Team Size**: 2-3 developers (1 full-stack, 1 frontend specialist, 1 backend/data engineer)
**Budget Estimate**: $45,000 - $65,000 for development + $59/month operational costs (DigitalOcean)

## Post-Launch Roadmap
- Historical data integration (previous seasons)
- Mobile app development
- Advanced machine learning recommendations
- Social features (leagues, discussions)
- API access for enterprise customers