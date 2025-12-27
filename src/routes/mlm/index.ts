import { Router } from 'express'
import referralsRouter from './referrals'
import commissionsRouter from './commissions'
import tokensRouter from './tokens'

const router = Router()

// Mount MLM sub-routes
router.use('/referrals', referralsRouter)
router.use('/commissions', commissionsRouter)
router.use('/tokens', tokensRouter)

export default router