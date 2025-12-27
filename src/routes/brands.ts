import { Router, Response, NextFunction } from 'express'
import { body } from 'express-validator'
import { authenticate, AuthRequest } from '../middleware/authenticate'
import { requireTenant, requireOwnerOrAdmin, requireOwner, requireStaffOrAbove, requireAdminOrAbove } from '../middleware/rbac'
import { BrandService } from '../services/brandService'
import { CustomError } from '../utils/customError'

const router = Router()

// Apply authentication to all routes
router.use(authenticate)

// Create new brand
router.post('/create', [
  body('name').trim().isLength({ min: 2 }).withMessage('Brand name is required'),
  body('subdomain').trim().isLength({ min: 3 }).withMessage('Subdomain is required'),
  body('description').optional().trim(),
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('phone').optional().isMobilePhone().withMessage('Valid phone required'),
  body('website').optional().isURL().withMessage('Valid website URL required'),
  body('address').optional().trim(),
  body('city').optional().trim(),
  body('state').optional().trim(),
  body('zipCode').optional().trim(),
  body('country').optional().trim()
], async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await BrandService.createBrand({
      ...req.body,
      ownerId: req.user!.id
    })

    return res.status(201).json(result)
  } catch (error) {
    return next(error)
  }
})

// Get user's brands (multi-tenant support)
router.get('/my-brands', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await BrandService.getUserBrands(req.user!.id)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Apply brand context for brand-specific routes
router.use('/:brandId', requireTenant)

// Get brand details (with brand context)
router.get('/:brandId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await BrandService.getBrandById(req.tenant!.id, req.user!.id)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Update brand (owner/admin only)
router.put('/:brandId', [
  body('name').optional().trim().isLength({ min: 2 }),
  body('subdomain').optional().trim().isLength({ min: 3 }),
  body('description').optional().trim(),
  body('email').optional().isEmail(),
  body('phone').optional().isMobilePhone(),
  body('website').optional().isURL(),
  body('address').optional().trim(),
  body('city').optional().trim(),
  body('state').optional().trim(),
  body('zipCode').optional().trim(),
  body('country').optional().trim(),
  body('businessHours').optional().isObject()
], requireOwnerOrAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await BrandService.updateBrand(req.tenant!.id, req.user!.id, req.body)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Get brand statistics
router.get('/:brandId/stats', requireStaffOrAbove, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await BrandService.getBrandStats(req.tenant!.id, req.user!.id)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Get brand members
router.get('/:brandId/members', requireStaffOrAbove, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await BrandService.getBrandMembers(req.tenant!.id, req.user!.id)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Update member role
router.put('/:brandId/members/:userId', requireAdminOrAbove, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params
    const { role } = req.body
    const result = await BrandService.updateMemberRole(req.tenant!.id, userId, role, req.user!.id)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Remove member
router.delete('/:brandId/members/:userId', requireAdminOrAbove, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params
    const result = await BrandService.removeMember(req.tenant!.id, userId, req.user!.id)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Note: Invitation functionality moved to /api/invitations routes

// Delete brand (owner only)
router.delete('/:brandId', requireOwner, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await BrandService.deleteBrand(req.tenant!.id, req.user!.id)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

export default router