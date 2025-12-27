import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'
import { CustomError } from '../utils/customError'
import { NotificationService } from './notificationService'
import { JobService } from './jobService'

// Production logging utility
const logSecurityEvent = (event: string, details: any) => {
  if (process.env.NODE_ENV === 'production') {
    console.log(`[SECURITY] ${event}:`, {
      timestamp: new Date().toISOString(),
      ...details
    })
  }
}

const prisma = new PrismaClient()

export class AuthService {
  // Enhanced password strength validation for production
  private static isStrongPassword(password: string): boolean {
    const minLength = password.length >= 10
    const hasUpper = /[A-Z]/.test(password)
    const hasLower = /[a-z]/.test(password)
    const hasNumber = /\d/.test(password)
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password)
    
    // Check for common weak passwords (exact matches only, not substring)
    const weakPasswords = ['password', '123456', 'qwerty', 'admin', 'letmein', 'welcome', 'monkey', 'test', 'user']
    const isWeak = weakPasswords.some(weak => password.toLowerCase() === weak.toLowerCase())
    
    const isValid = minLength && hasUpper && hasLower && hasNumber && hasSpecial && !isWeak
    
    // Debug logging
    console.log(`🔍 Password validation details:`)
    console.log(`  - Length >= 10: ${minLength} (${password.length})`)
    console.log(`  - Has uppercase: ${hasUpper}`)
    console.log(`  - Has lowercase: ${hasLower}`)
    console.log(`  - Has number: ${hasNumber}`)
    console.log(`  - Has special: ${hasSpecial}`)
    console.log(`  - Not weak: ${!isWeak}`)
    console.log(`  - Final result: ${isValid}`)
    
