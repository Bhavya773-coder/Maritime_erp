import prisma from '../../config/db';
import { CertsService } from '../certifications/certs.service';
import { Role } from '@prisma/client';

export class CertReminderService {
  /**
   * Process due certificate compliance reminders.
   * Runs alert checks and status recalculation daily.
   */
  public static async processDueCertReminders(): Promise<{ checked: number; alertsCreated: number; recalculated: any }> {
    console.log('[CertReminderService] Starting daily cert reminders check...');
    
    // Find an owner user to assign the audit logs to
    let systemUser = await prisma.user.findFirst({
      where: { role: Role.OWNER, isActive: true },
    });

    if (!systemUser) {
      systemUser = await prisma.user.findFirst({
        where: { isActive: true },
      });
    }

    const userId = systemUser?.id || '000000000000000000000000';
    const userName = systemUser?.name || 'System Scheduler';

    const alertsResult = await CertsService.checkAlerts(userId, userName);
    const recalcResult = await CertsService.recalculateStatuses(userId, userName);

    console.log('[CertReminderService] Alert checks finished:', alertsResult);
    console.log('[CertReminderService] Status recalculation finished:', recalcResult);

    return {
      checked: alertsResult.checked,
      alertsCreated: alertsResult.alertsCreated,
      recalculated: recalcResult,
    };
  }
}
