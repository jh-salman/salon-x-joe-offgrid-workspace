import { PrismaClient } from '@prisma/client'
import { CustomError } from '../../utils/customError'

const prisma = new PrismaClient()

export class CommissionService {
  // Create commission for a referral
  static async createCommission(data: {
    referralId: string
    brandId: string
    userId: string
    amount: number
    type: 'REFERRAL' | 'BRAND_CREATION' | 'STAFF_REFERRAL' | 'TOKEN_PURCHASE'
    level?: number
    tokenAmount?: number
    description?: string
  }) {
    try {
      const commission = await prisma.commission.create({
        data: {
          referralId: data.referralId,
          brandId: data.brandId,
          userId: data.userId,
          amount: data.amount,
          type: data.type,
          level: data.level || 1,
          tokenAmount: data.tokenAmount,
          description: data.description,
          status: 'PENDING'
        },
        include: {
          referral: {
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
              }
            }
          },
          brand: {
            select: {
              id: true,
              name: true
            }
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      })

      return {
        success: true,
        data: commission
      }
    } catch (error) {
      console.error('Error creating commission:', error)
      throw error
    }
  }

  // Get user's commissions
  static async getUserCommissions(userId: string, brandId?: string) {
    try {
      const commissions = await prisma.commission.findMany({
        where: {
          userId,
          ...(brandId && { brandId })
        },
        include: {
          referral: {
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
              }
            }
          },
          brand: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      return {
        success: true,
        data: commissions
      }
    } catch (error) {
      console.error('Error getting user commissions:', error)
      throw error
    }
  }

  // Update commission status
  static async updateCommissionStatus(commissionId: string, status: 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED', adminUserId: string) {
    try {
      // Check if user has admin permissions
      const adminMembership = await prisma.brandMember.findFirst({
        where: {
          userId: adminUserId,
          role: {
            in: ['OWNER', 'ADMIN']
          },
          status: 'ACTIVE'
        }
      })

      if (!adminMembership) {
        throw new CustomError('Insufficient permissions to update commission status', 403)
      }

      const updateData: any = { status }
      
      if (status === 'PAID') {
        updateData.paidAt = new Date()
      }

      const commission = await prisma.commission.update({
        where: { id: commissionId },
        data: updateData,
        include: {
          referral: {
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
              }
            }
          },
          brand: {
            select: {
              id: true,
              name: true
            }
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      })

      return {
        success: true,
        data: commission
      }
    } catch (error) {
      console.error('Error updating commission status:', error)
      throw error
    }
  }

  // Get commission statistics
  static async getCommissionStats(userId: string, brandId?: string) {
    try {
      const stats = await prisma.commission.groupBy({
        by: ['status', 'type'],
        where: {
          userId,
          ...(brandId && { brandId })
        },
        _count: {
          id: true
        },
        _sum: {
          amount: true
        }
      })

      const totalAmount = await prisma.commission.aggregate({
        where: {
          userId,
          ...(brandId && { brandId })
        },
        _sum: {
          amount: true
        }
      })

      const paidAmount = await prisma.commission.aggregate({
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
          commissionStats: stats,
          totalAmount: totalAmount._sum.amount || 0,
          paidAmount: paidAmount._sum.amount || 0,
          pendingAmount: (totalAmount._sum.amount || 0) - (paidAmount._sum.amount || 0)
        }
      }
    } catch (error) {
      console.error('Error getting commission stats:', error)
      throw error
    }
  }

  // Get all commissions for admin (brand-specific)
  static async getAllCommissions(brandId: string, adminUserId: string) {
    try {
      // Check if user has admin permissions for this brand
      const adminMembership = await prisma.brandMember.findFirst({
        where: {
          userId: adminUserId,
          brandId,
          role: {
            in: ['OWNER', 'ADMIN']
          },
          status: 'ACTIVE'
        }
      })

      if (!adminMembership) {
        throw new CustomError('Insufficient permissions to view commissions', 403)
      }

      const commissions = await prisma.commission.findMany({
        where: { brandId },
        include: {
          referral: {
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
              }
            }
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      return {
        success: true,
        data: commissions
      }
    } catch (error) {
      console.error('Error getting all commissions:', error)
      throw error
    }
  }

  // Calculate and create commissions for a referral event
  static async calculateAndCreateCommissions(referralId: string, eventType: 'REFERRAL' | 'BRAND_CREATION' | 'STAFF_REFERRAL' | 'TOKEN_PURCHASE', amount: number) {
    try {
      const referral = await prisma.referral.findUnique({
        where: { id: referralId },
        include: {
          referrer: true,
          referred: true,
          brand: true
        }
      })

      if (!referral) {
        throw new CustomError('Referral not found', 404)
      }

      const commissions = []

      // Calculate commission for the referrer
      const commissionAmount = amount * referral.commissionRate
      
      const commission = await this.createCommission({
        referralId: referral.id,
        brandId: referral.brandId!,
        userId: referral.referrerId,
          amount: commissionAmount,
          type: eventType === 'USER_REFERRAL' ? 'REFERRAL' : eventType,
          level: referral.level,
        description: `Commission for ${eventType.toLowerCase().replace('_', ' ')}`
      })

      commissions.push(commission.data)

      // Calculate multi-level commissions (up to 3 levels)
      if (referral.level < 3) {
        const parentReferral = await prisma.referral.findFirst({
          where: {
            referredId: referral.referrerId,
            brandId: referral.brandId
          }
        })

        if (parentReferral) {
          const parentCommissionRate = referral.commissionRate * 0.5 // 50% of original rate for parent
          const parentCommissionAmount = amount * parentCommissionRate

          const parentCommission = await this.createCommission({
            referralId: parentReferral.id,
            brandId: referral.brandId!,
            userId: parentReferral.referrerId,
            amount: parentCommissionAmount,
            type: eventType === 'USER_REFERRAL' ? 'REFERRAL' : eventType,
            level: parentReferral.level + 1,
            description: `Multi-level commission for ${eventType.toLowerCase().replace('_', ' ')}`
          })

          commissions.push(parentCommission.data)
        }
      }

      return {
        success: true,
        data: commissions
      }
    } catch (error) {
      console.error('Error calculating and creating commissions:', error)
      throw error
    }
  }
}
