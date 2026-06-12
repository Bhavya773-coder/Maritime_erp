import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { VouchersService } from './vouchers.service';

export const getVouchers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const vouchers = await VouchersService.getVouchers(req.query as any);
    return res.status(200).json({
      status: 'success',
      data: { vouchers }
    });
  } catch (error) {
    next(error);
  }
};

export const getMyVouchers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const vouchers = await VouchersService.getMyVouchers(req.user!.id, req.query as any);
    return res.status(200).json({
      status: 'success',
      data: { vouchers }
    });
  } catch (error) {
    next(error);
  }
};

export const getVoucherById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const voucher = await VouchersService.getVoucherById(id, req.user!);
    return res.status(200).json({
      status: 'success',
      data: { voucher }
    });
  } catch (error) {
    next(error);
  }
};

export const createVoucher = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const voucher = await VouchersService.createVoucher(
      req.body,
      req.user!.id,
      req.user!.name
    );
    return res.status(201).json({
      status: 'success',
      data: { voucher }
    });
  } catch (error) {
    next(error);
  }
};

export const addReceipts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { receiptUrls } = req.body;
    const voucher = await VouchersService.addReceipts(id, receiptUrls, req.user!);
    return res.status(200).json({
      status: 'success',
      data: { voucher }
    });
  } catch (error) {
    next(error);
  }
};

export const approveVoucher = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { approverNote } = req.body;
    const voucher = await VouchersService.approveVoucher(
      id,
      approverNote,
      req.user!.id,
      req.user!.name
    );
    return res.status(200).json({
      status: 'success',
      data: { voucher }
    });
  } catch (error) {
    next(error);
  }
};

export const rejectVoucher = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const voucher = await VouchersService.rejectVoucher(
      id,
      reason,
      req.user!.id,
      req.user!.name
    );
    return res.status(200).json({
      status: 'success',
      data: { voucher }
    });
  } catch (error) {
    next(error);
  }
};

export const requestInfo = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const voucher = await VouchersService.requestInfo(
      id,
      note,
      req.user!.id,
      req.user!.name
    );
    return res.status(200).json({
      status: 'success',
      data: { voucher }
    });
  } catch (error) {
    next(error);
  }
};

export const exportData = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await VouchersService.exportVouchers(req.query as any, req.user!.id);
    return res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getSummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const summary = await VouchersService.getDashboardSummary();
    return res.status(200).json({
      status: 'success',
      data: { summary }
    });
  } catch (error) {
    next(error);
  }
};
