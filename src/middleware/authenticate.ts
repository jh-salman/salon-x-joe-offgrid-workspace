import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { CustomError } from '../utils/customError'

const prisma = new PrismaClient()

// Extend Request interface to include user and tenant info
export interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    firstName: string
    lastName: string
    country: string
    status: string
    emailVerified: boolean
    phoneVerified: boolean
    faceEnabled: boolean
  }
  tenant?: {
    id: string
    name: string
    subdomain: string
    role: string
  }
}

// Main authentication middleware
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      throw new CustomError('Access token required', 401)
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as any
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        country: true,
        status: true,
        emailVerified: true,
        phoneVerified: true,
        faceEnabled: true
      }
    })

    if (!user) {
      throw new CustomError('User not found', 404)
    }

    if (user.status !== 'ACTIVE') {
      throw new CustomError('Account not active', 403)
    }

    // Check if session is valid
    const session = await prisma.userAuthSession.findFirst({
      where: {
        sessionToken: token,
        isActive: true,
        expiresAt: {
          gt: new Date()
        }
      }
    })

    if (!session) {
      throw new CustomError('Invalid or expired session', 401)
    }

    // Add user to request
    req.user = user
    
    next()
  } catch (error: any) {
    if (error instanceof CustomError) {
      return next(error)
    }
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new CustomError('Invalid or expired token', 401))
    }
    
    next(new CustomError('Authentication failed', 500))
  }
}

// Optional authentication middleware
export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      return next() // Continue without authentication
    }

    // Try to authenticate but don't fail if it doesn't work
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as any
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        country: true,
        status: true,
        emailVerified: true,
        phoneVerified: true,
        faceEnabled: true
      }
    })

    if (user && user.status === 'ACTIVE') {
      req.user = user
    }
    
    next()
  } catch (error) {
    // Continue without authentication on error
    next()
  }
}