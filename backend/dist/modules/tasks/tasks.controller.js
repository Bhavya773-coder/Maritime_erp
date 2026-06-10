"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markOverdue = exports.deleteTask = exports.getDelegationChain = exports.addTaskComment = exports.delegateTask = exports.updateTaskStatus = exports.getTaskDetails = exports.createTask = exports.getAllTasks = exports.getTasks = void 0;
const tasks_service_1 = require("./tasks.service");
const getTasks = async (req, res, next) => {
    try {
        const tasks = await tasks_service_1.TasksService.getTasks(req.query, req.user);
        return res.status(200).json({
            status: 'success',
            data: { tasks },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getTasks = getTasks;
const getAllTasks = async (req, res, next) => {
    try {
        const tasks = await tasks_service_1.TasksService.getAllTasksForOwner();
        return res.status(200).json({
            status: 'success',
            data: { tasks },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAllTasks = getAllTasks;
const createTask = async (req, res, next) => {
    try {
        const task = await tasks_service_1.TasksService.createTask(req.body, req.user);
        return res.status(201).json({
            status: 'success',
            data: { task },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createTask = createTask;
const getTaskDetails = async (req, res, next) => {
    try {
        const { id } = req.params;
        const task = await tasks_service_1.TasksService.getTaskDetails(id, req.user);
        return res.status(200).json({
            status: 'success',
            data: { task },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getTaskDetails = getTaskDetails;
const updateTaskStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const task = await tasks_service_1.TasksService.updateTaskStatus(id, status, req.user);
        return res.status(200).json({
            status: 'success',
            data: { task },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateTaskStatus = updateTaskStatus;
const delegateTask = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { assignedToId, note } = req.body;
        const chain = await tasks_service_1.TasksService.delegateTask(id, assignedToId, note, req.user);
        return res.status(200).json({
            status: 'success',
            data: { chain },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.delegateTask = delegateTask;
const addTaskComment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const comment = await tasks_service_1.TasksService.addTaskComment(id, content, req.user);
        return res.status(201).json({
            status: 'success',
            data: { comment },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.addTaskComment = addTaskComment;
const getDelegationChain = async (req, res, next) => {
    try {
        const { id } = req.params;
        const chain = await tasks_service_1.TasksService.getDelegationChain(id, req.user);
        return res.status(200).json({
            status: 'success',
            data: { chain },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getDelegationChain = getDelegationChain;
const deleteTask = async (req, res, next) => {
    try {
        const { id } = req.params;
        await tasks_service_1.TasksService.deleteTask(id, req.user);
        return res.status(200).json({
            status: 'success',
            message: 'Task deleted successfully',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteTask = deleteTask;
const markOverdue = async (req, res, next) => {
    try {
        const count = await tasks_service_1.TasksService.markTasksOverdue(req.user);
        return res.status(200).json({
            status: 'success',
            message: `Successfully marked ${count} tasks as OVERDUE.`,
            data: { count },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.markOverdue = markOverdue;
