import { PrismaClient } from '@prisma/client'
import { CustomError } from '../utils/customError'

const prisma = new PrismaClient()

export class BrandContextService {
  // Switch to a different brand
  static async switchBrand(userId: string, brandId: string) {
    try {
      // Verify user has access to this brand
      const membership = await prisma.brandMember.findFirst({
        where: {
          userId,
          brandId,
          status: 'ACTIVE'
        },
        include: {
          brand: {
            select: {
              id: true,
              name: true,
              subdomain: true,
              logo: true,
              status: true,
              subscriptionPlan: true,
              subscriptionEnds: true
            }
          }
        }
      })

      if (!membership) {
        throw new CustomError('Access denied to this brand', 403)
      }

      if (membership.brand.status !== 'ACTIVE') {
        throw new CustomError('Brand is not active', 403)
      }

      // Update user's last accessed brand (optional - for analytics)
      await prisma.user.update({
        where: { id: userId },
        data: {
          updatedAt: new Date()
        }
      })

      return {
        success: true,
        message: 'Brand switched successfully',
        data: {
          brandId: membership.brand.id,
          brandName: membership.brand.name,
          subdomain: membership.brand.subdomain,
          logo: membership.brand.logo,
          role: membership.role,
          subscriptionPlan: membership.brand.subscriptionPlan,
          subscriptionEnds: membership.brand.subscriptionEnds,
          switchedAt: new Date().toISOString()
        }
      }
    } catch (error) {
      throw error
    }
  }

  // Get current brand context
  static async getCurrentBrandContext(userId: string, brandId?: string) {
    try {
      let membership

      if (brandId) {
        // Get specific brand context
        membership = await prisma.brandMember.findFirst({
          where: {
            userId,
            brandId,
            status: 'ACTIVE'
          },
          include: {
            brand: {
              select: {
                id: true,
                name: true,
                subdomain: true,
                logo: true,
                status: true,
                subscriptionPlan: true,
                subscriptionEnds: true,
                businessHours: true
              }
            }
          }
        })
      } else {
        // Get user's default or most recently accessed brand
        membership = await prisma.brandMember.findFirst({
          where: {
            userId,
            status: 'ACTIVE'
          },
          include: {
            brand: {
              select: {
                id: true,
                name: true,
                subdomain: true,
                logo: true,
                status: true,
                subscriptionPlan: true,
                subscriptionEnds: true,
                businessHours: true
              }
            }
          },
          orderBy: {
            joinedAt: 'desc' // Get most recently joined brand
          }
        })
      }

      if (!membership) {
        throw new CustomError('No brand access found', 404)
      }

      return {
        success: true,
        data: {
          brandId: membership.brand.id,
          brandName: membership.brand.name,
          subdomain: membership.brand.subdomain,
          logo: membership.brand.logo,
          role: membership.role,
          subscriptionPlan: membership.brand.subscriptionPlan,
          subscriptionEnds: membership.brand.subscriptionEnds,
          businessHours: membership.brand.businessHours,
          permissions: membership.permissions,
          joinedAt: membership.joinedAt
        }
      }
    } catch (error) {
      throw error
    }
  }

  // Get all accessible brands for user
  static async getUserAccessibleBrands(userId: string) {
    try {
      const memberships = await prisma.brandMember.findMany({
        where: {
          userId,
          status: 'ACTIVE'
        },
        include: {
          brand: {
            select: {
              id: true,
              name: true,
              subdomain: true,
              logo: true,
              status: true,
              subscriptionPlan: true,
              subscriptionEnds: true
            }
          }
        },
        orderBy: {
          joinedAt: 'desc'
        }
      })

      return {
        success: true,
        data: memberships.map(membership => ({
          brandId: membership.brand.id,
          brandName: membership.brand.name,
          subdomain: membership.brand.subdomain,
          logo: membership.brand.logo,
          role: membership.role,
          subscriptionPlan: membership.brand.subscriptionPlan,
          subscriptionEnds: membership.brand.subscriptionEnds,
          joinedAt: membership.joinedAt,
          isDefault: membership.role === 'OWNER' // Owner brands are default
        }))
      }
    } catch (error) {
      throw error
    }
  }

  // Validate brand access
  static async validateBrandAccess(userId: string, brandId: string) {
    try {
      const membership = await prisma.brandMember.findFirst({
        where: {
          userId,
          brandId,
          status: 'ACTIVE'
        },
        select: {
          role: true,
          permissions: true,
          brand: {
            select: {
              status: true,
              subscriptionPlan: true,
              subscriptionEnds: true
            }
          }
        }
      })

      if (!membership) {
        return {
          hasAccess: false,
          reason: 'No membership found'
        }
      }

      if (membership.brand.status !== 'ACTIVE') {
        return {
          hasAccess: false,
          reason: 'Brand is not active'
        }
      }

      if (membership.brand.subscriptionEnds && membership.brand.subscriptionEnds < new Date()) {
        return {
          hasAccess: false,
          reason: 'Subscription expired'
        }
      }

      return {
        hasAccess: true,
        role: membership.role,
        permissions: membership.permissions,
        subscriptionPlan: membership.brand.subscriptionPlan
      }
    } catch (error) {
      return {
        hasAccess: false,
        reason: 'Validation error'
      }
    }
  }
}