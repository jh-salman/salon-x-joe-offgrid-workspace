import { PrismaClient } from '@prisma/client'
import { CustomError } from '../utils/customError'
import crypto from 'crypto'

const prisma = new PrismaClient()

export class BrandService {
  // Create a new brand (tenant)
  static async createBrand(data: {
    name: string
    subdomain: string
    description?: string
    email?: string
    phone?: string
    website?: string
    address?: string
    city?: string
    state?: string
    zipCode?: string
    country?: string
    businessHours?: any
    logo?: string
    coverImage?: string
    ownerId: string
  }) {
    try {
      // Check if subdomain is already taken
      const existingBrand = await prisma.brand.findUnique({
        where: { subdomain: data.subdomain }
      })

      if (existingBrand) {
        throw new CustomError('Subdomain already taken', 409)
      }

      // Create brand
      const brand = await prisma.brand.create({
        data: {
          name: data.name,
          subdomain: data.subdomain,
          description: data.description || null,
          email: data.email || null,
          phone: data.phone || null,
          website: data.website || null,
          address: data.address || null,
          city: data.city || null,
          state: data.state || null,
          zipCode: data.zipCode || null,
          country: data.country || 'Bangladesh',
          businessHours: data.businessHours,
          logo: data.logo || null,
          coverImage: data.coverImage || null,
          ownerId: data.ownerId,
          status: 'ACTIVE',
          subscriptionPlan: 'BASIC'
        },
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      })

      // Add owner as brand member with OWNER role
      await prisma.brandMember.create({
        data: {
          brandId: brand.id,
          userId: data.ownerId,
          role: 'OWNER',
          status: 'ACTIVE'
        }
      })

      return {
        success: true,
        message: 'Brand created successfully',
        data: brand
      }
    } catch (error) {
      throw error
    }
  }

