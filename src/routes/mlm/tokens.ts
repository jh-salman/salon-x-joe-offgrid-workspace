import { Router, Request, Response, NextFunction } from 'express'
import { AuthRequest } from '../../middleware/authenticate'
import { body, param, query, validationResult } from 'express-validator'
import { TokenService } from '../../services/mlm/tokenService'
import { authenticate } from '../../middleware/authenticate'
import { requireTenant } from '../../middleware/rbac'

const router = Router()

// Apply authentication and tenant middleware to all routes
router.use(authenticate)
router.use(requireTenant)

// Get user's token account
router.get('/account', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id
    const result = await TokenService.getUserTokenAccount(userId)

    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Get token statistics
router.get('/stats', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id
    const result = await TokenService.getTokenStats(userId)

    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Get token history
router.get('/history', [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      })
    }

    const userId = req.user!.id
    const limit = parseInt(req.query.limit as string) || 50

    const result = await TokenService.getTokenHistory(userId, limit)

    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Add tokens (admin only)
router.post('/add', [
  body('userId').isString().notEmpty().withMessage('User ID is required'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('reason').isString().notEmpty().withMessage('Reason is required')
], async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      })
    }

    const result = await TokenService.addTokens(
      req.body.userId,
      req.body.amount,
      req.body.reason
    )

    return res.status(201).json(result)
  } catch (error) {
    return next(error)
  }
})

// Spend tokens
router.post('/spend', [
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('reason').isString().notEmpty().withMessage('Reason is required')
], async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      })
    }

    const userId = req.user!.id
    const result = await TokenService.spendTokens(
      userId,
      req.body.amount,
      req.body.reason
    )

    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Transfer tokens
router.post('/transfer', [
  body('toUserId').isString().notEmpty().withMessage('Recipient user ID is required'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('reason').isString().notEmpty().withMessage('Reason is required')
], async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      })
    }

    const fromUserId = req.user!.id
    const result = await TokenService.transferTokens(
      fromUserId,
      req.body.toUserId,
      req.body.amount,
      req.body.reason
    )

    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Get token packages
router.get('/packages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await TokenService.getTokenPackages()

    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Create token package (admin only)
router.post('/packages', [
  body('name').isString().notEmpty().withMessage('Package name is required'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('tokenAmount').isFloat({ min: 0 }).withMessage('Token amount must be a positive number'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('currency').optional().isString().withMessage('Currency must be a string'),
  body('features').optional().isObject().withMessage('Features must be an object')
], async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      })
    }

    const adminUserId = req.user!.id
    const result = await TokenService.createTokenPackage(req.body, adminUserId)

    return res.status(201).json(result)
  } catch (error) {
    return next(error)
  }
})

// Purchase token package
router.post('/packages/:packageId/purchase', [
  param('packageId').isString().notEmpty().withMessage('Package ID is required'),
  body('paymentMethod').isString().notEmpty().withMessage('Payment method is required')
], async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      })
    }

    const userId = req.user!.id
    const result = await TokenService.purchaseTokenPackage(
      req.params.packageId!,
      userId,
      req.body.paymentMethod
    )

    return res.status(201).json(result)
  } catch (error) {
    return next(error)
  }
})

export default router
