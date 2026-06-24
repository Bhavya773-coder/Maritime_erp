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

export function getVesselNameCandidates(name: string): string[] {
  if (!name) return [];
  const candidates: string[] = [name];
  const cleaned = name.trim().replace(/\s+/g, ' ');
  
  // Replace hyphens with spaces
  const spaceInsteadOfHyphen = cleaned.replace(/-/g, ' ').replace(/\s+/g, ' ');
  if (spaceInsteadOfHyphen !== cleaned) {
    candidates.push(spaceInsteadOfHyphen);
  }
  
  // Replace spaces with hyphens
  const hyphenInsteadOfSpace = cleaned.replace(/\s+/g, '-');
  if (hyphenInsteadOfSpace !== cleaned) {
    candidates.push(hyphenInsteadOfSpace);
  }
  
  // Strip all spaces and hyphens (e.g. "kb26")
  const stripped = cleaned.replace(/[\s-]/g, '');
  if (stripped !== cleaned && !candidates.includes(stripped)) {
    candidates.push(stripped);
  }
  
  // Also try to insert a space before numbers if it's like "kb26" -> "kb 26"
  const spaceBeforeNum = cleaned.replace(/([a-zA-Z]+)(\d+)/g, '$1 $2');
  if (spaceBeforeNum !== cleaned && !candidates.includes(spaceBeforeNum)) {
    candidates.push(spaceBeforeNum);
  }

  return Array.from(new Set(candidates));
}

