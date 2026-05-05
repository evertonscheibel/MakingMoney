import { Router } from 'express';
import { validate, authenticate, requireCompany } from '../middleware';
import { getSchedule, getScheduleValidation } from '../controllers/schedule.controller';

const router = Router();

// Schedule is read-only for all company users
router.get('/', authenticate, requireCompany, validate(getScheduleValidation), getSchedule);

export default router;

