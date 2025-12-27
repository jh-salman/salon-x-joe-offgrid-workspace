import { Redis } from 'ioredis'

// Redis connection for BullMQ
export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3,
  lazyConnect: true, // Connect only when needed
})

// Test connection
redis.on('connect', () => {
  console.log('✅ Redis connected for BullMQ')
})

redis.on('error', (err) => {
  console.error('❌ Redis connection error:', err)
})

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🔄 Closing Redis connection...')
  await redis.quit()
  process.exit(0)
})