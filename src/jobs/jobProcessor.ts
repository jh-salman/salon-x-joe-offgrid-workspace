import { Worker } from 'bullmq'
import { EmailService } from '../services/emailService'
import { redis } from '../config/redis'

// Email job processor
export const emailWorker = new Worker('email-queue', async (job) => {
  const { type, data } = job.data
  
  console.log(`🔄 Processing email job: ${type} for ${data.email}`)
  
  try {
    switch (type) {
      case 'WELCOME_EMAIL':
        await EmailService.sendWelcomeEmail(data.email, data.firstName)
        console.log(`✅ Welcome email sent to ${data.email}`)
        break
        
      case 'INVITATION_EMAIL':
        await EmailService.sendInvitationEmail(
          data.email, 
          data.inviterName, 
          data.brandName, 
          data.role, 
          data.invitationLink
        )
        console.log(`✅ Invitation email sent to ${data.email}`)
        break
        
      case 'PASSWORD_RESET_EMAIL':
        await EmailService.sendPasswordResetEmail(
          data.email,
          data.firstName,
          data.resetLink
        )
        console.log(`✅ Password reset email sent to ${data.email}`)
        break
        
      default:
        throw new Error(`Unknown email type: ${type}`)
    }
    
    return { success: true, type, email: data.email }
  } catch (error) {
    console.error(`❌ Email job failed for ${data.email}:`, error)
    throw error // This will retry the job
  }
}, {
  connection: redis,
  concurrency: 5, // Process 5 emails at once
})

// Job completion/failure handlers
emailWorker.on('completed', (job) => {
  console.log(`✅ Email job ${job.id} completed successfully`)
})

emailWorker.on('failed', (job, err) => {
  console.error(`❌ Email job ${job?.id} failed:`, err.message)
})

emailWorker.on('error', (err) => {
  console.error('❌ Email worker error:', err)
})

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🔄 Shutting down email worker...')
  await emailWorker.close()
  process.exit(0)
})

console.log('📧 Email worker started and ready to process jobs')
