import { Router } from 'express';
import { validate, authenticate, authorize, requireCompany } from '../middleware';
import {
    listAuditLogs,
    listAuditLogsValidation,
    listEmailLogs,
    listEmailLogsValidation,
    getProcessLogs,
    getProcessLogsValidation,
    listDateChanges,
    listDateChangesValidation,
} from '../controllers/log.controller';
import { UserRole } from '../types';

const router = Router();

// All log routes require Admin role
router.use(authenticate, requireCompany, authorize(UserRole.MASTER, UserRole.MASTER));

// List audit logs
router.get('/audit', validate(listAuditLogsValidation), listAuditLogs);

// List email logs
router.get('/email', validate(listEmailLogsValidation), listEmailLogs);

// Process planned/limit date changes by month
router.get('/date-changes', validate(listDateChangesValidation), listDateChanges);

// Get combined logs for a specific process
router.get('/process/:id', validate(getProcessLogsValidation), getProcessLogs);

export default router;

