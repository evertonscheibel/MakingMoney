import { Router } from 'express';
import multer from 'multer';
import { importProcesses } from '../controllers/import.controller';
import { authenticate } from '../middleware/auth';
import { requireCompany } from '../middleware/tenant';

const router = Router();

// Configure multer for in-memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (_req, file, cb) => {
        if (
            file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.mimetype === 'application/vnd.ms-excel'
        ) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files (.xlsx, .xls) are allowed.'));
        }
    },
});

// POST /api/import/processes
router.post('/processes', authenticate, requireCompany, upload.single('file'), importProcesses);

export default router;

