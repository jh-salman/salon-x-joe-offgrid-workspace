import { PrismaClient } from '@prisma/client'
import { CustomError } from '../../utils/customError'

const prisma = new PrismaClient()

export class TokenService {
  // Get or create user token account
  static async getUserTokenAccount(userId: string) {
    try {
      let userToken = await prisma.userToken.findUnique({
        where: { userId }
      })

      if (!userToken) {
        userToken = await prisma.userToken.create({
          data: {
            userId,
            tokenAmount: 0,
            totalEarned: 0,
            totalSpent: 0
          }
        })
      }

      return {
        success: true,
        data: userToken
      }
    } catch (error) {
      console.error('Error getting user token account:', error)
      throw error
    }
  }

  // Add tokens to user account
  static async addTokens(userId: string, amount: number, reason: string) {
    try {
      const userToken = await this.getUserTokenAccount(userId)
      
      const updatedToken = await prisma.userToken.update({
        where: { userId },
        data: {
          tokenAmount: {
            increment: amount
          },
          totalEarned: {
            increment: amount
          },
          lastUpdated: new Date()
        }
      })

      return {
        success: true,
        data: updatedToken,
        message: `Added ${amount} tokens. Reason: ${reason}`
      }
    } catch (error) {
      console.error('Error adding tokens:', error)
      throw error
    }
  }

  // Spend tokens from user account
  static async spendTokens(userId: string, amount: number, reason: string) {
    try {
      const userToken = await this.getUserTokenAccount(userId)
      
      if (userToken.data.tokenAmount < amount) {
        throw new CustomError('Insufficient token balance', 400)
      }

      const updatedToken = await prisma.userToken.update({
        where: { userId },
        data: {
          tokenAmount: {
            decrement: amount
          },
          totalSpent: {
            increment: amount
          },
          lastUpdated: new Date()
        }
      })

      return {
        success: true,
        data: updatedToken,
        message: `Spent ${amount} tokens. Reason: ${reason}`
      }
    } catch (error) {
      console.error('Error spending tokens:', error)
      throw error
    }
  }

  // Transfer tokens between users
  static async transferTokens(fromUserId: string, toUserId: string, amount: number, reason: string) {
    try {
      // Check sender's balance
      const senderToken = await this.getUserTokenAccount(fromUserId)
      
      if (senderToken.data.tokenAmount < amount) {
        throw new CustomError('Insufficient token balance', 400)
      }

      // Perform transfer in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Deduct from sender
        const updatedSender = await tx.userToken.update({
          where: { userId: fromUserId },
          data: {
            tokenAmount: {
              decrement: amount
            },
            totalSpent: {
              increment: amount
            },
            lastUpdated: new Date()
          }
        })

        // Add to receiver
        const receiverToken = await tx.userToken.upsert({
          where: { userId: toUserId },
          create: {
            userId: toUserId,
            tokenAmount: amount,
            totalEarned: amount,
            totalSpent: 0
          },
          update: {
            tokenAmount: {
              increment: amount
            },
            totalEarned: {
              increment: amount
            },
            lastUpdated: new Date()
          }
        })

        return { updatedSender, receiverToken }
      })

      return {
        success: true,
        data: result,
        message: `Transferred ${amount} tokens from user ${fromUserId} to user ${toUserId}. Reason: ${reason}`
      }
    } catch (error) {
      console.error('Error transferring tokens:', error)
      throw error
    }
  }

  // Get token packages
  static async getTokenPackages() {
    try {
      const packages = await prisma.tokenPackage.findMany({
        where: {
          isActive: true
        },
        orderBy: {
          tokenAmount: 'asc'
        }
      })

      return {
        success: true,
        data: packages
      }
    } catch (error) {
      console.error('Error getting token packages:', error)
      throw error
    }
  }

  // Create token package (admin only)
  static async createTokenPackage(data: {
    name: string
    description?: string
    tokenAmount: number
    price: number
    currency?: string
    features?: any
  }, adminUserId: string) {
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
        throw new CustomError('Insufficient permissions to create token packages', 403)
      }

      const tokenPackage = await prisma.tokenPackage.create({
        data: {
          name: data.name,
          description: data.description,
          tokenAmount: data.tokenAmount,
          price: data.price,
          currency: data.currency || 'BDT',
          features: data.features,
          isActive: true
        }
      })

      return {
        success: true,
        data: tokenPackage
      }
    } catch (error) {
      console.error('Error creating token package:', error)
      throw error
    }
  }

  // Purchase token package
  static async purchaseTokenPackage(packageId: string, userId: string, paymentMethod: string) {
    try {
      const tokenPackage = await prisma.tokenPackage.findUnique({
        where: { id: packageId }
      })

      if (!tokenPackage) {
        throw new CustomError('Token package not found', 404)
      }

      if (!tokenPackage.isActive) {
        throw new CustomError('Token package is not available', 400)
      }

      // Add tokens to user account
      const result = await this.addTokens(userId, tokenPackage.tokenAmount, `Purchased package: ${tokenPackage.name}`)

      return {
        success: true,
        data: {
          package: tokenPackage,
          userToken: result.data,
          paymentMethod
        },
        message: `Successfully purchased ${tokenPackage.tokenAmount} tokens for ${tokenPackage.price} ${tokenPackage.currency}`
      }
    } catch (error) {
      console.error('Error purchasing token package:', error)
      throw error
    }
  }

  // Get token transaction history
  static async getTokenHistory(userId: string, limit: number = 50) {
    try {
      // This would require a separate TokenTransaction model for detailed history
      // For now, we'll return the current token account info
      const userToken = await this.getUserTokenAccount(userId)

      return {
        success: true,
        data: {
          currentBalance: userToken.data,
          // TODO: Implement detailed transaction history
          transactions: []
        }
      }
    } catch (error) {
      console.error('Error getting token history:', error)
      throw error
    }
  }

  // Get token statistics
  static async getTokenStats(userId: string) {
    try {
      const userToken = await this.getUserTokenAccount(userId)
      
      // Get token packages info
      const packages = await this.getTokenPackages()

      return {
        success: true,
        data: {
          userToken: userToken.data,
          availablePackages: packages.data,
          totalTokensInSystem: await prisma.userToken.aggregate({
            _sum: {
              tokenAmount: true
            }
          })
        }
      }
    } catch (error) {
      console.error('Error getting token stats:', error)
      throw error
    }
  }
}
