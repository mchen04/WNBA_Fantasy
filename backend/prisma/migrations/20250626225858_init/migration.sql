-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PRO', 'PRO_PLUS');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELED', 'PAST_DUE', 'INCOMPLETE', 'TRIALING');

-- CreateEnum
CREATE TYPE "Position" AS ENUM ('G', 'F', 'C', 'G_F', 'F_C');

-- CreateEnum
CREATE TYPE "InjuryStatus" AS ENUM ('HEALTHY', 'QUESTIONABLE', 'DOUBTFUL', 'OUT', 'DAY_TO_DAY');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'FINAL', 'POSTPONED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ConsistencyGrade" AS ENUM ('A_PLUS', 'A', 'A_MINUS', 'B_PLUS', 'B', 'B_MINUS', 'C_PLUS', 'C', 'C_MINUS', 'D', 'F');

-- CreateEnum
CREATE TYPE "TrendDirection" AS ENUM ('UP', 'DOWN', 'STABLE');

-- CreateEnum
CREATE TYPE "TradeRecommendation" AS ENUM ('ACCEPT', 'DECLINE', 'NEUTRAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "googleId" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "subscriptionStatus" "SubscriptionStatus",
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "espnId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "team" TEXT NOT NULL,
    "position" "Position" NOT NULL,
    "jerseyNumber" INTEGER,
    "height" TEXT,
    "weight" INTEGER,
    "birthDate" TIMESTAMP(3),
    "yearsExperience" INTEGER,
    "college" TEXT,
    "activeStatus" BOOLEAN NOT NULL DEFAULT true,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerInjury" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "status" "InjuryStatus" NOT NULL,
    "description" TEXT,
    "reportedDate" TIMESTAMP(3) NOT NULL,
    "returnDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerInjury_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "espnGameId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "status" "GameStatus" NOT NULL,
    "season" INTEGER NOT NULL,
    "attendance" INTEGER,
    "venue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerStats" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "minutes" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "rebounds" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,
    "steals" INTEGER NOT NULL,
    "blocks" INTEGER NOT NULL,
    "turnovers" INTEGER NOT NULL,
    "fouls" INTEGER NOT NULL,
    "fieldGoalsMade" INTEGER NOT NULL,
    "fieldGoalsAttempted" INTEGER NOT NULL,
    "threePointersMade" INTEGER NOT NULL,
    "threePointersAttempted" INTEGER NOT NULL,
    "freeThrowsMade" INTEGER NOT NULL,
    "freeThrowsAttempted" INTEGER NOT NULL,
    "plusMinus" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringConfiguration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "pointsMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "reboundsMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "assistsMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "stealsMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "blocksMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "threePointersMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "turnoversMultiplier" DOUBLE PRECISION NOT NULL DEFAULT -1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoringConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerFantasyScore" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "scoringConfigId" TEXT NOT NULL,
    "fantasyPoints" DOUBLE PRECISION NOT NULL,
    "seasonAverage" DOUBLE PRECISION,
    "last7DaysAverage" DOUBLE PRECISION,
    "last14DaysAverage" DOUBLE PRECISION,
    "last30DaysAverage" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerFantasyScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsistencyMetric" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "standardDeviation7Days" DOUBLE PRECISION NOT NULL,
    "standardDeviation14Days" DOUBLE PRECISION NOT NULL,
    "standardDeviation30Days" DOUBLE PRECISION NOT NULL,
    "coefficientOfVariation7Days" DOUBLE PRECISION NOT NULL,
    "coefficientOfVariation14Days" DOUBLE PRECISION NOT NULL,
    "coefficientOfVariation30Days" DOUBLE PRECISION NOT NULL,
    "consistencyGrade" "ConsistencyGrade" NOT NULL,
    "gamesPlayed7Days" INTEGER NOT NULL,
    "gamesPlayed14Days" INTEGER NOT NULL,
    "gamesPlayed30Days" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsistencyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrendingAnalysis" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "minutesTrend" "TrendDirection" NOT NULL,
    "minutesTrendValue" DOUBLE PRECISION NOT NULL,
    "performanceTrend" "TrendDirection" NOT NULL,
    "performanceTrendValue" DOUBLE PRECISION NOT NULL,
    "hotFactor" DOUBLE PRECISION NOT NULL,
    "isHot" BOOLEAN NOT NULL,
    "recentAverage" DOUBLE PRECISION NOT NULL,
    "seasonAverage" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrendingAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeAnalysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playerIdsIn" TEXT[],
    "playerIdsOut" TEXT[],
    "netValue" DOUBLE PRECISION NOT NULL,
    "recommendation" "TradeRecommendation" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "valueIn" DOUBLE PRECISION NOT NULL,
    "valueOut" DOUBLE PRECISION NOT NULL,
    "slotValue" DOUBLE PRECISION NOT NULL,
    "slotDifference" INTEGER NOT NULL,
    "notes" TEXT,
    "saved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaiverRecommendation" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "playerId" TEXT NOT NULL,
    "recommendationScore" DOUBLE PRECISION NOT NULL,
    "projectedFantasyPoints" DOUBLE PRECISION NOT NULL,
    "hotFactor" DOUBLE PRECISION NOT NULL,
    "minutesTrend" DOUBLE PRECISION NOT NULL,
    "matchupFavorability" DOUBLE PRECISION NOT NULL,
    "opponentTeam" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "reasoning" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaiverRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageTracking" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "lastUsed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "period" TIMESTAMP(3) NOT NULL,
    "subscriptionTier" "SubscriptionTier" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeSubscriptionId_key" ON "User"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_googleId_idx" ON "User"("googleId");

-- CreateIndex
CREATE INDEX "User_stripeCustomerId_idx" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshToken_key" ON "Session"("refreshToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_refreshToken_idx" ON "Session"("refreshToken");

-- CreateIndex
CREATE UNIQUE INDEX "Player_espnId_key" ON "Player"("espnId");

-- CreateIndex
CREATE INDEX "Player_name_idx" ON "Player"("name");

-- CreateIndex
CREATE INDEX "Player_team_idx" ON "Player"("team");

-- CreateIndex
CREATE INDEX "Player_position_idx" ON "Player"("position");

-- CreateIndex
CREATE INDEX "Player_espnId_idx" ON "Player"("espnId");

-- CreateIndex
CREATE INDEX "PlayerInjury_playerId_idx" ON "PlayerInjury"("playerId");

-- CreateIndex
CREATE INDEX "PlayerInjury_active_idx" ON "PlayerInjury"("active");

-- CreateIndex
CREATE UNIQUE INDEX "Game_espnGameId_key" ON "Game"("espnGameId");

-- CreateIndex
CREATE INDEX "Game_date_idx" ON "Game"("date");

-- CreateIndex
CREATE INDEX "Game_homeTeam_idx" ON "Game"("homeTeam");

-- CreateIndex
CREATE INDEX "Game_awayTeam_idx" ON "Game"("awayTeam");

-- CreateIndex
CREATE INDEX "Game_status_idx" ON "Game"("status");

-- CreateIndex
CREATE INDEX "Game_espnGameId_idx" ON "Game"("espnGameId");

-- CreateIndex
CREATE INDEX "PlayerStats_playerId_idx" ON "PlayerStats"("playerId");

-- CreateIndex
CREATE INDEX "PlayerStats_gameId_idx" ON "PlayerStats"("gameId");

-- CreateIndex
CREATE INDEX "PlayerStats_date_idx" ON "PlayerStats"("date");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerStats_playerId_gameId_key" ON "PlayerStats"("playerId", "gameId");

-- CreateIndex
CREATE INDEX "ScoringConfiguration_userId_idx" ON "ScoringConfiguration"("userId");

-- CreateIndex
CREATE INDEX "ScoringConfiguration_isDefault_idx" ON "ScoringConfiguration"("isDefault");

-- CreateIndex
CREATE INDEX "PlayerFantasyScore_playerId_idx" ON "PlayerFantasyScore"("playerId");

-- CreateIndex
CREATE INDEX "PlayerFantasyScore_date_idx" ON "PlayerFantasyScore"("date");

-- CreateIndex
CREATE INDEX "PlayerFantasyScore_scoringConfigId_idx" ON "PlayerFantasyScore"("scoringConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerFantasyScore_playerId_date_scoringConfigId_key" ON "PlayerFantasyScore"("playerId", "date", "scoringConfigId");

-- CreateIndex
CREATE INDEX "ConsistencyMetric_playerId_idx" ON "ConsistencyMetric"("playerId");

-- CreateIndex
CREATE INDEX "ConsistencyMetric_date_idx" ON "ConsistencyMetric"("date");

-- CreateIndex
CREATE INDEX "ConsistencyMetric_consistencyGrade_idx" ON "ConsistencyMetric"("consistencyGrade");

-- CreateIndex
CREATE UNIQUE INDEX "ConsistencyMetric_playerId_date_key" ON "ConsistencyMetric"("playerId", "date");

-- CreateIndex
CREATE INDEX "TrendingAnalysis_playerId_idx" ON "TrendingAnalysis"("playerId");

-- CreateIndex
CREATE INDEX "TrendingAnalysis_date_idx" ON "TrendingAnalysis"("date");

-- CreateIndex
CREATE INDEX "TrendingAnalysis_isHot_idx" ON "TrendingAnalysis"("isHot");

-- CreateIndex
CREATE UNIQUE INDEX "TrendingAnalysis_playerId_date_key" ON "TrendingAnalysis"("playerId", "date");

-- CreateIndex
CREATE INDEX "TradeAnalysis_userId_idx" ON "TradeAnalysis"("userId");

-- CreateIndex
CREATE INDEX "TradeAnalysis_createdAt_idx" ON "TradeAnalysis"("createdAt");

-- CreateIndex
CREATE INDEX "WaiverRecommendation_date_idx" ON "WaiverRecommendation"("date");

-- CreateIndex
CREATE INDEX "WaiverRecommendation_playerId_idx" ON "WaiverRecommendation"("playerId");

-- CreateIndex
CREATE INDEX "WaiverRecommendation_rank_idx" ON "WaiverRecommendation"("rank");

-- CreateIndex
CREATE UNIQUE INDEX "WaiverRecommendation_date_playerId_key" ON "WaiverRecommendation"("date", "playerId");

-- CreateIndex
CREATE INDEX "UsageTracking_userId_idx" ON "UsageTracking"("userId");

-- CreateIndex
CREATE INDEX "UsageTracking_feature_idx" ON "UsageTracking"("feature");

-- CreateIndex
CREATE INDEX "UsageTracking_period_idx" ON "UsageTracking"("period");

-- CreateIndex
CREATE UNIQUE INDEX "UsageTracking_userId_feature_period_key" ON "UsageTracking"("userId", "feature", "period");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");

-- CreateIndex
CREATE INDEX "RateLimit_key_idx" ON "RateLimit"("key");

-- CreateIndex
CREATE INDEX "RateLimit_resetAt_idx" ON "RateLimit"("resetAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerInjury" ADD CONSTRAINT "PlayerInjury_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerStats" ADD CONSTRAINT "PlayerStats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerStats" ADD CONSTRAINT "PlayerStats_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringConfiguration" ADD CONSTRAINT "ScoringConfiguration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerFantasyScore" ADD CONSTRAINT "PlayerFantasyScore_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerFantasyScore" ADD CONSTRAINT "PlayerFantasyScore_scoringConfigId_fkey" FOREIGN KEY ("scoringConfigId") REFERENCES "ScoringConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsistencyMetric" ADD CONSTRAINT "ConsistencyMetric_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrendingAnalysis" ADD CONSTRAINT "TrendingAnalysis_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeAnalysis" ADD CONSTRAINT "TradeAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiverRecommendation" ADD CONSTRAINT "WaiverRecommendation_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
