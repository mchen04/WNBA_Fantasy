import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { 
  generateToken, 
  generateRefreshToken, 
  verifyGoogleToken,
  verifyToken 
} from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { authRateLimiter } from '../middleware/rateLimit';
import { AppError } from '../middleware/error';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
const googleAuthSchema = z.object({
  idToken: z.string(),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

// Google OAuth login/register
router.post(
  '/google',
  authRateLimiter,
  validateBody(googleAuthSchema),
  async (req, res, next) => {
    try {
      const { idToken } = req.body;
      
      // Verify Google token
      const googleUser = await verifyGoogleToken(idToken);
      
      // Find or create user
      let user = await prisma.user.findUnique({
        where: { googleId: googleUser.googleId },
      });
      
      if (!user) {
        // Check if email already exists
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
            name: googleUser.name,
            avatar: googleUser.picture,
            subscriptionTier: 'FREE',
          },
        });
        
        logger.info(`New user registered: ${user.email}`);
      } else {
        // Update user info
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            name: googleUser.name,
            avatar: googleUser.picture,
          },
        });
      }
      
      // Generate tokens
      const accessToken = generateToken(user.id, user.email);
      const refreshToken = generateRefreshToken(user.id);
      
      // Save refresh token
      await prisma.session.create({
        data: {
          userId: user.id,
          refreshToken,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });
      
      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            subscriptionTier: user.subscriptionTier,
          },
          accessToken,
          refreshToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Refresh token
router.post(
  '/refresh',
  validateBody(refreshTokenSchema),
  async (req, res, next) => {
    try {
      const { refreshToken } = req.body;
      
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
      
      res.json({
        success: true,
        data: {
          accessToken,
          user: {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
            avatar: session.user.avatar,
            subscriptionTier: session.user.subscriptionTier,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Logout
router.post('/logout', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const payload = verifyToken(token);
        
        // Delete all sessions for user
        await prisma.session.deleteMany({
          where: { userId: payload.userId },
        });
      } catch (error) {
        // Ignore token errors on logout
      }
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }
    
    const token = authHeader.substring(7);
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
        currentPeriodEnd: true,
        createdAt: true,
      },
    });
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

export default router;