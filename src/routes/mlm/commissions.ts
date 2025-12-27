import { Router, Request, Response, NextFunction } from 'express'
import { AuthRequest } from '../../middleware/authenticate'
import { body, param, query, validationResult } from 'express-validator'
import { CommissionService } from '../../services/mlm/commissionService'
import { authenticate } from '../../middleware/authenticate'
import { requireTenant } from '../../middleware/rbac'

const router = Router()

// Apply authentication and tenant middleware to all routes
router.use(authenticate)
router.use(requireTenant)

// Get user's commissions
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

    const result = await CommissionService.getUserCommissions(userId, brandId)

    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Get commission statistics
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

    const result = await CommissionService.getCommissionStats(userId, brandId)

    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Update commission status (admin only)
router.put('/:commissionId/status', [
  param('commissionId').isString().notEmpty().withMessage('Commission ID is required'),
  body('status').isIn(['PENDING', 'APPROVED', 'PAID', 'CANCELLED']).withMessage('Invalid status')
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
    const result = await CommissionService.updateCommissionStatus(
      req.params.commissionId!,
      req.body.status,
      adminUserId
    )

    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Get all commissions for admin (brand-specific)
router.get('/admin/all', [
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

    const adminUserId = req.user!.id
    const brandId = req.query.brandId as string || req.headers['x-brand-id'] as string

    const result = await CommissionService.getAllCommissions(brandId, adminUserId)

    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Calculate and create commissions for a referral event
router.post('/calculate', [
  body('referralId').isString().notEmpty().withMessage('Referral ID is required'),
  body('eventType').isIn(['REFERRAL', 'BRAND_CREATION', 'STAFF_REFERRAL', 'TOKEN_PURCHASE']).withMessage('Invalid event type'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number')
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

    const result = await CommissionService.calculateAndCreateCommissions(
      req.body.referralId,
      req.body.eventType,
      req.body.amount
    )

    return res.status(201).json(result)
  } catch (error) {
    return next(error)
  }
})

export default router
