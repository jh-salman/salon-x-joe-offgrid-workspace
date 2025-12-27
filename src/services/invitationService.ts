import { PrismaClient } from '@prisma/client'
import { CustomError } from '../utils/customError'
import { NotificationService } from './notificationService'
import { JobService } from './jobService'
import crypto from 'crypto'

const prisma = new PrismaClient()

export class InvitationService {
  // Send brand invitation
  static async sendBrandInvitation(brandId: string, inviterId: string, inviteData: {
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

      // If user exists, check if they're already a member
      if (existingUser) {
        const existingMembership = await prisma.brandMember.findFirst({
          where: {
            brandId,
            userId: existingUser.id
          }
        })

        if (existingMembership) {
          throw new CustomError('User is already a member of this brand', 409)
        }
      }

      // Check if invitation already exists
      const existingInvitation = await prisma.brandInvitation.findFirst({
        where: {
          brandId,
          email: inviteData.email,
          status: 'PENDING'
        }
      })

      if (existingInvitation) {
        throw new CustomError('Invitation already sent to this user', 409)
      }

      // Generate unique token
      const token = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiry

      // Create invitation
      const invitation = await prisma.brandInvitation.create({
        data: {
          brandId,
          email: inviteData.email,
          role: inviteData.role,
          token,
          invitedBy: inviterId,
          expiresAt
        },
        include: {
          brand: {
            select: {
              id: true,
              name: true,
              description: true
            }
          },
          inviter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      })

      // Send invitation email via background job
      try {
        const invitationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invitation/${invitation.id}?token=${invitation.token}`
        
        await JobService.addInvitationEmailJob(
          invitation.email,
          `${invitation.inviter.firstName} ${invitation.inviter.lastName}`,
          invitation.brand.name,
          invitation.role,
          invitationLink
        )
        console.log(`📧 Invitation email job queued for ${invitation.email}`)
      } catch (emailError) {
        console.error('Failed to queue invitation email:', emailError)
        // Don't fail the invitation creation if email fails
      }

      return {
        success: true,
        data: invitation,
        message: 'Invitation sent successfully'
      }
    } catch (error) {
      console.error('Error sending brand invitation:', error)
      throw error
    }
  }

  // Accept brand invitation
  static async acceptBrandInvitation(invitationId: string, userId: string) {
    try {
      const invitation = await prisma.brandInvitation.findUnique({
        where: { id: invitationId },
        include: { 
          brand: true,
          inviter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
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

      // Verify user email matches invitation
      const user = await prisma.user.findUnique({
        where: { id: userId }
      })

      if (!user || user.email !== invitation.email) {
        throw new CustomError('Email mismatch - invitation is for a different user', 400)
      }

      // Check if user is already a member
      const existingMembership = await prisma.brandMember.findFirst({
        where: {
          brandId: invitation.brandId,
          userId
        }
      })

      if (existingMembership) {
        throw new CustomError('User is already a member of this brand', 409)
      }

      // Create brand membership
      const membership = await prisma.brandMember.create({
        data: {
          brandId: invitation.brandId,
          userId,
          role: invitation.role,
          status: 'ACTIVE',
          invitedBy: invitation.invitedBy
        },
        include: {
          brand: {
            select: {
              id: true,
              name: true,
              description: true
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
        data: membership,
        message: 'Invitation accepted successfully'
      }
    } catch (error) {
      console.error('Error accepting brand invitation:', error)
      throw error
    }
  }

  // Decline brand invitation
  static async declineBrandInvitation(invitationId: string, userId: string) {
    try {
      const invitation = await prisma.brandInvitation.findUnique({
        where: { id: invitationId }
      })

      if (!invitation) {
        throw new CustomError('Invitation not found', 404)
      }

      if (invitation.status !== 'PENDING') {
        throw new CustomError('Invitation is no longer valid', 400)
      }

      // Verify user email matches invitation
      const user = await prisma.user.findUnique({
        where: { id: userId }
      })

      if (!user || user.email !== invitation.email) {
        throw new CustomError('Email mismatch - invitation is for a different user', 400)
      }

      // Update invitation status
      await prisma.brandInvitation.update({
        where: { id: invitationId },
        data: {
          status: 'DECLINED'
        }
      })

      return {
        success: true,
        message: 'Invitation declined successfully'
      }
    } catch (error) {
      console.error('Error declining brand invitation:', error)
      throw error
    }
  }

  // Get user's pending invitations
  static async getUserInvitations(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      })

      if (!user) {
        throw new CustomError('User not found', 404)
      }

      const invitations = await prisma.brandInvitation.findMany({
        where: {
          email: user.email,
          status: 'PENDING',
          expiresAt: {
            gt: new Date()
          }
        },
        include: {
          brand: {
            select: {
              id: true,
              name: true,
              description: true,
              logo: true
            }
          },
          inviter: {
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
        data: invitations
      }
    } catch (error) {
      console.error('Error getting user invitations:', error)
      throw error
    }
  }

  // Get brand's sent invitations
  static async getBrandInvitations(brandId: string, adminUserId: string) {
    try {
      // Check if user has admin permissions
      const adminMembership = await prisma.brandMember.findFirst({
        where: {
          brandId,
          userId: adminUserId,
          role: {
            in: ['OWNER', 'ADMIN']
          },
          status: 'ACTIVE'
        }
      })

      if (!adminMembership) {
        throw new CustomError('Insufficient permissions to view invitations', 403)
      }

      const invitations = await prisma.brandInvitation.findMany({
        where: { brandId },
        include: {
          inviter: {
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
        data: invitations
      }
    } catch (error) {
      console.error('Error getting brand invitations:', error)
      throw error
    }
  }

  // Cancel invitation
  static async cancelInvitation(invitationId: string, adminUserId: string) {
    try {
      const invitation = await prisma.brandInvitation.findUnique({
        where: { id: invitationId }
      })

      if (!invitation) {
        throw new CustomError('Invitation not found', 404)
      }

      // Check if user has admin permissions for this brand
      const adminMembership = await prisma.brandMember.findFirst({
        where: {
          brandId: invitation.brandId,
          userId: adminUserId,
          role: {
            in: ['OWNER', 'ADMIN']
          },
          status: 'ACTIVE'
        }
      })

      if (!adminMembership) {
        throw new CustomError('Insufficient permissions to cancel invitation', 403)
      }

      if (invitation.status !== 'PENDING') {
        throw new CustomError('Can only cancel pending invitations', 400)
      }

      // Update invitation status
      await prisma.brandInvitation.update({
        where: { id: invitationId },
        data: {
          status: 'CANCELLED'
        }
      })

      return {
        success: true,
        message: 'Invitation cancelled successfully'
      }
    } catch (error) {
      console.error('Error cancelling invitation:', error)
      throw error
    }
  }

  // Resend invitation
  static async resendInvitation(invitationId: string, adminUserId: string) {
    try {
      const invitation = await prisma.brandInvitation.findUnique({
        where: { id: invitationId }
      })

      if (!invitation) {
        throw new CustomError('Invitation not found', 404)
      }

      // Check if user has admin permissions for this brand
      const adminMembership = await prisma.brandMember.findFirst({
        where: {
          brandId: invitation.brandId,
          userId: adminUserId,
          role: {
            in: ['OWNER', 'ADMIN']
          },
          status: 'ACTIVE'
        }
      })

      if (!adminMembership) {
        throw new CustomError('Insufficient permissions to resend invitation', 403)
      }

      if (invitation.status !== 'PENDING') {
        throw new CustomError('Can only resend pending invitations', 400)
      }

      // Generate new token and extend expiry
      const newToken = crypto.randomBytes(32).toString('hex')
      const newExpiresAt = new Date()
      newExpiresAt.setDate(newExpiresAt.getDate() + 7) // 7 days from now

      // Update invitation
      const updatedInvitation = await prisma.brandInvitation.update({
        where: { id: invitationId },
        data: {
          token: newToken,
          expiresAt: newExpiresAt,
          updatedAt: new Date()
        },
        include: {
          brand: {
            select: {
              id: true,
              name: true,
              description: true
            }
          },
          inviter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      })

      // Send invitation email
      try {
        await InvitationService.sendInvitationEmail(updatedInvitation)
      } catch (emailError) {
        console.error('Failed to resend invitation email:', emailError)
        // Don't fail the invitation update if email fails
      }

      return {
        success: true,
        data: updatedInvitation,
        message: 'Invitation resent successfully'
      }
    } catch (error) {
      console.error('Error resending invitation:', error)
      throw error
    }
  }

  // Send invitation email
  static async sendInvitationEmail(invitation: any) {
    try {
      const invitationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invitation/${invitation.id}?token=${invitation.token}`
      
      const subject = `You're invited to join ${invitation.brand.name} on SalonX`
      
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #3B82F6; margin: 0;">SalonX</h1>
            <p style="color: #6b7280; margin: 5px 0;">Your Beauty Management Platform</p>
          </div>
          
          <h2 style="color: #1f2937; margin-bottom: 20px;">You're Invited! 🎉</h2>
          
          <p style="color: #374151; font-size: 16px; margin-bottom: 20px;">
            Hello! <strong>${invitation.inviter.firstName} ${invitation.inviter.lastName}</strong> has invited you to join 
            <strong>${invitation.brand.name}</strong> as a <strong>${invitation.role}</strong>.
          </p>
          
          ${invitation.brand.description ? `
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #6b7280; margin: 0; font-size: 14px;">
                <strong>About ${invitation.brand.name}:</strong><br>
                ${invitation.brand.description}
              </p>
            </div>
          ` : ''}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationLink}" 
               style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          
          <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #92400e; margin: 0; font-size: 14px;">
              ⏰ <strong>This invitation expires in 7 days.</strong><br>
              If you don't have a SalonX account, you'll be prompted to create one when you accept the invitation.
            </p>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin: 20px 0;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${invitationLink}" style="color: #3B82F6; word-break: break-all;">${invitationLink}</a>
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #6b7280; font-size: 12px; margin: 0;">
            This invitation was sent by ${invitation.inviter.firstName} ${invitation.inviter.lastName} (${invitation.inviter.email}).<br>
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
      `

      const text = `
        You're Invited to Join ${invitation.brand.name} on SalonX!
        
        Hello! ${invitation.inviter.firstName} ${invitation.inviter.lastName} has invited you to join ${invitation.brand.name} as a ${invitation.role}.
        
        ${invitation.brand.description ? `About ${invitation.brand.name}: ${invitation.brand.description}` : ''}
        
        Accept your invitation: ${invitationLink}
        
        This invitation expires in 7 days. If you don't have a SalonX account, you'll be prompted to create one when you accept the invitation.
        
        This invitation was sent by ${invitation.inviter.firstName} ${invitation.inviter.lastName} (${invitation.inviter.email}).
        If you didn't expect this invitation, you can safely ignore this email.
      `

      await NotificationService.sendEmail(invitation.email, subject, html, text)
      
      return {
        success: true,
        message: 'Invitation email sent successfully'
      }
    } catch (error) {
      console.error('Error sending invitation email:', error)
      throw error
    }
  }
}
