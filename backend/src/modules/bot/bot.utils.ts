export function calculateNextReminderAt(dueDate: Date | null | undefined): Date {
  const now = Date.now();
  const fallback = new Date(now + 24 * 60 * 60 * 1000);
  if (!dueDate) return fallback;
  const dueTime = new Date(dueDate).getTime();
  if (isNaN(dueTime)) return fallback;
  const reminderTime = dueTime - 24 * 60 * 60 * 1000;
  if (reminderTime > now) return new Date(reminderTime);
  if (dueTime > now) return new Date(dueTime);
  return fallback;
}
