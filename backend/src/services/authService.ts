import { prisma } from '../config/database';
import { 
  generateToken, 
  generateRefreshToken, 
  verifyGoogleToken,
  verifyToken 
} from '../middleware/auth';
import { AppError } from '../middleware/error';
import { logger } from '../utils/logger';
import { GoogleAuthInput } from '@shared/schemas';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  subscriptionTier: string;
}

export interface AuthResult {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  /**
   * Authenticate user with Google OAuth
   */
  async authenticateWithGoogle(idToken: string): Promise<AuthResult> {
    try {
      // Verify Google token
      const googleUser = await verifyGoogleToken(idToken);
      
      // Find or create user
      let user = await prisma.user.findUnique({
        where: { googleId: googleUser.googleId },
      });
      
      if (!user) {
        // Check if email already exists with different provider
        const existingUser = await prisma.user.findUnique({
          where: { email: googleUser.email },
        });
        
        if (existingUser) {
          throw new AppError('Email already registered with different provider', 400);
        }
        
        // Create new user
        user = await prisma.user.create({
          data: {
            googleId: googleUser.googleId,
            email: googleUser.email,
            name: googleUser.name || null,
            avatar: googleUser.picture || null,
            subscriptionTier: 'FREE',
          },
        });
        
        logger.info(`New user registered: ${user.email}`);
      } else {
        // Update user info if changed
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            name: googleUser.name || user.name,
            avatar: googleUser.picture || user.avatar,
          },
        });
      }
      
      // Generate tokens
      const accessToken = generateToken(user.id, user.email);
      const refreshToken = generateRefreshToken(user.id);
      
      // Save refresh token session
      await prisma.session.create({
        data: {
          userId: user.id,
          refreshToken,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });
      
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          subscriptionTier: user.subscriptionTier,
        },
        accessToken,
        refreshToken,
      };
    } catch (error) {
      logger.error('Google authentication failed:', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError('Authentication failed', 500);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; user: UserProfile }> {
    try {
      // Verify refresh token
      const payload = verifyToken(refreshToken);
      
      // Find session
      const session = await prisma.session.findUnique({
        where: { refreshToken },
        include: { user: true },
      });
      
      if (!session || session.expiresAt < new Date()) {
        throw new AppError('Invalid or expired refresh token', 401);
      }
      
      // Generate new access token
      const accessToken = generateToken(session.user.id, session.user.email);
      
      return {
        accessToken,
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          avatar: session.user.avatar,
          subscriptionTier: session.user.subscriptionTier,
        },
      };
    } catch (error) {
      logger.error('Token refresh failed:', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError('Token refresh failed', 500);
    }
  }

  /**
   * Logout user by invalidating all sessions
   */
  async logout(userId: string): Promise<void> {
    try {
      // Delete all sessions for user
      await prisma.session.deleteMany({
        where: { userId },
      });
      
      logger.info(`User logged out: ${userId}`);
    } catch (error) {
      logger.error('Logout failed:', error);
      throw new AppError('Logout failed', 500);
    }
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(userId: string): Promise<UserProfile> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          subscriptionTier: true,
          subscriptionStatus: true,
          currentPeriodEnd: true,
          createdAt: true,
        },
      });
      
      if (!user) {
        throw new AppError('User not found', 404);
      }
      
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        subscriptionTier: user.subscriptionTier,
      };
    } catch (error) {
      logger.error('Get current user failed:', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError('Failed to get user profile', 500);
    }
  }

  /**
   * Validate and extract user from access token
   */
  async validateAccessToken(token: string): Promise<UserProfile> {
    try {
      const payload = verifyToken(token);
      
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          subscriptionTier: true,
          subscriptionStatus: true,
        },
      });
      
      if (!user) {
        throw new AppError('User not found', 404);
      }
      
      // Check if subscription is still active
      if (user.subscriptionStatus === 'CANCELED' || user.subscriptionStatus === 'PAST_DUE') {
        // Auto-downgrade to free tier
        await prisma.user.update({
          where: { id: user.id },
          data: { subscriptionTier: 'FREE' },
        });
      }
      
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        subscriptionTier: user.subscriptionTier,
      };
    } catch (error) {
      logger.error('Token validation failed:', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError('Invalid access token', 401);
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await prisma.session.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });
      
      logger.info(`Cleaned up ${result.count} expired sessions`);
      return result.count;
    } catch (error) {
      logger.error('Session cleanup failed:', error);
      throw new AppError('Session cleanup failed', 500);
    }
  }
}

export const authService = new AuthService();