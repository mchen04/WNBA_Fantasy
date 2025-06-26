import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { validateBody } from '../middleware/validation';
import { authRateLimiter } from '../middleware/rateLimit';
import { googleAuthSchema, refreshTokenSchema } from '@shared/schemas';
import { z } from 'zod';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    subscriptionTier: string;
  };
}

export class AuthController {
  /**
   * Handle Google OAuth authentication
   */
  async googleAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { idToken } = req.body;
      
      const result = await authService.authenticateWithGoogle(idToken);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      
      const result = await authService.refreshAccessToken(refreshToken);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout user
   */
  async logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        try {
          const user = await authService.validateAccessToken(token);
          await authService.logout(user.id);
        } catch (error) {
          // Ignore token validation errors on logout
        }
      }
      
      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'No token provided',
          },
        });
        return;
      }
      
      const token = authHeader.substring(7);
      const user = await authService.getCurrentUser(req.user!.id);
      
      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Clean up expired sessions (admin endpoint)
   */
  async cleanupSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const count = await authService.cleanupExpiredSessions();
      
      res.json({
        success: true,
        data: {
          cleanedSessions: count,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();

// Route handlers with validation middleware
export const authRoutes = {
  googleAuth: [
    authRateLimiter,
    validateBody(z.object({ idToken: z.string() })),
    authController.googleAuth.bind(authController),
  ],
  
  refreshToken: [
    validateBody(z.object({ refreshToken: z.string() })),
    authController.refreshToken.bind(authController),
  ],
  
  logout: [
    authController.logout.bind(authController),
  ],
  
  getCurrentUser: [
    authController.getCurrentUser.bind(authController),
  ],
  
  cleanupSessions: [
    authController.cleanupSessions.bind(authController),
  ],
};