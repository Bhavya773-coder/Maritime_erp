import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { CertsService } from './certs.service';

export const getCerts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const certs = await CertsService.getCertificates(req.query as any);
    return res.status(200).json({
      status: 'success',
      data: { certs },
    });
  } catch (error) {
    next(error);
  }
};

export const getExpiringCerts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { days } = req.query as any;
    const certs = await CertsService.getExpiringCertificates(Number(days));
    return res.status(200).json({
      status: 'success',
      data: { certs },
    });
  } catch (error) {
    next(error);
  }
};

export const getCertById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const cert = await CertsService.getCertificateById(id);
    return res.status(200).json({
      status: 'success',
      data: { cert },
    });
  } catch (error) {
    next(error);
  }
};

export const createCert = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const cert = await CertsService.createCertificate(
      req.body,
      req.user!.id,
      req.user!.name
    );
    return res.status(201).json({
      status: 'success',
      data: { cert },
    });
  } catch (error) {
    next(error);
  }
};

export const updateCert = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const cert = await CertsService.updateCertificate(
      id,
      req.body,
      req.user!.id,
      req.user!.name
    );
    return res.status(200).json({
      status: 'success',
      data: { cert },
    });
  } catch (error) {
    next(error);
  }
};

export const uploadDoc = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { documentUrl } = req.body;
    const cert = await CertsService.uploadDocument(
      id,
      documentUrl,
      req.user!.id,
      req.user!.name
    );
    return res.status(200).json({
      status: 'success',
      data: { cert },
    });
  } catch (error) {
    next(error);
  }
};

export const recalculateStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await CertsService.recalculateStatuses(
      req.user!.id,
      req.user!.name
    );
    return res.status(200).json({
      status: 'success',
      message: 'Certificate statuses recalculated successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const checkAlerts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await CertsService.checkAlerts(
      req.user!.id,
      req.user!.name
    );
    return res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
