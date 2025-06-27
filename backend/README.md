# WNBA Fantasy Analytics Backend

A comprehensive Node.js/Express API for WNBA fantasy analytics and player statistics.

## 🚀 Features

- **Complete ESPN Integration**: Real-time WNBA player stats and game data
- **Fantasy Scoring System**: Configurable scoring with ESPN default (pts-1, reb-1, ast-1, 3pt-1, blk-2, stl-2, to-0)
- **Individual Game Tracking**: Store every player's performance for historical analysis
- **Advanced Analytics**: Consistency metrics, trending analysis, and rolling averages
- **Automated Updates**: Scheduled data fetching and score calculations
- **REST API**: Full CRUD operations for players, games, and fantasy data

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL 12+
- Redis 6+
- Docker (recommended for databases)

## 🏗️ Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start databases with Docker:**
   ```bash
   docker-compose up -d
   ```

4. **Set up database schema:**
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

5. **Initialize with ESPN data:**
   ```bash
   npm run setup:database
   ```

## 🔧 Development

```bash
# Start development server
npm run dev

# Run type checking
npm run typecheck

# Run linting
npm run lint

# Run tests
npm run test

# Database tools
npm run prisma:studio
```

## 📊 Data Management Scripts

### Production Scripts

```bash
# Complete database setup with ESPN data
npm run setup:database

# Fetch latest ESPN data (incremental)
npm run fetch:espn

# Force refresh all data (clears and refetches)
npm run fetch:espn:force

# Quick database status check
npm run quick:check

# Update fantasy scores
npm run update:scores
```

### Available Endpoints

- `GET /api/players` - Get all players with stats
- `GET /api/players/:id/games` - Get player's recent games
- `GET /api/games` - Get all games
- `GET /api/fantasy/scores` - Get fantasy scores
- `POST /api/fantasy/scores` - Calculate scores

## 🗄️ Database Schema

### Core Tables

- **Players**: WNBA player profiles and metadata
- **Games**: Individual game records
- **PlayerStats**: Player performance in each game
- **PlayerFantasyScore**: Calculated fantasy points per game
- **ScoringConfiguration**: Customizable scoring systems

### Key Relationships

```
Player (1) -> (N) PlayerStats -> (1) Game
Player (1) -> (N) PlayerFantasyScore -> (1) ScoringConfiguration
```

## 🔄 Data Flow

1. **ESPN API** → Fetch games and player stats
2. **Database** → Store individual game performances  
3. **Fantasy Engine** → Calculate scores using configurable systems
4. **Analytics** → Generate trends, averages, and insights
5. **API** → Serve data to frontend applications

## 📈 Scoring System

**ESPN Default Configuration:**
- Points: 1 point each
- Rebounds: 1 point each  
- Assists: 1 point each
- 3-Pointers: 1 point each
- Blocks: 2 points each
- Steals: 2 points each
- Turnovers: 0 points (neutral)

## 🏛️ Architecture

```
├── src/
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Auth, validation, error handling
│   ├── routes/          # API route definitions
│   ├── services/        # Business logic (ESPN, players, etc.)
│   ├── jobs/            # Background tasks and calculations
│   ├── scripts/         # Database setup and maintenance
│   ├── config/          # Database, Redis, environment
│   └── utils/           # Helpers and utilities
├── prisma/              # Database schema and migrations
└── tests/               # Test suites
```

## 🔒 Security Features

- Helmet.js security headers
- CORS configuration
- Rate limiting
- Input validation
- JWT authentication (prepared)
- Environment variable validation

## 📊 Monitoring

The application includes comprehensive logging with Winston and structured error handling. Monitor these key metrics:

- ESPN API response times and success rates
- Database connection health
- Redis cache hit rates
- Fantasy score calculation performance

## 🚀 Deployment

### Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/wnba_fantasy"

# Redis  
REDIS_URL="redis://localhost:6379"

# Application
NODE_ENV="production"
PORT="4001"
JWT_SECRET="your-secret-key"

# ESPN API
ESPN_API_BASE_URL="https://site.api.espn.com/apis/site/v2/sports/basketball/wnba"
```

### Production Setup

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Start production server:**
   ```bash
   npm start
   ```

3. **Set up scheduled jobs:**
   ```bash
   # Add to crontab for regular data updates
   0 */4 * * * npm run fetch:espn
   0 2 * * * npm run update:scores
   ```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- player.test.ts
```

## 📝 API Documentation

The API follows REST conventions with JSON responses. All endpoints support:

- Proper HTTP status codes
- Consistent error response format
- Request/response validation
- Pagination for large datasets

For detailed API documentation, start the server and visit the generated OpenAPI docs.

## 🤝 Contributing

1. Follow the existing code style and patterns
2. Add tests for new functionality
3. Update documentation as needed
4. Ensure all linting and type checks pass

## 📄 License

MIT License - see LICENSE file for details.