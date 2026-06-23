import { BotReminderService } from '../bot/bot.reminder-service';
import { BotPersonalReminderService } from '../bot/bot.personal-reminder-service';
import { CertReminderService } from '../compliance/cert-reminder-service';
import { env } from '../../config/env';
import prisma from '../../config/db';

/**
 * Cron-based job scheduler replacing the setInterval approach.
 * Uses setTimeout for the first run and then setInterval internally,
 * but with structured intervals for different job types.
 */
export class JobScheduler {
  private static taskReminderInterval: NodeJS.Timeout | null = null;
  private static personalReminderInterval: NodeJS.Timeout | null = null;
  private static certReminderInterval: NodeJS.Timeout | null = null;
  private static idempotencyCleanupInterval: NodeJS.Timeout | null = null;

  public static initialize(): void {
    this.start();
  }

  public static start(): void {
    if (env.ENABLE_CRON_JOBS !== 'true') {
      console.log('[JobScheduler] Cron jobs disabled.');
      return;
    }

    console.log('[JobScheduler] Starting background job scheduler...');

    // Task reminders: every 5 minutes (existing behavior, but with escalation logic)
    this.taskReminderInterval = setInterval(async () => {
      try {
        const stats = await BotReminderService.processDueReminders();
        console.log('[JobScheduler] Task reminders:', stats);
      } catch (err) {
        console.error('[JobScheduler] Task reminder error:', err);
      }
    }, 5 * 60 * 1000);

    // Personal reminders: every 1 minute
    this.personalReminderInterval = setInterval(async () => {
      try {
        const stats = await BotPersonalReminderService.processDuePersonalReminders();
        console.log('[JobScheduler] Personal reminders:', stats);
      } catch (err) {
        console.error('[JobScheduler] Personal reminder error:', err);
      }
    }, 1 * 60 * 1000);

    // Certificate reminders: daily at 08:00 (or as configured)
    this.certReminderInterval = setInterval(async () => {
      try {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        // Simple daily trigger at 08:00
        if (hour === 8 && minute === 0) {
          const stats = await CertReminderService.processDueCertReminders();
          console.log('[JobScheduler] Certificate reminders:', stats);
        }
      } catch (err) {
        console.error('[JobScheduler] Certificate reminder error:', err);
      }
    }, 60 * 1000); // Check every minute if it's time

    // Idempotency cleanup: daily at 02:00
    this.idempotencyCleanupInterval = setInterval(async () => {
      try {
        const now = new Date();
        if (now.getHours() === 2 && now.getMinutes() === 0) {
          const result = await prisma.idempotencyKey.deleteMany({
            where: { expiresAt: { lt: now } },
          });
          console.log(`[JobScheduler] Cleaned up ${result.count} expired idempotency keys.`);
        }
      } catch (err) {
        console.error('[JobScheduler] Idempotency cleanup error:', err);
      }
    }, 60 * 1000);

    // Immediate first runs (with delays)
    setTimeout(async () => {
      try {
        const stats = await BotReminderService.processDueReminders();
        console.log('[JobScheduler] Initial task reminders:', stats);
      } catch (err) {
        console.error('[JobScheduler] Initial task reminder error:', err);
      }
    }, 5000);

    setTimeout(async () => {
      try {
        const stats = await BotPersonalReminderService.processDuePersonalReminders();
        console.log('[JobScheduler] Initial personal reminders:', stats);
      } catch (err) {
        console.error('[JobScheduler] Initial personal reminder error:', err);
      }
    }, 7000);
  }

  public static stop(): void {
    if (this.taskReminderInterval) clearInterval(this.taskReminderInterval);
    if (this.personalReminderInterval) clearInterval(this.personalReminderInterval);
    if (this.certReminderInterval) clearInterval(this.certReminderInterval);
    if (this.idempotencyCleanupInterval) clearInterval(this.idempotencyCleanupInterval);
    console.log('[JobScheduler] All background jobs stopped.');
  }
}
