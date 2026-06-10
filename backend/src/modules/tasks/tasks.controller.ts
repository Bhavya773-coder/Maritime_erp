import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { TasksService } from './tasks.service';
import { TaskType, Priority, TaskStatus } from '@prisma/client';

export const getTasks = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tasks = await TasksService.getTasks(req.query, req.user!);
    return res.status(200).json({
      status: 'success',
      data: { tasks },
    });
  } catch (error) {
    next(error);
  }
};

export const getAllTasks = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tasks = await TasksService.getAllTasksForOwner();
    return res.status(200).json({
      status: 'success',
      data: { tasks },
    });
  } catch (error) {
    next(error);
  }
};

export const createTask = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const task = await TasksService.createTask(req.body, req.user!);
    return res.status(201).json({
      status: 'success',
      data: { task },
    });
  } catch (error) {
    next(error);
  }
};

export const getTaskDetails = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const task = await TasksService.getTaskDetails(id, req.user!);
    return res.status(200).json({
      status: 'success',
      data: { task },
    });
  } catch (error) {
    next(error);
  }
};

export const updateTaskStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const task = await TasksService.updateTaskStatus(id, status, req.user!);
    return res.status(200).json({
      status: 'success',
      data: { task },
    });
  } catch (error) {
    next(error);
  }
};

export const delegateTask = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { assignedToId, note } = req.body;
    const chain = await TasksService.delegateTask(id, assignedToId, note, req.user!);
    return res.status(200).json({
      status: 'success',
      data: { chain },
    });
  } catch (error) {
    next(error);
  }
};

export const addTaskComment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const comment = await TasksService.addTaskComment(id, content, req.user!);
    return res.status(201).json({
      status: 'success',
      data: { comment },
    });
  } catch (error) {
    next(error);
  }
};

export const getDelegationChain = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const chain = await TasksService.getDelegationChain(id, req.user!);
    return res.status(200).json({
      status: 'success',
      data: { chain },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteTask = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await TasksService.deleteTask(id, req.user!);
    return res.status(200).json({
      status: 'success',
      message: 'Task deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const markOverdue = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const count = await TasksService.markTasksOverdue(req.user!);
    return res.status(200).json({
      status: 'success',
      message: `Successfully marked ${count} tasks as OVERDUE.`,
      data: { count },
    });
  } catch (error) {
    next(error);
  }
};
