import { Router } from 'express';
import { validate, authenticate, requireCompany } from '../middleware';
import { chat, chatValidation } from '../controllers';

const router = Router();

router.use(authenticate, requireCompany);

// Chat with AI assistant
router.post('/chat', validate(chatValidation), chat);

export default router;

