import { Router } from 'express';
import { validate } from '../middleware/errors';
import { authenticate, authorize } from '../middleware/auth';
import { requireCompany } from '../middleware/tenant';
import {
    listProcesses,
    listProcessesValidation,
    getProcess,
    createProcess,
    createProcessValidation,
    updateProcess,
    updateProcessValidation,
    deliverProcess,
    deliverProcessValidation,
    sendProcessEmail,
    deleteProcess,
    confirmDelivery,
    confirmDeliveryValidation,
    sendDeliveryEmail,
    revertDelivery,
    revertDeliveryValidation,
} from '../controllers/process.controller';

const router = Router();

router.use(authenticate, requireCompany);

// List processes with filters
router.get('/', validate(listProcessesValidation), listProcesses);

// Get single process
router.get('/:id', getProcess);

// Create process
router.post('/', validate(createProcessValidation), createProcess);

// Update process
router.put('/:id', validate(updateProcessValidation), updateProcess);

// Mark as delivered (legacy - still works)
router.put('/:id/deliver', validate(deliverProcessValidation), deliverProcess);

// NEW: Confirm delivery (no email)
router.post('/:id/confirm-delivery', validate(confirmDeliveryValidation), confirmDelivery);

// NEW: Send delivery email (after confirmation)
router.post('/:id/send-delivery-email', sendDeliveryEmail);

// NEW: Revert delivery
router.post('/:id/revert-delivery', validate(revertDeliveryValidation), revertDelivery);

// Send process details via email
router.post('/:id/send-email', sendProcessEmail);

// Delete process
router.delete('/:id', deleteProcess);

export default router;

