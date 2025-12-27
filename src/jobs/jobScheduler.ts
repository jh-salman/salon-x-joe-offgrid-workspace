import cron from 'node-cron'
import { JobService } from '../services/jobService'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export class JobScheduler {
  // Start all scheduled jobs
  static start() {
    console.log('🕐 Starting job scheduler...')
    
    // Daily cleanup job at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('🧹 Running daily cleanup job...')
      try {
        // Clean old jobs
        await JobService.cleanOldJobs()
        
        // Clean expired OTP records
        await prisma.otpRecord.deleteMany({
          where: {
            expiresAt: {
              lt: new Date()
            }
          }
        })
        
        // Clean expired invitations
        await prisma.brandInvitation.updateMany({
          where: {
            expiresAt: {
              lt: new Date()
            },
            status: 'PENDING'
          },
          data: {
            status: 'EXPIRED'
          }
        })
        
        console.log('✅ Daily cleanup completed')
      } catch (error) {
        console.error('❌ Daily cleanup failed:', error)
      }
    }, {
      timezone: 'UTC'
    })
    
    // Weekly report job on Monday at 9 AM
    cron.schedule('0 9 * * 1', async () => {
      console.log('📊 Running weekly report job...')
      try {
        // Get weekly stats
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        
        const stats = await prisma.user.count({
          where: {
            createdAt: {
              gte: weekAgo
            }
          }
        })
        
        console.log(`📈 Weekly new users: ${stats}`)
        console.log('✅ Weekly report completed')
      } catch (error) {
        console.error('❌ Weekly report failed:', error)
      }
    }, {
      timezone: 'UTC'
    })
    
    // Hourly health check
    cron.schedule('0 * * * *', async () => {
      try {
        // Check queue health
        const queueStats = await JobService.getQueueStats()
        if (queueStats.success && queueStats.data) {
          const { data } = queueStats
          if (data.failed > 10) {
            console.warn(`⚠️ High number of failed jobs: ${data.failed}`)
          }
          if (data.waiting > 100) {
            console.warn(`⚠️ High number of waiting jobs: ${data.waiting}`)
          }
        }
        
        // Check database connection
        await prisma.$queryRaw`SELECT 1`
        console.log('💚 Hourly health check passed')
      } catch (error) {
        console.error('❌ Hourly health check failed:', error)
      }
    }, {
      timezone: 'UTC'
    })
    
    // Monthly analytics job on 1st of month at 3 AM
    cron.schedule('0 3 1 * *', async () => {
      console.log('📈 Running monthly analytics job...')
      try {
        const monthAgo = new Date()
        monthAgo.setMonth(monthAgo.getMonth() - 1)
        
        // Get monthly stats
        const [
          newUsers,
          newBrands,
          totalAppointments
        ] = await Promise.all([
          prisma.user.count({
            where: {
              createdAt: {
                gte: monthAgo
              }
            }
          }),
          prisma.brand.count({
            where: {
              createdAt: {
                gte: monthAgo
              }
            }
          }),
          prisma.appointment.count({
            where: {
              createdAt: {
                gte: monthAgo
              }
            }
          })
        ])
        
        console.log(`📊 Monthly Stats:`)
        console.log(`  - New Users: ${newUsers}`)
        console.log(`  - New Brands: ${newBrands}`)
        console.log(`  - Total Appointments: ${totalAppointments}`)
        console.log('✅ Monthly analytics completed')
      } catch (error) {
        console.error('❌ Monthly analytics failed:', error)
      }
    }, {
      timezone: 'UTC'
    })
    
    console.log('✅ Job scheduler started with the following schedules:')
    console.log('  - Daily cleanup: 2:00 AM UTC')
    console.log('  - Weekly report: Monday 9:00 AM UTC')
    console.log('  - Hourly health check: Every hour')
    console.log('  - Monthly analytics: 1st of month 3:00 AM UTC')
  }

  // Stop all scheduled jobs
  static stop() {
    console.log('🛑 Stopping job scheduler...')
    cron.getTasks().forEach(task => {
      task.stop()
    })
    console.log('✅ Job scheduler stopped')
  }
}
