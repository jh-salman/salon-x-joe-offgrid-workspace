import { Router, Response, NextFunction } from 'express'
import { body } from 'express-validator'
import { authenticate, AuthRequest } from '../middleware/authenticate'
import { BrandContextService } from '../services/brandContextService'
import { CustomError } from '../utils/customError'

const router = Router()

// Apply authentication to all routes
router.use(authenticate)

// Get user's accessible brands
router.get('/brands', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await BrandContextService.getUserAccessibleBrands(req.user!.id)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Get current brand context
router.get('/current', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const brandId = req.query.brandId as string
    const result = await BrandContextService.getCurrentBrandContext(req.user!.id, brandId)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Switch to a different brand
router.post('/switch', [
  body('brandId').isString().withMessage('Brand ID is required')
], async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await BrandContextService.switchBrand(req.user!.id, req.body.brandId)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

// Validate brand access
router.get('/validate/:brandId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await BrandContextService.validateBrandAccess(req.user!.id, req.params.brandId!)
    return res.json({
      success: true,
      data: result
    })
  } catch (error) {
    return next(error)
  }
})

export default router