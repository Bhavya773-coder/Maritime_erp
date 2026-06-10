import { Router, Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validator';
import {
  getTasks,
  getAllTasks,
  createTask,
  getTaskDetails,
  updateTaskStatus,
  delegateTask,
  addTaskComment,
  getDelegationChain,
  deleteTask,
  markOverdue,
} from './tasks.controller';
import {
  createTaskSchema,
  updateStatusSchema,
  delegateTaskSchema,
  addCommentSchema,
  getTasksQuerySchema,
} from './tasks.schema';

const router = Router();

// Middleware to validate UUID task ID params
const validateTaskId = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (id && !uuidRegex.test(id)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid task id',
    });
  }
  next();
};

// Require authentication for all task routes
router.use(requireAuth);

// OWNER-only routes (must place before /:id to avoid parsing conflict)
router.get('/all', requireRole([Role.OWNER]), getAllTasks);
router.patch('/mark-overdue', requireRole([Role.OWNER]), markOverdue);

// Standard task operations
router.get('/', validate(getTasksQuerySchema), getTasks);
router.post('/', validate(createTaskSchema), createTask);

router.get('/:id', validateTaskId, getTaskDetails);
router.patch('/:id/status', validateTaskId, validate(updateStatusSchema), updateTaskStatus);
router.post('/:id/delegate', validateTaskId, validate(delegateTaskSchema), delegateTask);
router.post('/:id/comment', validateTaskId, validate(addCommentSchema), addTaskComment);
router.get('/:id/chain', validateTaskId, getDelegationChain);
router.delete('/:id', validateTaskId, deleteTask);

export default router;
