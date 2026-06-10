import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { VesselsService } from './vessels.service';

export const getVessels = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const vessels = await VesselsService.getVessels(req.query as any);
    return res.status(200).json({
      status: 'success',
      data: { vessels },
    });
  } catch (error) {
    next(error);
  }
};

export const getVesselDetails = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const vessel = await VesselsService.getVesselById(id);
    return res.status(200).json({
      status: 'success',
      data: { vessel },
    });
  } catch (error) {
    next(error);
  }
};

export const createVessel = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const vessel = await VesselsService.createVessel(req.body, req.user!.id);
    return res.status(201).json({
      status: 'success',
      data: { vessel },
    });
  } catch (error) {
    next(error);
  }
};

export const updateVesselLocation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await VesselsService.updateVesselLocation(id, req.body, req.user!);
    return res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getLocationHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { page, limit } = req.query;
    const result = await VesselsService.getLocationHistory(id, page as any, limit as any);
    return res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getExportSnapshot = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const snapshot = await VesselsService.getExportSnapshot();
    return res.status(200).json({
      status: 'success',
      data: snapshot,
    });
  } catch (error) {
    next(error);
  }
};
