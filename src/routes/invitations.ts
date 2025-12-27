import { Router, Request, Response, NextFunction } from 'express'
import { AuthRequest } from '../middleware/authenticate'
import { body, param, query, validationResult } from 'express-validator'
import { InvitationService } from '../services/invitationService'
import { authenticate } from '../middleware/authenticate'
import { requireTenant } from '../middleware/rbac'

const router = Router()

// Apply authentication middleware to all routes
router.use(authenticate)

// Send brand invitation
router.post('/brand/:brandId/send', [
  param('brandId').isString().notEmpty().withMessage('Brand ID is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('role').isIn(['ADMIN', 'MANAGER', 'STAFF']).withMessage('Invalid role')
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

    const brandId = req.params.brandId!
    const inviterId = req.user!.id

    const result = await InvitationService.sendBrandInvitation(brandId, inviterId, {
      email: req.body.email,
      role: req.body.role
    })

    return res.status(201).json(result)
  } catch (error) {
    return next(error)
  }
})

// Accept brand invitation
router.post('/:invitationId/accept', [
  param('invitationId').isString().notEmpty().withMessage('Invitation ID is required')
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
    const result = await InvitationService.acceptBrandInvitation(req.params.invitationId!, userId)

    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Decline brand invitation
router.post('/:invitationId/decline', [
  param('invitationId').isString().notEmpty().withMessage('Invitation ID is required')
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
    const result = await InvitationService.declineBrandInvitation(req.params.invitationId!, userId)

    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Get user's pending invitations
router.get('/my-invitations', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id
    const result = await InvitationService.getUserInvitations(userId)

    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Get brand's sent invitations (admin only)
router.get('/brand/:brandId/sent', [
  param('brandId').isString().notEmpty().withMessage('Brand ID is required')
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

    const brandId = req.params.brandId!
    const adminUserId = req.user!.id
    const result = await InvitationService.getBrandInvitations(brandId, adminUserId)

    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Cancel invitation (admin only)
router.put('/:invitationId/cancel', [
  param('invitationId').isString().notEmpty().withMessage('Invitation ID is required')
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
    const result = await InvitationService.cancelInvitation(req.params.invitationId!, adminUserId)

    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Resend invitation (admin only)
router.put('/:invitationId/resend', [
  param('invitationId').isString().notEmpty().withMessage('Invitation ID is required')
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
    const result = await InvitationService.resendInvitation(req.params.invitationId!, adminUserId)

    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

export default router