  // Get brand by ID (with tenant context)
  static async getBrandById(brandId: string, userId: string) {
    try {
      // Check if user has access to this brand
      const membership = await prisma.brandMember.findFirst({
        where: {
          brandId,
          userId,
          status: 'ACTIVE'
        }
      })

      if (!membership) {
        throw new CustomError('Access denied to this brand', 403)
      }

      const brand = await prisma.brand.findUnique({
        where: { id: brandId },
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true
                }
              }
            }
          },
          services: true,
          staff: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true
                }
              }
            }
          },
          clients: true,
          appointments: true
        }
      })

      if (!brand) {
        throw new CustomError('Brand not found', 404)
      }

      return {
        success: true,
        data: brand,
        userRole: membership.role
      }
    } catch (error) {
      throw error
    }
  }

  // Update brand (owner/admin only)
  static async updateBrand(brandId: string, userId: string, updateData: any) {
    try {
      // Check if user has permission to update
      const membership = await prisma.brandMember.findFirst({
        where: {
          brandId,
          userId,
          status: 'ACTIVE',
          role: {
            in: ['OWNER', 'ADMIN']
          }
        }
      })

      if (!membership) {
        throw new CustomError('Insufficient permissions to update brand', 403)
      }

      // Check if subdomain is being changed and if it's available
      if (updateData.subdomain) {
        const existingBrand = await prisma.brand.findFirst({
          where: {
            subdomain: updateData.subdomain,
            id: { not: brandId }
          }
        })

        if (existingBrand) {
          throw new CustomError('Subdomain already taken', 409)
        }
      }

      const updatedBrand = await prisma.brand.update({
        where: { id: brandId },
        data: updateData,
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      })

      return {
        success: true,
        message: 'Brand updated successfully',
        data: updatedBrand
      }
    } catch (error) {
      throw error
    }
  }

  // Get user's brands (multi-tenant support)
  static async getUserBrands(userId: string) {
    try {
      const brands = await prisma.brandMember.findMany({
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
          brand: {
            createdAt: 'desc'
          }
        }
      })

      return {
        success: true,
        data: brands.map(membership => ({
          id: membership.brand.id,
          name: membership.brand.name,
          subdomain: membership.brand.subdomain,
          logo: membership.brand.logo,
          status: membership.brand.status,
          subscriptionPlan: membership.brand.subscriptionPlan,
          subscriptionEnds: membership.brand.subscriptionEnds,
          role: membership.role,
          joinedAt: membership.joinedAt
        }))
      }
    } catch (error) {
      throw error
    }
  }

  // Invite user to brand
  static async inviteUserToBrand(brandId: string, inviterId: string, inviteData: {
    email: string
    role: 'ADMIN' | 'MANAGER' | 'STAFF'
  }) {
    try {
      // Check if inviter has permission
      const inviterMembership = await prisma.brandMember.findFirst({
        where: {
          brandId,
          userId: inviterId,
          status: 'ACTIVE',
          role: {
            in: ['OWNER', 'ADMIN']
          }
        }
      })

      if (!inviterMembership) {
        throw new CustomError('Insufficient permissions to invite users', 403)
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: inviteData.email }
      })

      if (!existingUser) {
        throw new CustomError('User not found with this email', 404)
      }

      // Check if user is already a member
      const existingMembership = await prisma.brandMember.findFirst({
        where: {
          brandId,
          userId: existingUser.id
        }
      })

      if (existingMembership) {
        throw new CustomError('User is already a member of this brand', 409)
      }

      // Create invitation
      const invitation = await prisma.brandInvitation.create({
        data: {
          brandId,
          email: inviteData.email,
          role: inviteData.role,
          invitedBy: inviterId,
          token: crypto.randomBytes(32).toString('hex'),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      })

      // TODO: Send invitation email

      return {
        success: true,
        message: 'Invitation sent successfully',
        data: invitation
      }
    } catch (error) {
      throw error
    }
  }

  // Accept brand invitation
  static async acceptBrandInvitation(invitationId: string, userId: string) {
    try {
      const invitation = await prisma.brandInvitation.findUnique({
        where: { id: invitationId },
        include: { brand: true }
      })

      if (!invitation) {
        throw new CustomError('Invitation not found', 404)
      }

      if (invitation.status !== 'PENDING') {
        throw new CustomError('Invitation is no longer valid', 400)
      }

      if (invitation.expiresAt < new Date()) {
        throw new CustomError('Invitation has expired', 400)
      }

      // Create brand membership
      await prisma.brandMember.create({
        data: {
          brandId: invitation.brandId,
          userId,
          role: invitation.role,
          status: 'ACTIVE',
          invitedBy: invitation.invitedBy
        }
      })

      // Update invitation status
      await prisma.brandInvitation.update({
        where: { id: invitationId },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date()
        }
      })

      return {
        success: true,
        message: 'Successfully joined the brand',
        data: {
          brandId: invitation.brandId,
          brandName: invitation.brand.name,
          role: invitation.role
        }
      }
    } catch (error) {
      throw error
    }
  }

  // Get brand statistics (tenant-specific data)
  static async getBrandStats(brandId: string, userId: string) {
    try {
      // Check if user has access
      const membership = await prisma.brandMember.findFirst({
        where: {
          brandId,
          userId,
          status: 'ACTIVE'
        }
      })

      if (!membership) {
        throw new CustomError('Access denied to this brand', 403)
      }

      // Get statistics
      const [
        totalServices,
        totalStaff,
        totalClients,
        totalAppointments,
        totalRevenue,
        recentAppointments
      ] = await Promise.all([
        prisma.brandService.count({ where: { brandId } }),
        prisma.staff.count({ where: { brandId } }),
        prisma.client.count({ where: { brandId } }),
        prisma.appointment.count({ where: { brandId } }),
        prisma.payment.aggregate({
          where: { 
            brandId,
            status: 'COMPLETED'
          },
          _sum: { amount: true }
        }),
        prisma.appointment.findMany({
          where: { brandId },
          orderBy: { startTime: 'desc' },
          take: 5
        })
      ])

      return {
        success: true,
        data: {
          totalServices,
          totalStaff,
          totalClients,
          totalAppointments,
          totalRevenue: totalRevenue._sum.amount || 0,
          recentAppointments
        }
      }
    } catch (error) {
      throw error
    }
  }

  // Delete brand (owner only)
  static async deleteBrand(brandId: string, userId: string) {
    try {
      // Check if user is owner
      const membership = await prisma.brandMember.findFirst({
        where: {
          brandId,
          userId,
          status: 'ACTIVE',
          role: 'OWNER'
        }
      })

      if (!membership) {
        throw new CustomError('Only brand owner can delete the brand', 403)
      }

      // Delete brand (cascade will handle related records)
      await prisma.brand.delete({
        where: { id: brandId }
      })

      return {
        success: true,
        message: 'Brand deleted successfully'
      }
    } catch (error) {
      throw error
    }
  }

  // Get brand members
  static async getBrandMembers(brandId: string, userId: string) {
    try {
      // Verify user has access to this brand
      const userBrand = await prisma.brandMember.findFirst({
        where: {
          brandId,
          userId,
          status: 'ACTIVE'
        }
      })

      if (!userBrand) {
        throw new CustomError('Access denied to this brand', 403)
      }

      // Get all brand members
      const members = await prisma.brandMember.findMany({
        where: {
          brandId,
          status: 'ACTIVE'
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true
            }
          }
        },
        orderBy: {
          joinedAt: 'asc'
        }
      })

      return {
        success: true,
        data: members,
        message: 'Brand members retrieved successfully'
      }
    } catch (error) {
      console.error('Error getting brand members:', error)
      throw error
    }
  }

  // Update member role
  static async updateMemberRole(brandId: string, targetUserId: string, newRole: string, requesterId: string) {
    try {
      // Verify requester has admin access
      const requester = await prisma.brandMember.findFirst({
        where: {
          brandId,
          userId: requesterId,
          status: 'ACTIVE',
          role: {
            in: ['OWNER', 'ADMIN']
          }
        }
      })

      if (!requester) {
        throw new CustomError('Insufficient permissions to update member role', 403)
      }

      // Verify target user is a member
      const targetMember = await prisma.brandMember.findFirst({
        where: {
          brandId,
          userId: targetUserId,
          status: 'ACTIVE'
        }
      })

      if (!targetMember) {
        throw new CustomError('User is not a member of this brand', 404)
      }

      // Prevent changing owner role
      if (targetMember.role === 'OWNER') {
        throw new CustomError('Cannot change owner role', 403)
      }

      // Update member role
      const updatedMember = await prisma.brandMember.update({
        where: {
          id: targetMember.id
        },
        data: {
          role: newRole as any
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true
            }
          }
        }
      })

      return {
        success: true,
        data: updatedMember,
        message: 'Member role updated successfully'
      }
    } catch (error) {
      console.error('Error updating member role:', error)
      throw error
    }
  }

  // Remove member
  static async removeMember(brandId: string, targetUserId: string, requesterId: string) {
    try {
      // Verify requester has admin access
      const requester = await prisma.brandMember.findFirst({
        where: {
          brandId,
          userId: requesterId,
          status: 'ACTIVE',
          role: {
            in: ['OWNER', 'ADMIN']
          }
        }
      })

      if (!requester) {
        throw new CustomError('Insufficient permissions to remove member', 403)
      }

      // Verify target user is a member
      const targetMember = await prisma.brandMember.findFirst({
        where: {
          brandId,
          userId: targetUserId,
          status: 'ACTIVE'
        }
      })

      if (!targetMember) {
        throw new CustomError('User is not a member of this brand', 404)
      }

      // Prevent removing owner
      if (targetMember.role === 'OWNER') {
        throw new CustomError('Cannot remove brand owner', 403)
      }

      // Remove member (soft delete by setting status to INACTIVE)
      await prisma.brandMember.update({
        where: {
          id: targetMember.id
        },
        data: {
          status: 'INACTIVE'
        }
      })

      return {
        success: true,
        message: 'Member removed successfully'
      }
    } catch (error) {
      console.error('Error removing member:', error)
      throw error
    }
  }
}