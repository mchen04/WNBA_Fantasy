import { PrismaClient } from '@prisma/client';
import { SubscriptionTier } from '@shared/types';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create demo users first
  const demoUser = await prisma.user.create({
    data: {
      email: 'demo@wnbafantasy.com',
      googleId: 'demo-google-id',
      name: 'Demo User',
      subscriptionTier: SubscriptionTier.FREE,
    },
  });

  const systemUser = await prisma.user.create({
    data: {
      email: 'system@wnbafantasy.com',
      googleId: 'system-google-id',
      name: 'System',
      subscriptionTier: SubscriptionTier.FREE,
    },
  });

  console.log('✅ Created demo and system users');

  // Create default scoring configurations
  const defaultScoring = await prisma.scoringConfiguration.create({
    data: {
      name: 'Default WNBA Scoring',
      userId: systemUser.id,
      isDefault: true,
      pointsMultiplier: 1,
      reboundsMultiplier: 1.25,
      assistsMultiplier: 1.5,
      stealsMultiplier: 2,
      blocksMultiplier: 2,
      threePointersMultiplier: 0.5,
      turnoversMultiplier: -1,
    },
  });

  const espnScoring = await prisma.scoringConfiguration.create({
    data: {
      name: 'ESPN Fantasy Scoring',
      userId: systemUser.id,
      isDefault: false,
      pointsMultiplier: 1,
      reboundsMultiplier: 1,
      assistsMultiplier: 1,
      stealsMultiplier: 1,
      blocksMultiplier: 1,
      threePointersMultiplier: 1,
      turnoversMultiplier: -1,
    },
  });

  console.log('✅ Created default scoring configurations');

  // Create sample teams
  const teams = [
    { name: 'Las Vegas Aces', abbreviation: 'LV' },
    { name: 'New York Liberty', abbreviation: 'NY' },
    { name: 'Connecticut Sun', abbreviation: 'CT' },
    { name: 'Chicago Sky', abbreviation: 'CHI' },
    { name: 'Seattle Storm', abbreviation: 'SEA' },
    { name: 'Phoenix Mercury', abbreviation: 'PHX' },
    { name: 'Dallas Wings', abbreviation: 'DAL' },
    { name: 'Indiana Fever', abbreviation: 'IND' },
    { name: 'Atlanta Dream', abbreviation: 'ATL' },
    { name: 'Washington Mystics', abbreviation: 'WAS' },
    { name: 'Los Angeles Sparks', abbreviation: 'LA' },
    { name: 'Minnesota Lynx', abbreviation: 'MIN' },
  ];

  // Create sample players
  const samplePlayers = [
    {
      espnId: '4433403',
      name: "A'ja Wilson",
      firstName: "A'ja",
      lastName: 'Wilson',
      team: 'Las Vegas Aces',
      position: 'F_C',
      jerseyNumber: 22,
      activeStatus: true,
    },
    {
      espnId: '3027959',
      name: 'Breanna Stewart',
      firstName: 'Breanna',
      lastName: 'Stewart',
      team: 'New York Liberty',
      position: 'F',
      jerseyNumber: 30,
      activeStatus: true,
    },
    {
      espnId: '3051017',
      name: 'Jonquel Jones',
      firstName: 'Jonquel',
      lastName: 'Jones',
      team: 'New York Liberty',
      position: 'F_C',
      jerseyNumber: 35,
      activeStatus: true,
    },
    {
      espnId: '3149391',
      name: 'Napheesa Collier',
      firstName: 'Napheesa',
      lastName: 'Collier',
      team: 'Minnesota Lynx',
      position: 'F',
      jerseyNumber: 24,
      activeStatus: true,
    },
    {
      espnId: '3886245',
      name: 'Arike Ogunbowale',
      firstName: 'Arike',
      lastName: 'Ogunbowale',
      team: 'Dallas Wings',
      position: 'G',
      jerseyNumber: 24,
      activeStatus: true,
    },
  ];

  for (const playerData of samplePlayers) {
    await prisma.player.upsert({
      where: { espnId: playerData.espnId },
      update: {},
      create: playerData,
    });
  }

  console.log('✅ Created sample players');

  // Create custom scoring configuration for demo user
  await prisma.scoringConfiguration.create({
    data: {
      name: 'My Custom Scoring',
      userId: demoUser.id,
      isDefault: false,
      pointsMultiplier: 1,
      reboundsMultiplier: 1.5,
      assistsMultiplier: 2,
      stealsMultiplier: 3,
      blocksMultiplier: 3,
      threePointersMultiplier: 1,
      turnoversMultiplier: -1.5,
    },
  });

  console.log('✅ Created custom scoring configuration for demo user');

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });