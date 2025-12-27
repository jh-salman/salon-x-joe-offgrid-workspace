import { Queue } from 'bullmq'
import { redis } from '../config/redis'

export class JobService {
  private static emailQueue = new Queue('email-queue', {
    connection: redis,
    defaultJobOptions: {
      removeOnComplete: 100, // Keep last 100 completed jobs
      removeOnFail: 50,      // Keep last 50 failed jobs
      attempts: 3,           // Retry 3 times
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  })

  // Add welcome email job
  static async addWelcomeEmailJob(email: string, firstName: string) {
    try {
      await this.emailQueue.add('welcome-email', {
        type: 'WELCOME_EMAIL',
        data: { email, firstName }
      }, {
        delay: 1000, // Send after 1 second
        priority: 1, // High priority
      })
      console.log(`📧 Welcome email job queued for ${email}`)
      return { success: true, message: 'Welcome email job queued' }
    } catch (error) {
      console.error('❌ Error queuing welcome email job:', error)
      throw error
    }
  }

  // Add invitation email job
  static async addInvitationEmailJob(
    email: string, 
    inviterName: string, 
    brandName: string, 
    role: string, 
    invitationLink: string
  ) {
    try {
      await this.emailQueue.add('invitation-email', {
        type: 'INVITATION_EMAIL',
        data: { email, inviterName, brandName, role, invitationLink }
      }, {
        delay: 500, // Send after 0.5 seconds
        priority: 2, // Medium priority
      })
      console.log(`📧 Invitation email job queued for ${email}`)
      return { success: true, message: 'Invitation email job queued' }
    } catch (error) {
      console.error('❌ Error queuing invitation email job:', error)
      throw error
    }
  }

  // Add password reset email job
  static async addPasswordResetEmailJob(email: string, firstName: string, resetLink: string) {
    try {
      await this.emailQueue.add('password-reset-email', {
        type: 'PASSWORD_RESET_EMAIL',
        data: { email, firstName, resetLink }
      }, {
        delay: 200, // Send after 0.2 seconds
        priority: 1, // High priority
      })
      console.log(`📧 Password reset email job queued for ${email}`)
      return { success: true, message: 'Password reset email job queued' }
    } catch (error) {
      console.error('❌ Error queuing password reset email job:', error)
      throw error
    }
  }

  // Get queue stats
  static async getQueueStats() {
    try {
      const waiting = await this.emailQueue.getWaiting()
      const active = await this.emailQueue.getActive()
      const completed = await this.emailQueue.getCompleted()
      const failed = await this.emailQueue.getFailed()
      
      return {
        success: true,
        data: {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          total: waiting.length + active.length + completed.length + failed.length
        }
      }
    } catch (error) {
      console.error('❌ Error getting queue stats:', error)
      return {
        success: false,
        error: 'Failed to get queue stats'
      }
    }
  }

  // Get job details
  static async getJobDetails(jobId: string) {
    try {
      const job = await this.emailQueue.getJob(jobId)
      if (!job) {
        return {
          success: false,
          error: 'Job not found'
        }
      }

      return {
        success: true,
        data: {
          id: job.id,
          name: job.name,
          data: job.data,
          progress: job.progress,
          state: await job.getState(),
          createdAt: job.timestamp,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
          failedReason: job.failedReason
        }
      }
    } catch (error) {
      console.error('❌ Error getting job details:', error)
      return {
        success: false,
        error: 'Failed to get job details'
      }
    }
  }

  // Retry failed job
  static async retryFailedJob(jobId: string) {
    try {
      const job = await this.emailQueue.getJob(jobId)
      if (!job) {
        return {
          success: false,
          error: 'Job not found'
        }
      }

      await job.retry()
      console.log(`🔄 Retrying job ${jobId}`)
      
      return {
        success: true,
        message: 'Job retry initiated'
      }
    } catch (error) {
      console.error('❌ Error retrying job:', error)
      return {
        success: false,
        error: 'Failed to retry job'
      }
    }
  }

  // Clean old jobs
  static async cleanOldJobs() {
    try {
      await this.emailQueue.clean(24 * 60 * 60 * 1000, 100, 'completed') // Clean completed jobs older than 24 hours
      await this.emailQueue.clean(7 * 24 * 60 * 60 * 1000, 50, 'failed') // Clean failed jobs older than 7 days
      
      console.log('🧹 Old jobs cleaned successfully')
      return {
        success: true,
        message: 'Old jobs cleaned successfully'
      }
    } catch (error) {
      console.error('❌ Error cleaning old jobs:', error)
      return {
        success: false,
        error: 'Failed to clean old jobs'
      }
    }
  }
}
