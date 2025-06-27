# WNBA Fantasy Analytics API Documentation

## Base URL
```
http://localhost:4001/api
```

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Response Format
All API responses follow this structure:
```json
{
  "success": true,
  "data": { ... },
  "message": "Success message",
  "pagination": { // Only for paginated endpoints
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

## Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": { ... } // Optional additional details
  }
}
```

## Endpoints

### Players

#### Get All Players
```http
GET /api/players
```

**Query Parameters:**
- `page` (number, optional): Page number for pagination (default: 1)
- `limit` (number, optional): Items per page (default: 20, max: 100)
- `team` (string, optional): Filter by team abbreviation
- `position` (string, optional): Filter by position (G, F, C)
- `active` (boolean, optional): Filter by active status

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "espnId": "12345",
      "name": "A'ja Wilson",
      "firstName": "A'ja",
      "lastName": "Wilson",
      "team": "LV",
      "position": "F",
      "jerseyNumber": "22",
      "height": "6'4\"",
      "weight": 195,
      "yearsExperience": 6,
      "college": "South Carolina",
      "activeStatus": true,
      "photoUrl": "https://...",
      "stats": {
        "gamesPlayed": 28,
        "averages": {
          "points": 27.3,
          "rebounds": 11.9,
          "assists": 2.3,
          "steals": 1.8,
          "blocks": 2.2
        }
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 171,
    "pages": 9
  }
}
```

#### Get Player Details
```http
GET /api/players/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "A'ja Wilson",
    "team": "LV",
    // ... full player details
    "recentGames": [
      {
        "date": "2025-06-26",
        "opponent": "CONN",
        "stats": {
          "points": 25,
          "rebounds": 12,
          "assists": 3,
          "minutes": 35
        }
      }
    ],
    "seasonAverages": {
      "points": 27.3,
      "rebounds": 11.9,
      "assists": 2.3
    }
  }
}
```

#### Get Player Game Log
```http
GET /api/players/:id/games
```

**Query Parameters:**
- `limit` (number, optional): Number of recent games (default: 10, max: 50)
- `season` (number, optional): Season year (default: current season)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "gameId": "uuid",
      "date": "2025-06-26",
      "opponent": "CONN",
      "homeAway": "home",
      "result": "W",
      "score": "85-78",
      "stats": {
        "minutes": 35,
        "points": 25,
        "rebounds": 12,
        "assists": 3,
        "steals": 2,
        "blocks": 3,
        "turnovers": 2,
        "fieldGoalsMade": 10,
        "fieldGoalsAttempted": 18,
        "threePointersMade": 1,
        "threePointersAttempted": 3,
        "freeThrowsMade": 4,
        "freeThrowsAttempted": 5
      },
      "fantasyPoints": 42.0
    }
  ]
}
```

### Games

#### Get All Games
```http
GET /api/games
```

**Query Parameters:**
- `page` (number, optional): Page number
- `limit` (number, optional): Items per page
- `season` (number, optional): Filter by season
- `status` (string, optional): Filter by status (SCHEDULED, LIVE, FINAL)
- `team` (string, optional): Filter games involving specific team
- `date` (string, optional): Filter by date (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "espnGameId": "401736207",
      "date": "2025-06-26",
      "homeTeam": "LV",
      "awayTeam": "CONN",
      "homeScore": 85,
      "awayScore": 78,
      "status": "FINAL",
      "venue": "Michelob ULTRA Arena",
      "attendance": 8421
    }
  ]
}
```

#### Get Game Details
```http
GET /api/games/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "homeTeam": "LV",
    "awayTeam": "CONN",
    "homeScore": 85,
    "awayScore": 78,
    "status": "FINAL",
    "playerStats": [
      {
        "playerId": "uuid",
        "playerName": "A'ja Wilson",
        "team": "LV",
        "stats": {
          "points": 25,
          "rebounds": 12,
          "assists": 3
        }
      }
    ]
  }
}
```

### Fantasy Scores

#### Get Fantasy Scores
```http
GET /api/fantasy/scores
```

**Query Parameters:**
- `playerId` (string, optional): Filter by specific player
- `date` (string, optional): Filter by date (YYYY-MM-DD)
- `scoringConfigId` (string, optional): Filter by scoring configuration
- `limit` (number, optional): Items per page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "playerId": "uuid",
      "playerName": "A'ja Wilson",
      "date": "2025-06-26",
      "fantasyPoints": 42.0,
      "scoringConfig": {
        "name": "ESPN Default",
        "pointsMultiplier": 1,
        "reboundsMultiplier": 1,
        "assistsMultiplier": 1,
        "stealsMultiplier": 2,
        "blocksMultiplier": 2,
        "threePointersMultiplier": 1,
        "turnoversMultiplier": 0
      },
      "breakdown": {
        "points": 25,
        "rebounds": 12,
        "assists": 3,
        "steals": 4,
        "blocks": 6,
        "threePointers": 1,
        "turnovers": 0
      }
    }
  ]
}
```