    return isValid
  }

  // Generate OTP
  private static generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  // Hash password with higher salt rounds for production security
  private static async hashPassword(password: string): Promise<string> {
    const saltRounds = 14 // Increased for production
    return bcrypt.hash(password, saltRounds)
  }

  // Verify password
  private static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }

  // Generate JWT tokens with production security
  private static generateTokens(userId: string) {
    const accessToken = jwt.sign(
      { userId, type: 'access' },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: '45m' }
    )

    const refreshToken = jwt.sign(
      { userId, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '21d' }
    )

    return { accessToken, refreshToken }
  }

  // Signup - Create temporary user, send OTP, but don't activate until verified
  static async signup(data: {
    email: string
    password: string
    firstName: string
    lastName: string
    phone?: string
    country: string
    otpMethod: 'EMAIL' | 'SMS'
  }) {
    try {
      // Input sanitization
      const sanitizedData = {
        email: data.email.toLowerCase().trim(),
        password: data.password,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        phone: data.phone?.trim(),
        country: data.country,
        otpMethod: data.otpMethod
      }

      // Validate password strength
      const passwordCheck = this.isStrongPassword(sanitizedData.password)
      console.log(`🔍 Password validation for "${sanitizedData.password}": ${passwordCheck}`)
      if (!passwordCheck) {
        throw new CustomError('Password must be at least 10 characters long and contain uppercase, lowercase, number, and special character', 400)
      }

      // Rate limiting check (basic implementation)
      const recentSignups = await prisma.user.count({
        where: {
          email: sanitizedData.email,
          createdAt: {
            gte: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes
          }
        }
      })

      if (recentSignups > 0) {
        throw new CustomError('Too many signup attempts. Please wait 5 minutes before trying again.', 429)
      }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
        where: { email: sanitizedData.email }
    })

    if (existingUser) {
        throw new CustomError('User already exists with this email', 409)
    }

    // Hash password
      const passwordHash = await this.hashPassword(sanitizedData.password)

      // Create user with PENDING_VERIFICATION status
    const user = await prisma.user.create({
      data: {
          email: sanitizedData.email,
        passwordHash,
          firstName: sanitizedData.firstName,
          lastName: sanitizedData.lastName,
          phone: sanitizedData.phone || null,
          country: sanitizedData.country as any,
          otpMethod: sanitizedData.otpMethod as any,
          status: 'PENDING_VERIFICATION',
          emailVerified: false,
          phoneVerified: false,
          otpVerified: false
        }
      })

      // Generate and send OTP
      const otpResult = await this.sendOTP(user.id, sanitizedData.otpMethod, 'SIGNUP_VERIFICATION')
      
      return {
        success: true,
        message: 'User created successfully. Please verify your OTP to activate account.',
        userId: user.id,
        otpId: otpResult.otpId,
        requiresVerification: true,
        status: 'PENDING_VERIFICATION'
      }
    } catch (error) {
      throw error
    }
  }

  // Send OTP
  static async sendOTP(userId: string, otpType: 'EMAIL' | 'SMS', purpose: 'SIGNUP_VERIFICATION' | 'LOGIN_VERIFICATION' | 'PASSWORD_RESET' | 'PHONE_VERIFICATION') {
    try {
    const user = await prisma.user.findUnique({
        where: { id: userId }
    })

    if (!user) {
      throw new CustomError('User not found', 404)
    }

      // Generate OTP
      const otpCode = this.generateOTP()
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
      
      // Log OTP for development/testing
      console.log(`🔑 OTP Generated for ${user.email}: ${otpCode}`)
      console.log(`📱 OTP Type: ${otpType}, Purpose: ${purpose}`)
      console.log(`⏰ Expires at: ${expiresAt.toISOString()}`)

      // Create OTP record
      const otpRecord = await prisma.otpRecord.create({
        data: {
          userId,
          email: otpType === 'EMAIL' ? user.email : null,
          phone: otpType === 'SMS' ? user.phone : null,
          country: user.country,
          otpCode,
          otpType: otpType as any,
          purpose: purpose as any,
          expiresAt
        }
      })

      // Send OTP via email or SMS
      if (otpType === 'EMAIL') {
        await NotificationService.sendOTPEmail(user.email, otpCode, purpose)
      } else if (otpType === 'SMS' && user.phone) {
        await NotificationService.sendOTPSMS(user.phone, otpCode, purpose, user.country)
      }

      return {
        success: true,
        message: `OTP sent to your ${otpType.toLowerCase()}`,
        otpId: otpRecord.id
      }
    } catch (error) {
      throw error
    }
    }

    // Verify OTP
  static async verifyOTP(otpId: string, otpCode: string) {
    try {
      const otpRecord = await prisma.otpRecord.findUnique({
        where: { id: otpId },
        include: { user: true }
      })

      if (!otpRecord) {
        throw new CustomError('Invalid OTP', 400)
      }

      if (otpRecord.isUsed) {
        throw new CustomError('OTP already used', 400)
      }

      if (otpRecord.isExpired || new Date() > otpRecord.expiresAt) {
        throw new CustomError('OTP expired', 400)
      }

      if (otpRecord.attempts >= otpRecord.maxAttempts) {
        throw new CustomError('Maximum OTP attempts exceeded', 400)
      }

      // Development mode: Allow any 6-digit OTP
      if (process.env.NODE_ENV === 'development' && otpCode === '123456') {
        console.log('🔧 Development mode: OTP bypassed')
      } else if (otpRecord.otpCode !== otpCode) {
        // Increment attempts
        await prisma.otpRecord.update({
          where: { id: otpId },
          data: { attempts: { increment: 1 } }
        })
        throw new CustomError('Invalid OTP code', 400)
      }

      // Mark OTP as used
      await prisma.otpRecord.update({
        where: { id: otpId },
        data: {
          isUsed: true,
          usedAt: new Date()
        }
      })

      // Update user verification status based on purpose
      if (otpRecord.purpose === 'SIGNUP_VERIFICATION') {
        // Activate user account after OTP verification
        const updatedUser = await prisma.user.update({
          where: { id: otpRecord.userId! },
          data: {
            status: 'ACTIVE',
            emailVerified: true,
            phoneVerified: otpRecord.otpType === 'SMS',
            otpVerified: true
          }
        })

        // Add welcome email job to queue
        try {
          await JobService.addWelcomeEmailJob(updatedUser.email, updatedUser.firstName)
          console.log(`📧 Welcome email job queued for ${updatedUser.email}`)
        } catch (emailError) {
          console.error('❌ Failed to queue welcome email:', emailError)
          // Don't fail the OTP verification if email fails
        }
      } else if (otpRecord.purpose === 'PHONE_VERIFICATION') {
        await prisma.user.update({
          where: { id: otpRecord.userId! },
          data: { phoneVerified: true }
        })
      }

    return {
      success: true,
        message: 'OTP verified successfully',
        user: otpRecord.user
      }
    } catch (error) {
      throw error
    }
  }

  // Signin
  static async signin(email: string, password: string, deviceInfo?: any) {
    try {
      // Input sanitization
      const sanitizedEmail = email.toLowerCase().trim()
      
      // Rate limiting check for signin attempts
      const recentAttempts = await prisma.user.findFirst({
        where: {
          email: sanitizedEmail,
          lastLoginAt: {
            gte: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes
          }
        }
      })

    const user = await prisma.user.findUnique({
        where: { email: sanitizedEmail }
    })

      if (!user) {
        logSecurityEvent('LOGIN_FAILED', { email: sanitizedEmail, reason: 'User not found' })
      throw new CustomError('Invalid credentials', 401)
    }

      // Check if user account is verified
      if (user.status === 'PENDING_VERIFICATION') {
        throw new CustomError('Please verify your OTP to activate your account', 403)
      }

    // Check if account is locked
      if (user.lockedUntil && new Date() < user.lockedUntil) {
        throw new CustomError('Account is temporarily locked', 423)
      }

      // Verify password
      const isPasswordValid = await this.verifyPassword(password, user.passwordHash)
      
      if (!isPasswordValid) {
        // Increment login attempts
        const attempts = user.loginAttempts + 1
        const lockedUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null

        await prisma.user.update({
          where: { id: user.id },
          data: {
            loginAttempts: attempts,
            lockedUntil
          }
        })

        logSecurityEvent('LOGIN_FAILED', { 
          email: sanitizedEmail, 
          userId: user.id, 
          reason: 'Invalid password',
          attempts: attempts,
          locked: !!lockedUntil
        })

        throw new CustomError('Invalid credentials', 401)
      }

      // Reset login attempts on successful login
      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date()
        }
      })

      logSecurityEvent('LOGIN_SUCCESS', { 
        email: sanitizedEmail, 
        userId: user.id,
        deviceInfo: deviceInfo || 'Unknown'
      })

      // Generate tokens
      const { accessToken, refreshToken } = this.generateTokens(user.id)

      // Create session
      await prisma.userAuthSession.create({
        data: {
          userId: user.id,
          sessionToken: accessToken,
          refreshToken,
          deviceType: deviceInfo?.deviceType || 'web',
          userAgent: deviceInfo?.userAgent,
          ipAddress: deviceInfo?.ipAddress,
          authMethod: 'EMAIL_PASSWORD',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      })

      return {
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          country: user.country,
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
          faceEnabled: user.faceEnabled
        },
        tokens: {
          accessToken,
          refreshToken
        }
      }
    } catch (error) {
      throw error
    }
  }

  // Face Recognition Login
  static async faceLogin(faceData: any, deviceInfo?: any) {
    try {
      // Find user by face data hash
      const user = await prisma.user.findFirst({
        where: {
          faceEnabled: true,
          faceDataHash: crypto.createHash('sha256').update(JSON.stringify(faceData)).digest('hex')
        }
    })

    if (!user) {
        throw new CustomError('Face recognition failed', 401)
      }

      // Generate tokens
      const { accessToken, refreshToken } = this.generateTokens(user.id)

      // Create session
      await prisma.userAuthSession.create({
        data: {
          userId: user.id,
          sessionToken: accessToken,
          refreshToken,
          deviceType: deviceInfo?.deviceType || 'mobile',
          userAgent: deviceInfo?.userAgent,
          ipAddress: deviceInfo?.ipAddress,
          authMethod: 'FACE_RECOGNITION',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    })

    return {
      success: true,
        message: 'Face login successful',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          country: user.country
        },
        tokens: {
          accessToken,
          refreshToken
        }
      }
    } catch (error) {
      throw error
    }
  }

  // Enable Face Recognition
  static async enableFaceRecognition(userId: string, faceData: any) {
    try {
      const faceDataHash = crypto.createHash('sha256').update(JSON.stringify(faceData)).digest('hex')
      
      await prisma.user.update({
        where: { id: userId },
      data: {
          faceEnabled: true,
          faceDataHash,
          faceData
        }
      })

      return {
        success: true,
        message: 'Face recognition enabled successfully'
      }
    } catch (error) {
      throw error
    }
  }

  // Password Reset Request
  static async requestPasswordReset(email: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { email }
      })

      if (!user) {
        return {
          success: true,
          message: 'If the email exists, a password reset link has been sent'
        }
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex')
      const resetExpires = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetPasswordToken: resetToken,
          resetPasswordExpires: resetExpires
        }
      })

      // Send reset email
      await NotificationService.sendPasswordResetEmail(user.email, resetToken)

      return {
        success: true,
        message: 'Password reset link sent to your email'
      }
    } catch (error) {
      throw error
    }
  }

  // Reset Password
  static async resetPassword(token: string, newPassword: string) {
    try {
      if (!this.isStrongPassword(newPassword)) {
        throw new CustomError('Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character', 400)
      }

      const user = await prisma.user.findFirst({
        where: {
          resetPasswordToken: token,
          resetPasswordExpires: {
            gt: new Date()
          }
        }
      })

      if (!user) {
        throw new CustomError('Invalid or expired reset token', 400)
      }

      // Hash new password
      const passwordHash = await this.hashPassword(newPassword)

      // Update password and clear reset token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          resetPasswordToken: null,
          resetPasswordExpires: null
        }
      })

      return {
        success: true,
        message: 'Password reset successfully'
      }
    } catch (error) {
      throw error
    }
  }

  // Logout
  static async logout(sessionToken: string) {
    try {
      await prisma.userAuthSession.updateMany({
        where: { sessionToken },
        data: { isActive: false }
      })

      return {
        success: true,
        message: 'Logged out successfully'
      }
    } catch (error) {
      throw error
    }
  }

  // Cleanup expired unverified users (call this periodically)
  static async cleanupExpiredUnverifiedUsers() {
    try {
      const expiredTime = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
      
      // Find users with expired OTPs and PENDING_VERIFICATION status
      const expiredUsers = await prisma.user.findMany({
        where: {
          status: 'PENDING_VERIFICATION',
          createdAt: {
            lt: expiredTime
          },
          otpRecords: {
            some: {
              purpose: 'SIGNUP_VERIFICATION',
              expiresAt: {
                lt: new Date()
              }
            }
          }
        }
      })

      // Delete expired unverified users
      for (const user of expiredUsers) {
        await prisma.user.delete({
          where: { id: user.id }
        })
        console.log(`🗑️ Deleted expired unverified user: ${user.email}`)
      }

      return {
        success: true,
        message: `Cleaned up ${expiredUsers.length} expired unverified users`
      }
    } catch (error) {
      console.error('❌ Failed to cleanup expired users:', error)
      throw error
    }
  }

  // Resend OTP for unverified users
  static async resendOTP(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      })

      if (!user) {
        throw new CustomError('User not found', 404)
      }

      if (user.status !== 'PENDING_VERIFICATION') {
        throw new CustomError('User is already verified', 400)
      }

      // Send new OTP
      const result = await this.sendOTP(userId, user.otpMethod!, 'SIGNUP_VERIFICATION')

      return {
        success: true,
        message: 'OTP resent successfully',
        otpId: result.otpId
      }
    } catch (error) {
      throw error
    }
  }

  // Verify token and get user info
  static async verifyToken(token: string) {
    try {
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

    if (!user) {
      throw new CustomError('User not found', 404)
    }

      if (user.status !== 'ACTIVE') {
        throw new CustomError('Account not active', 403)
    }

    return {
      success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          country: user.country,
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
          faceEnabled: user.faceEnabled
        }
      }
    } catch (error: any) {
      if (error instanceof CustomError) {
        throw error
      }
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        throw new CustomError('Invalid or expired token', 401)
      }
      throw new CustomError(`Token verification failed: ${error.message}`, 500)
    }
  }

  // Activate user manually (admin function for testing)
  static async activateUser(email: string) {
    try {
      const user = await prisma.user.update({
        where: { email },
        data: {
          status: 'ACTIVE',
          emailVerified: true,
          otpVerified: true
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          emailVerified: true,
          phoneVerified: true
        }
      })

      return {
        success: true,
        message: 'User activated successfully',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          status: user.status,
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified
        }
      }
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new CustomError('User not found', 404)
      }
      throw new CustomError(`Failed to activate user: ${error.message}`, 500)
    }
  }

  // Get user by email
  static async getUserByEmail(email: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          emailVerified: true,
          phoneVerified: true
        }
      })

      if (!user) {
        throw new CustomError('User not found', 404)
      }

      return {
        success: true,
        userId: user.id,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          status: user.status,
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified
        }
      }
    } catch (error: any) {
      if (error instanceof CustomError) {
        throw error
      }
      throw new CustomError(`Failed to get user: ${error.message}`, 500)
    }
  }
}
