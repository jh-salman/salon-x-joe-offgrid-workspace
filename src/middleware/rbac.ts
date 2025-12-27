import { Response, NextFunction } from 'express'
import { AuthRequest } from './authenticate'
import { CustomError } from '../utils/customError'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Tenant context middleware - Only use brandId from headers
export const requireTenant = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new CustomError('Authentication required', 401)
    }

    // Get brand ID from header only (no subdomain logic)
    const brandId = req.headers['x-brand-id'] as string || 
                   req.params.brandId as string ||
                   req.query.brandId as string

    if (!brandId) {
      throw new CustomError('Brand ID required', 400)
    }

    // Find brand by ID
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: {
        id: true,
        name: true,
        subdomain: true,
        status: true
      }
    })

    if (!brand) {
      throw new CustomError('Brand not found', 404)
    }

    if (brand.status !== 'ACTIVE') {
      throw new CustomError('Brand is not active', 403)
    }

    // Check if user has access to this brand
    const membership = await prisma.brandMember.findFirst({
      where: {
        brandId: brand.id,
        userId: req.user.id,
        status: 'ACTIVE'
      },
      select: {
        role: true,
        permissions: true
      }
    })

    if (!membership) {
      throw new CustomError('Access denied to this brand', 403)
    }

    // Add tenant info to request
    req.tenant = {
      id: brand.id,
      name: brand.name,
      subdomain: brand.subdomain,
      role: membership.role
    }

    next()
  } catch (error) {
    next(error)
  }
}

// Owner or Admin access control
export const requireOwnerOrAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.tenant) {
      throw new CustomError('Brand context required', 400)
    }

    const allowedRoles = ['OWNER', 'ADMIN']
    
    if (!allowedRoles.includes(req.tenant.role)) {
      throw new CustomError('Insufficient permissions. Owner or Admin access required.', 403)
    }

    next()
  } catch (error) {
    next(error)
  }
}

// Owner only access control
export const requireOwner = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.tenant) {
      throw new CustomError('Brand context required', 400)
    }

    if (req.tenant.role !== 'OWNER') {
      throw new CustomError('Owner access required', 403)
    }

    next()
  } catch (error) {
    next(error)
  }
}

// Staff or above access control
export const requireStaffOrAbove = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.tenant) {
      throw new CustomError('Brand context required', 400)
    }

    const allowedRoles = ['OWNER', 'ADMIN', 'MANAGER', 'STAFF']
    
    if (!allowedRoles.includes(req.tenant.role)) {
      throw new CustomError('Staff access or above required', 403)
    }

    next()
  } catch (error) {
    next(error)
  }
}

// Manager or above access control
export const requireManagerOrAbove = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.tenant) {
      throw new CustomError('Brand context required', 400)
    }

    const allowedRoles = ['OWNER', 'ADMIN', 'MANAGER']
    
    if (!allowedRoles.includes(req.tenant.role)) {
      throw new CustomError('Manager access or above required', 403)
    }

    next()
  } catch (error) {
    next(error)
  }
}

// Optional brand context middleware (for public routes)
// Require admin or above role
export const requireAdminOrAbove = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new CustomError('Authentication required', 401)
    }

    const brandId = req.headers['x-brand-id'] as string || 
                   req.params.brandId as string ||
                   req.query.brandId as string

    if (!brandId) {
      throw new CustomError('Brand ID required', 400)
    }

    // Check user's role in this brand
    const membership = await prisma.brandMember.findFirst({
      where: {
        brandId,
        userId: req.user.id,
        status: 'ACTIVE',
        role: {
          in: ['OWNER', 'ADMIN']
        }
      },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            status: true
          }
        }
      }
    })

    if (!membership) {
      throw new CustomError('Admin access required', 403)
    }

    if (membership.brand.status !== 'ACTIVE') {
      throw new CustomError('Brand is not active', 403)
    }

    req.tenant = {
      id: membership.brand.id,
      name: membership.brand.name,
      subdomain: membership.brand.subdomain,
      role: membership.role
    }

    next()
  } catch (error) {
    next(error)
  }
}

export const optionalBrand = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const brandId = req.headers['x-brand-id'] as string || 
                   req.params.brandId as string ||
                   req.query.brandId as string

    if (brandId) {
      const brand = await prisma.brand.findUnique({
        where: { id: brandId },
        select: {
          id: true,
          name: true,
          subdomain: true,
          status: true
        }
      })

      if (brand && brand.status === 'ACTIVE') {
        req.tenant = {
          id: brand.id,
          name: brand.name,
          subdomain: brand.subdomain,
          role: 'GUEST' // Default role for optional brand
        }
      }
    }

    next()
  } catch (error) {
    // Don't throw error for optional brand
    next()
  }
}