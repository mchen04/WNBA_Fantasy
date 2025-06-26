import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { config } from '../config/env';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error({
    error: {
      message: err.message,
      stack: err.stack,
      statusCode: (err as any).statusCode,
    },
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userId: (req as any).user?.id,
    },
  });

  // Default error
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details: any = undefined;

  // Handle specific error types
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation Error';
    details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
  } else if ((err as any).code && typeof (err as any).code === 'string') {
    // Handle Prisma errors by checking the code property
    const prismaError = err as any;
    if (prismaError.code === 'P2002') {
      statusCode = 409;
      message = 'A record with this data already exists';
    } else if (prismaError.code === 'P2025') {
      statusCode = 404;
      message = 'Record not found';
    } else if (prismaError.code === 'P2003') {
      statusCode = 400;
      message = 'Invalid reference';
    } else if (prismaError.code.startsWith('P')) {
      statusCode = 400;
      message = 'Database operation failed';
    }
  } else if (err.name === 'PrismaClientValidationError') {
    statusCode = 400;
    message = 'Invalid data provided';
  } else if (err instanceof TokenExpiredError) {
    statusCode = 401;
    message = 'Token has expired';
  } else if (err instanceof JsonWebTokenError) {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'StripeError') {
    statusCode = 400;
    message = 'Payment processing error';
  }

  // Send response
  res.status(statusCode).json({
    success: false,
    error: {
      code: statusCode,
      message,
      details: config.isDevelopment ? details : undefined,
      stack: config.isDevelopment ? err.stack : undefined,
    },
  });
};

// Async handler wrapper
export const asyncHandler = (fn: Function) => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};