#### Get Player Fantasy History
```http
GET /api/fantasy/players/:id/history
```

**Query Parameters:**
- `days` (number, optional): Number of days to look back (default: 30)
- `scoringConfigId` (string, optional): Specific scoring configuration

**Response:**
```json
{
  "success": true,
  "data": {
    "playerId": "uuid",
    "playerName": "A'ja Wilson",
    "averages": {
      "last7Days": 38.5,
      "last14Days": 36.8,
      "last30Days": 35.2,
      "season": 34.7
    },
    "recentGames": [
      {
        "date": "2025-06-26",
        "opponent": "CONN",
        "fantasyPoints": 42.0,
        "rank": 1
      }
    ],
    "consistency": {
      "score": 0.85,
      "description": "Very Consistent"
    }
  }
}
```

### Teams

#### Get All Teams
```http
GET /api/teams
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "abbreviation": "LV",
      "name": "Las Vegas Aces",
      "city": "Las Vegas",
      "conference": "Western",
      "division": "West",
      "colors": {
        "primary": "#CE1141",
        "secondary": "#000000"
      },
      "logo": "https://...",
      "playerCount": 12,
      "record": {
        "wins": 15,
        "losses": 8
      }
    }
  ]
}
```

### Analytics

#### Get League Leaders
```http
GET /api/analytics/leaders
```

**Query Parameters:**
- `stat` (string, required): Stat category (points, rebounds, assists, steals, blocks, fantasyPoints)
- `minGames` (number, optional): Minimum games played (default: 5)
- `limit` (number, optional): Number of leaders (default: 10, max: 50)

**Response:**
```json
{
  "success": true,
  "data": {
    "category": "points",
    "leaders": [
      {
        "playerId": "uuid",
        "playerName": "A'ja Wilson",
        "team": "LV",
        "value": 27.3,
        "gamesPlayed": 23,
        "rank": 1
      }
    ]
  }
}
```

#### Get Trending Players
```http
GET /api/analytics/trending
```

**Query Parameters:**
- `period` (string, optional): trending, hot, cold (default: trending)
- `days` (number, optional): Period for analysis (default: 7)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "playerId": "uuid",
      "playerName": "Caitlin Clark",
      "team": "IND",
      "trendScore": 8.5,
      "recentAverage": 22.3,
      "seasonAverage": 18.7,
      "improvement": "+19.3%",
      "reason": "Increased scoring efficiency"
    }
  ]
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## Rate Limiting

- **Authenticated users**: 1000 requests per hour
- **Unauthenticated users**: 100 requests per hour

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## Pagination

Paginated endpoints return pagination metadata:
```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 171,
    "pages": 9,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## Data Updates

The API automatically updates data from ESPN:
- **Game data**: Every 4 hours during season
- **Fantasy scores**: Every 2 hours after games
- **Player profiles**: Weekly

Force updates available through admin endpoints (authentication required).