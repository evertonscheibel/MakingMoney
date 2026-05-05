import { Router } from 'express';
import { authenticate, requireCompany, authorize } from '../middleware';
import { listUsers, updateUser, deleteUser, updateUserValidation } from '../controllers/user.controller';
import { validate } from '../middleware';
import { UserRole } from '../types';

const router = Router();

// List users for assignment - requires authentication and company access
router.get('/', authenticate, requireCompany, listUsers);

// Only MASTER can update or delete users
router.use(authenticate, requireCompany, authorize(UserRole.MASTER));
router.put('/:id', validate(updateUserValidation), updateUser);
router.delete('/:id', deleteUser);

export default router;

