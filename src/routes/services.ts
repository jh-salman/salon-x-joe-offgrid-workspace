import { Router, Response, NextFunction } from 'express'
import { body, validationResult } from 'express-validator'
import { authenticate, AuthRequest } from '../middleware/authenticate'
import { requireTenant } from '../middleware/rbac'
import { PrismaClient } from '@prisma/client'
import { CustomError } from '../utils/customError'

const router = Router()
const prisma = new PrismaClient()

// Apply authentication to all routes
router.use(authenticate)

// Get all services for current brand
router.get('/', requireTenant, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    console.log('🔍 Debug - prisma:', prisma)
    console.log('🔍 Debug - prisma.brandService:', prisma?.service)
    console.log('🔍 Debug - prisma.brandService:', prisma?.brandService)
    const services = await prisma.brandService.findMany({
      where: {
        brandId: req.tenant!.id
      },
      include: {
        category: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return res.json({
      success: true,
      data: services
    })
  } catch (error) {
    return next(error)
  }
})

// Get single service by ID
router.get('/:id', requireTenant, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const service = await prisma.brandService.findFirst({
      where: {
        id: req.params.id,
        brandId: req.tenant!.id
      },
      include: {
        category: true
      }
    })

    if (!service) {
      throw new CustomError('Service not found', 404)
    }

    return res.json({
      success: true,
      data: service
    })
  } catch (error) {
    return next(error)
  }
})

// Create new service
router.post('/', [
  requireTenant,
  body('name').trim().isLength({ min: 2 }).withMessage('Service name is required'),
  body('description').optional().trim(),
  body('price').isNumeric().withMessage('Price must be a number'),
  body('duration').isInt({ min: 15 }).withMessage('Duration must be at least 15 minutes'),
      body('categoryId').optional().trim(),
  body('isActive').optional().isBoolean()
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

    const service = await prisma.brandService.create({
      data: {
        name: req.body.name,
        description: req.body.description || null,
        price: parseFloat(req.body.price),
        duration: parseInt(req.body.duration),
        categoryId: req.body.categoryId || null,
        isActive: req.body.isActive !== undefined ? req.body.isActive : true,
        brandId: req.tenant!.id
      }
    })

    return res.status(201).json({
      success: true,
      message: 'Service created successfully',
      data: service
    })
  } catch (error) {
    return next(error)
  }
})

// Update service
router.put('/:id', [
  requireTenant,
  body('name').optional().trim().isLength({ min: 2 }),
  body('description').optional().trim(),
  body('price').optional().isNumeric(),
  body('duration').optional().isInt({ min: 15 }),
      body('categoryId').optional().trim(),
  body('isActive').optional().isBoolean()
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

    // Check if service exists and belongs to current brand
    const existingService = await prisma.brandService.findFirst({
      where: {
        id: req.params.id,
        brandId: req.tenant!.id
      }
    })

    if (!existingService) {
      throw new CustomError('Service not found', 404)
    }

    const updateData: any = {}
    if (req.body.name) updateData.name = req.body.name
    if (req.body.description !== undefined) updateData.description = req.body.description
    if (req.body.price) updateData.price = parseFloat(req.body.price)
    if (req.body.duration) updateData.duration = parseInt(req.body.duration)
        if (req.body.categoryId !== undefined) updateData.categoryId = req.body.categoryId
    if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive

    const service = await prisma.brandService.update({
      where: { id: req.params.id },
      data: updateData
    })

    return res.json({
      success: true,
      message: 'Service updated successfully',
      data: service
    })
  } catch (error) {
    return next(error)
  }
})

// Delete service
router.delete('/:id', requireTenant, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Check if service exists and belongs to current brand
    const existingService = await prisma.brandService.findFirst({
      where: {
        id: req.params.id,
        brandId: req.tenant!.id
      }
    })

    if (!existingService) {
      throw new CustomError('Service not found', 404)
    }

    await prisma.brandService.delete({
      where: { id: req.params.id }
    })

    return res.json({
      success: true,
      message: 'Service deleted successfully'
    })
  } catch (error) {
    return next(error)
  }
})

// Get service categories
router.get('/categories/list', requireTenant, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.brandService.findMany({
      where: {
        brandId: req.tenant!.id,
        category: {
          not: null
        }
      },
      select: {
        category: true
      },
      distinct: ['category']
    })

    const categoryList = categories
      .map(item => item.category)
      .filter(category => category !== null)

    return res.json({
      success: true,
      data: categoryList
    })
  } catch (error) {
    return next(error)
  }
})

export default router