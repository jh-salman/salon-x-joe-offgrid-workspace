import { Router, Request, Response, NextFunction } from 'express'
import { body, validationResult } from 'express-validator'
import { AuthService } from '../services/authService'
import { CustomError } from '../utils/customError'
import { prisma } from '../config/database'

const router = Router()

// Signup
router.post('/signup', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('firstName').trim().isLength({ min: 2 }),
  body('lastName').trim().isLength({ min: 2 }),
  body('phone').optional().isMobilePhone(),
  body('country').isIn(['BD', 'USA']),
  body('otpMethod').isIn(['EMAIL', 'SMS'])
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await AuthService.signup(req.body)
    return res.status(201).json(result)
  } catch (error) {
    return next(error)
  }
})

// Send OTP
router.post('/send-otp', [
  body('userId').isString(),
  body('otpType').isIn(['EMAIL', 'SMS']),
  body('purpose').isIn(['SIGNUP_VERIFICATION', 'LOGIN_VERIFICATION', 'PASSWORD_RESET', 'PHONE_VERIFICATION'])
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await AuthService.sendOTP(req.body.userId, req.body.otpType, req.body.purpose)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Verify OTP
router.post('/verify-otp', [
  body('otpId').isString(),
  body('otpCode').isLength({ min: 6, max: 6 }).isNumeric()
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await AuthService.verifyOTP(req.body.otpId, req.body.otpCode)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Signin
router.post('/signin', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 1 })
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deviceInfo = {
      deviceType: req.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'web',
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    }

    const result = await AuthService.signin(req.body.email, req.body.password, deviceInfo)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Face Login
router.post('/face-login', [
  body('faceData').isObject()
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deviceInfo = {
      deviceType: 'mobile',
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    }

    const result = await AuthService.faceLogin(req.body.faceData, deviceInfo)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Enable Face Recognition
router.post('/enable-face', [
  body('userId').isString(),
  body('faceData').isObject()
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await AuthService.enableFaceRecognition(req.body.userId, req.body.faceData)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Request Password Reset
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await AuthService.requestPasswordReset(req.body.email)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Reset Password
router.post('/reset-password', [
  body('token').isString(),
  body('password').isLength({ min: 8 })
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await AuthService.resetPassword(req.body.token, req.body.password)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Logout
router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '')
    if (!sessionToken) {
      throw new CustomError('Session token required', 401)
    }

    const result = await AuthService.logout(sessionToken)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Resend OTP
router.post('/resend-otp', [
  body('userId').isString()
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await AuthService.resendOTP(req.body.userId)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Verify token and get user info
router.get('/verify-token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      })
    }

    const result = await AuthService.verifyToken(token)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Get user by email (for OTP verification)
router.post('/get-user-by-email', [
  body('email').isEmail().withMessage('Invalid email address')
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body
    const result = await AuthService.getUserByEmail(email)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Activate user manually (admin endpoint for testing)
router.post('/activate-user', [
  body('email').isEmail().withMessage('Invalid email address')
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body
    const result = await AuthService.activateUser(email)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Cleanup expired users (admin endpoint)
router.post('/cleanup-expired', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await AuthService.cleanupExpiredUnverifiedUsers()
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

export default router