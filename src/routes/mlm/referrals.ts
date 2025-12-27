import { Router, Request, Response, NextFunction } from 'express'
import { AuthRequest } from '../../middleware/authenticate'
import { body, param, query, validationResult } from 'express-validator'
import { ReferralService } from '../../services/mlm/referralService'
import { authenticate } from '../../middleware/authenticate'
import { requireTenant } from '../../middleware/rbac'

const router = Router()

// Apply authentication and tenant middleware to all routes
router.use(authenticate)
router.use(requireTenant)

// Create a new referral
router.post('/', [
  body('referredId').isString().notEmpty().withMessage('Referred user ID is required'),
  body('type').isIn(['USER_REFERRAL', 'BRAND_REFERRAL', 'STAFF_REFERRAL']).withMessage('Invalid referral type'),
  body('commissionRate').optional().isFloat({ min: 0, max: 1 }).withMessage('Commission rate must be between 0 and 1'),
  body('level').optional().isInt({ min: 1, max: 10 }).withMessage('Level must be between 1 and 10')
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

    const brandId = req.headers['x-brand-id'] as string
    const referrerId = req.user!.id

    const result = await ReferralService.createReferral({
      referrerId,
      referredId: req.body.referredId,
      brandId,
      type: req.body.type,
      commissionRate: req.body.commissionRate,
      level: req.body.level
    })

    return res.status(201).json(result)
  } catch (error) {
    return next(error)
  }
})

// Get user's referrals
router.get('/', [
  query('brandId').optional().isString().withMessage('Brand ID must be a string')
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
    const brandId = req.query.brandId as string || req.headers['x-brand-id'] as string

    const result = await ReferralService.getUserReferrals(userId, brandId)

    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Get user's referral network (downline)
router.get('/network', [
  query('brandId').optional().isString().withMessage('Brand ID must be a string'),
  query('maxLevel').optional().isInt({ min: 1, max: 10 }).withMessage('Max level must be between 1 and 10')
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
    const brandId = req.query.brandId as string || req.headers['x-brand-id'] as string
    const maxLevel = parseInt(req.query.maxLevel as string) || 3

    const result = await ReferralService.getUserReferralNetwork(userId, brandId, maxLevel)

    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Get referral statistics
router.get('/stats', [
  query('brandId').optional().isString().withMessage('Brand ID must be a string')
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
    const brandId = req.query.brandId as string || req.headers['x-brand-id'] as string

    const result = await ReferralService.getReferralStats(userId, brandId)

    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Update referral status
router.put('/:referralId/status', [
  param('referralId').isString().notEmpty().withMessage('Referral ID is required'),
  body('status').isIn(['PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED']).withMessage('Invalid status')
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

    const result = await ReferralService.updateReferralStatus(req.params.referralId!, req.body.status)

    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Delete referral
router.delete('/:referralId', [
  param('referralId').isString().notEmpty().withMessage('Referral ID is required')
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
    const result = await ReferralService.deleteReferral(req.params.referralId!, userId)

    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

export default router