import express from 'express'
import { JobService } from '../services/jobService'
import { authenticate } from '../middleware/authenticate'
import { requireAdminOrAbove } from '../middleware/rbac'

const router = express.Router()

// Get job queue stats (Admin only)
router.get('/stats', authenticate, requireAdminOrAbove, async (req, res) => {
  try {
    const stats = await JobService.getQueueStats()
    res.json(stats)
  } catch (error) {
    console.error('Error getting job stats:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get job stats' 
    })
  }
})

// Get specific job details (Admin only)
router.get('/:jobId', authenticate, requireAdminOrAbove, async (req, res) => {
  try {
    const { jobId } = req.params
    if (!jobId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Job ID is required' 
      })
    }
    const jobDetails = await JobService.getJobDetails(jobId)
    res.json(jobDetails)
  } catch (error) {
    console.error('Error getting job details:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get job details' 
    })
  }
})

// Retry failed job (Admin only)
router.post('/:jobId/retry', authenticate, requireAdminOrAbove, async (req, res) => {
  try {
    const { jobId } = req.params
    if (!jobId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Job ID is required' 
      })
    }
    const result = await JobService.retryFailedJob(jobId)
    res.json(result)
  } catch (error) {
    console.error('Error retrying job:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to retry job' 
    })
  }
})

// Clean old jobs (Admin only)
router.post('/cleanup', authenticate, requireAdminOrAbove, async (req, res) => {
  try {
    const result = await JobService.cleanOldJobs()
    res.json(result)
  } catch (error) {
    console.error('Error cleaning old jobs:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clean old jobs' 
    })
  }
})

export default router
