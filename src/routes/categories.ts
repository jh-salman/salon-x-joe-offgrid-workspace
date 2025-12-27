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

// Get all categories for current brand
router.get('/', requireTenant, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.brandCategory.findMany({
      where: {
        brandId: req.tenant!.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return res.json({
      success: true,
      data: categories
    })
  } catch (error) {
    return next(error)
  }
})

// Get single category by ID
router.get('/:id', requireTenant, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const category = await prisma.brandCategory.findFirst({
      where: {
        id: req.params.id,
        brandId: req.tenant!.id
      }
    })

    if (!category) {
      throw new CustomError('Category not found', 404)
    }

    return res.json({
      success: true,
      data: category
    })
  } catch (error) {
    return next(error)
  }
})

// Create new category
router.post('/', [
  requireTenant,
  body('name').trim().isLength({ min: 2 }).withMessage('Category name is required'),
  body('description').optional().trim(),
  body('color').optional().trim(),
  body('icon').optional().trim(),
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

    const category = await prisma.brandCategory.create({
      data: {
        name: req.body.name,
        description: req.body.description || null,
        color: req.body.color || null,
        icon: req.body.icon || null,
        isActive: req.body.isActive !== undefined ? req.body.isActive : true,
        brandId: req.tenant!.id
      }
    })

    return res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category
    })
  } catch (error) {
    return next(error)
  }
})

// Update category
router.put('/:id', [
  requireTenant,
  body('name').optional().trim().isLength({ min: 2 }),
  body('description').optional().trim(),
  body('color').optional().trim(),
  body('icon').optional().trim(),
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

    // Check if category exists and belongs to current brand
    const existingCategory = await prisma.brandCategory.findFirst({
      where: {
        id: req.params.id,
        brandId: req.tenant!.id
      }
    })

    if (!existingCategory) {
      throw new CustomError('Category not found', 404)
    }

    const updateData: any = {}
    if (req.body.name) updateData.name = req.body.name
    if (req.body.description !== undefined) updateData.description = req.body.description
    if (req.body.color !== undefined) updateData.color = req.body.color
    if (req.body.icon !== undefined) updateData.icon = req.body.icon
    if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive

    const category = await prisma.brandCategory.update({
      where: { id: req.params.id },
      data: updateData
    })

    return res.json({
      success: true,
      message: 'Category updated successfully',
      data: category
    })
  } catch (error) {
    return next(error)
  }
})

// Delete category
router.delete('/:id', requireTenant, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Check if category exists and belongs to current brand
    const existingCategory = await prisma.brandCategory.findFirst({
      where: {
        id: req.params.id,
        brandId: req.tenant!.id
      }
    })

    if (!existingCategory) {
      throw new CustomError('Category not found', 404)
    }

    // Check if category has services
    const servicesCount = await prisma.service.count({
      where: {
        categoryId: req.params.id
      }
    })

    if (servicesCount > 0) {
      throw new CustomError('Cannot delete category with existing services', 400)
    }

    await prisma.brandCategory.delete({
      where: { id: req.params.id }
    })

    return res.json({
      success: true,
      message: 'Category deleted successfully'
    })
  } catch (error) {
    return next(error)
  }
})

export default router
