"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../../middleware/auth");
const validator_1 = require("../../middleware/validator");
const tasks_controller_1 = require("./tasks.controller");
const tasks_schema_1 = require("./tasks.schema");
const router = (0, express_1.Router)();
// Middleware to validate UUID task ID params
const validateTaskId = (req, res, next) => {
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
router.use(auth_1.requireAuth);
// OWNER-only routes (must place before /:id to avoid parsing conflict)
router.get('/all', (0, auth_1.requireRole)([client_1.Role.OWNER]), tasks_controller_1.getAllTasks);
router.patch('/mark-overdue', (0, auth_1.requireRole)([client_1.Role.OWNER]), tasks_controller_1.markOverdue);
// Standard task operations
router.get('/', (0, validator_1.validate)(tasks_schema_1.getTasksQuerySchema), tasks_controller_1.getTasks);
router.post('/', (0, validator_1.validate)(tasks_schema_1.createTaskSchema), tasks_controller_1.createTask);
router.get('/:id', validateTaskId, tasks_controller_1.getTaskDetails);
router.patch('/:id/status', validateTaskId, (0, validator_1.validate)(tasks_schema_1.updateStatusSchema), tasks_controller_1.updateTaskStatus);
router.post('/:id/delegate', validateTaskId, (0, validator_1.validate)(tasks_schema_1.delegateTaskSchema), tasks_controller_1.delegateTask);
router.post('/:id/comment', validateTaskId, (0, validator_1.validate)(tasks_schema_1.addCommentSchema), tasks_controller_1.addTaskComment);
router.get('/:id/chain', validateTaskId, tasks_controller_1.getDelegationChain);
router.delete('/:id', validateTaskId, tasks_controller_1.deleteTask);
exports.default = router;
