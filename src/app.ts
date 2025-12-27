import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'

// Import routes
import authRoutes from './routes/auth'
import brandRoutes from './routes/brands'
import brandContextRoutes from './routes/brandContext'
import servicesRoutes from './routes/services'
import categoriesRoutes from './routes/categories'
import mlmRoutes from './routes/mlm'
import invitationRoutes from './routes/invitations'
import jobRoutes from './routes/jobs'

// Import job system
import { emailWorker } from './jobs/jobProcessor'
import { JobScheduler } from './jobs/jobScheduler'

// Load environment variables
dotenv.config()

const app = express()
const prisma = new PrismaClient()

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/brands', brandRoutes)
app.use('/api/brand-context', brandContextRoutes)
app.use('/api/services', servicesRoutes)
app.use('/api/categories', categoriesRoutes)
app.use('/api/mlm', mlmRoutes)
app.use('/api/invitations', invitationRoutes)
app.use('/api/jobs', jobRoutes)

// Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      database: 'connected'
    })
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      timestamp: new Date().toISOString(),
      database: 'disconnected'
    })
  }
})

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', error)
  
  const statusCode = error.statusCode || 500
  const message = error.message || 'Internal Server Error'
  
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  })
})

const PORT = process.env.PORT || 3001

// Start server
const startServer = async () => {
  try {
    await prisma.$connect()
    console.log('✅ Database connected successfully')
    
    // Start job scheduler
    JobScheduler.start()
    console.log('✅ Job scheduler started')
    
    app.listen(PORT, () => {
      console.log(`🚀 SalonX API Server running on port ${PORT}`)
      console.log(`📊 Health check: http://localhost:${PORT}/health`)
      console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth`)
      console.log(`🏢 Brand endpoints: http://localhost:${PORT}/api/brands`)
      console.log(`🔄 Brand context endpoints: http://localhost:${PORT}/api/brand-context`)
      console.log(`💰 MLM endpoints: http://localhost:${PORT}/api/mlm`)
      console.log(`📧 Invitation endpoints: http://localhost:${PORT}/api/invitations`)
      console.log(`⚙️ Job monitoring endpoints: http://localhost:${PORT}/api/jobs`)
      console.log(`📧 Email worker started and ready to process jobs`)
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

startServer()

export { app }