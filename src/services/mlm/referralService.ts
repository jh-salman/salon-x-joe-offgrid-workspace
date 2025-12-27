import { PrismaClient } from '@prisma/client'
import { CustomError } from '../../utils/customError'

const prisma = new PrismaClient()

export class ReferralService {
  // Create a new referral
  static async createReferral(data: {
    referrerId: string
    referredId: string
    brandId?: string
    type: 'USER_REFERRAL' | 'BRAND_REFERRAL' | 'STAFF_REFERRAL'
    commissionRate?: number
    level?: number
  }) {
    try {
      // Check if referral already exists
      const existingReferral = await prisma.referral.findFirst({
        where: {
          referrerId: data.referrerId,
          referredId: data.referredId,
          brandId: data.brandId
        }
      })

      if (existingReferral) {
        throw new CustomError('Referral already exists', 409)
      }

      // Create referral
      const referral = await prisma.referral.create({
        data: {
          referrerId: data.referrerId,
          referredId: data.referredId,
          brandId: data.brandId,
          type: data.type,
          commissionRate: data.commissionRate || 0.1, // 10% default
          level: data.level || 1,
          status: 'PENDING'
        },
        include: {
          referrer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          referred: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          brand: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })

      return {
        success: true,
        data: referral
      }
    } catch (error) {
      console.error('Error creating referral:', error)
      throw error
    }
  }

  // Get user's referrals (as referrer)
  static async getUserReferrals(userId: string, brandId?: string) {
    try {
      const referrals = await prisma.referral.findMany({
        where: {
          referrerId: userId,
          ...(brandId && { brandId })
        },
        include: {
          referred: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              createdAt: true
            }
          },
          brand: {
            select: {
              id: true,
              name: true
            }
          },
          commissions: {
            select: {
              id: true,
              amount: true,
              status: true,
              type: true,
              createdAt: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      return {
        success: true,
        data: referrals
      }
    } catch (error) {
      console.error('Error getting user referrals:', error)
      throw error
    }
  }

  // Get user's referral network (downline)
  static async getUserReferralNetwork(userId: string, brandId?: string, maxLevel: number = 3) {
    try {
      const network = await prisma.referral.findMany({
        where: {
          referrerId: userId,
          level: {
            lte: maxLevel
          },
          ...(brandId && { brandId })
        },
        include: {
          referred: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              createdAt: true
            }
          },
          brand: {
            select: {
              id: true,
              name: true
            }
          },
          commissions: {
            select: {
              id: true,
              amount: true,
              status: true,
              type: true,
              createdAt: true
            }
          }
        },
        orderBy: [
          { level: 'asc' },
          { createdAt: 'desc' }
        ]
      })

      // Group by level
      const networkByLevel = network.reduce((acc, referral) => {
        const level = referral.level
        if (!acc[level]) {
          acc[level] = []
        }
        acc[level].push(referral)
        return acc
      }, {} as Record<number, typeof network>)

      return {
        success: true,
        data: {
          network,
          networkByLevel,
          totalReferrals: network.length,
          levelCounts: Object.keys(networkByLevel).map(level => ({
            level: parseInt(level),
            count: networkByLevel[parseInt(level)].length
          }))
        }
      }
    } catch (error) {
      console.error('Error getting referral network:', error)
      throw error
    }
  }

  // Update referral status
  static async updateReferralStatus(referralId: string, status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED') {
    try {
      const referral = await prisma.referral.update({
        where: { id: referralId },
        data: { status },
        include: {
          referrer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          referred: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          brand: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })

      return {
        success: true,
        data: referral
      }
    } catch (error) {
      console.error('Error updating referral status:', error)
      throw error
    }
  }

  // Get referral statistics
  static async getReferralStats(userId: string, brandId?: string) {
    try {
      const stats = await prisma.referral.groupBy({
        by: ['status', 'type'],
        where: {
          referrerId: userId,
          ...(brandId && { brandId })
        },
        _count: {
          id: true
        }
      })

      const totalCommissions = await prisma.commission.aggregate({
        where: {
          userId,
          ...(brandId && { brandId })
        },
        _sum: {
          amount: true
        }
      })

      const paidCommissions = await prisma.commission.aggregate({
        where: {
          userId,
          status: 'PAID',
          ...(brandId && { brandId })
        },
        _sum: {
          amount: true
        }
      })

      return {
        success: true,
        data: {
          referralStats: stats,
          totalCommissions: totalCommissions._sum.amount || 0,
          paidCommissions: paidCommissions._sum.amount || 0,
          pendingCommissions: (totalCommissions._sum.amount || 0) - (paidCommissions._sum.amount || 0)
        }
      }
    } catch (error) {
      console.error('Error getting referral stats:', error)
      throw error
    }
  }

  // Delete referral
  static async deleteReferral(referralId: string, userId: string) {
    try {
      // Check if user owns this referral
      const referral = await prisma.referral.findFirst({
        where: {
          id: referralId,
          referrerId: userId
        }
      })

      if (!referral) {
        throw new CustomError('Referral not found or access denied', 404)
      }

      await prisma.referral.delete({
        where: { id: referralId }
      })

      return {
        success: true,
        message: 'Referral deleted successfully'
      }
    } catch (error) {
      console.error('Error deleting referral:', error)
      throw error
    }
  }
}