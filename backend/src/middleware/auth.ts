import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../config/database';
import { config } from '../config/env';
import { AppError } from './error';
import { SubscriptionTier } from '@shared/types';

interface JwtPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    subscriptionTier: SubscriptionTier;
  };
}

const googleClient = new OAuth2Client(config.google.clientId);

// Verify JWT token
export const verifyToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, config.jwt.secret) as JwtPayload;
  } catch (error) {
    throw new AppError('Invalid or expired token', 401);
  }
};

// Generate JWT token
export const generateToken = (userId: string, email: string): string => {
  return jwt.sign(
    { userId, email },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
  );
};

// Generate refresh token
export const generateRefreshToken = (userId: string): string => {
  return jwt.sign(
    { userId, type: 'refresh' },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiresIn } as jwt.SignOptions
  );
};

// Verify Google token
export const verifyGoogleToken = async (idToken: string) => {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: config.google.clientId,
    });
    
    const payload = ticket.getPayload();
    if (!payload) {
      throw new AppError('Invalid Google token', 401);
    }
    
    return {
      googleId: payload.sub,
      email: payload.email!,
      name: payload.name,
      picture: payload.picture,
    };
  } catch (error) {
    throw new AppError('Invalid Google token', 401);
  }
};

// Authentication middleware
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }
    
    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        subscriptionTier: true,
        subscriptionStatus: true,
      },
    });
    
    if (!user) {
      throw new AppError('User not found', 401);
    }
    
    // Check if subscription is active
    if (user.subscriptionStatus === 'CANCELED' || user.subscriptionStatus === 'PAST_DUE') {
      // Downgrade to free tier
      await prisma.user.update({
        where: { id: user.id },
        data: { subscriptionTier: 'FREE' },
      });
      user.subscriptionTier = 'FREE';
    }
    
    req.user = {
      id: user.id,
      email: user.email,
      subscriptionTier: user.subscriptionTier,
    };
    
    next();
  } catch (error) {
    next(error);
  }
};

// Optional authentication (doesn't fail if no token)
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          subscriptionTier: true,
        },
      });
      
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          subscriptionTier: user.subscriptionTier,
        };
      }
    }
    
    next();
  } catch (error) {
    // Don't fail on auth errors for optional auth
    next();
  }
};

// Require specific subscription tier
export const requireSubscription = (minTier: SubscriptionTier) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }
    
    const tierHierarchy: Record<SubscriptionTier, number> = {
      [SubscriptionTier.FREE]: 0,
      [SubscriptionTier.PRO]: 1,
      [SubscriptionTier.PRO_PLUS]: 2,
    };
    
    const userTierLevel = tierHierarchy[req.user.subscriptionTier];
    const requiredTierLevel = tierHierarchy[minTier];
    
    if (userTierLevel < requiredTierLevel) {
      return next(
        new AppError(
          `This feature requires a ${minTier} subscription or higher`,
          403
        )
      );
    }
    
    next();
  };
};

// Require Pro tier
export const requirePro = requireSubscription(SubscriptionTier.PRO);

// Require Pro+ tier
export const requireProPlus = requireSubscription(SubscriptionTier.PRO_PLUS);