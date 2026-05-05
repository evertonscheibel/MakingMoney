import { Router } from 'express';
import authRoutes from './auth.routes';
import companyRoutes from './company.routes';
import cycleRoutes from './cycle.routes';
import processRoutes from './process.routes';
import reportRoutes from './report.routes';
import emailRoutes from './email.routes';
import evaluationRoutes from './evaluation.routes';
import aiRoutes from './ai.routes';
import userRoutes from './user.routes';
import emailConfigRoutes from './emailConfig.routes';
import emailLogRoutes from './emailLog.routes';
import logRoutes from './log.routes';
import metricsRoutes from './metrics.routes';
import bonusRoutes from './bonus.routes';
import importRoutes from './import.routes';

const router = Router();

// Health check
router.get('/health', (req, res) => {
    res.json({
        success: true,
        data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '1.3.0',
        },
    });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/companies', companyRoutes);
router.use('/cycles', cycleRoutes);
router.use('/processes', processRoutes);
router.use('/reports', reportRoutes);
router.use('/email-events', emailRoutes);
router.use('/evaluation', evaluationRoutes);
router.use('/ai', aiRoutes);
router.use('/users', userRoutes);
router.use('/settings/email', emailConfigRoutes);
router.use('/email-logs', emailLogRoutes);
router.use('/logs', logRoutes);
router.use('/metrics', metricsRoutes);
router.use('/bonus', bonusRoutes);
router.use('/import', importRoutes);

export default router;

