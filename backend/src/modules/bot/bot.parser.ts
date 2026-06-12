export interface ParsedCommand {
  intent: 'CREATE_TASK';
  assigneeName: string | null;
  taskTitle: string;
  taskDescription: string;
  assetReference: string | null;
  dueDate: Date | null;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

function getNextWeekday(dayName: string): Date {
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDay = weekdays.indexOf(dayName.toLowerCase());
  if (targetDay === -1) return new Date();
  
  const resultDate = new Date();
  const currentDay = resultDate.getDay();
  let daysToAdd = targetDay - currentDay;
  if (daysToAdd <= 0) {
    daysToAdd += 7; // Next week's occurrence
  }
  resultDate.setDate(resultDate.getDate() + daysToAdd);
  // Reset time to start of day or keep it clean
  resultDate.setHours(12, 0, 0, 0);
  return resultDate;
}

export class BotParser {
  public static parse(message: string): ParsedCommand {
    const trimmedMessage = message.trim();
    
    // Regular expression to match: Tell/Ask/Remind <Assignee> to <Action>
    // e.g. "Tell Hardik K to check the progress of the KB-26 repairing"
    const commandRegex = /^(?:tell|ask|remind)\s+([^,]+?)\s+to\s+(.+)$/i;
    const match = trimmedMessage.match(commandRegex);
    
    let assigneeName: string | null = null;
    let actionText = trimmedMessage;
    
    if (match) {
      assigneeName = match[1].trim();
      actionText = match[2].trim();
    }
    
    // Clean assigneeName if it contains leading/trailing articles or noise
    if (assigneeName) {
      // Remove starting words like 'the' if any
      assigneeName = assigneeName.replace(/^the\s+/i, '');
    }

    // Capitalize action text for title
    let taskTitle = actionText.replace(/^check\s+the\s+progress\s+of\s+the\s+/i, 'Check progress of ');
    taskTitle = taskTitle.replace(/^check\s+progress\s+of\s+the\s+/i, 'Check progress of ');
    taskTitle = taskTitle.charAt(0).toUpperCase() + taskTitle.slice(1);

    // Extract assetReference
    // Look for KB-26, KB-24, Sagar Barge 1, Sagar Barge 2, Sagar Tug 1, etc.
    let assetReference: string | null = null;
    const assetMatch = trimmedMessage.match(/(KB-\d+|Sagar\s+Barge\s+\d+|Sagar\s+Tug\s+\d+)/i);
    if (assetMatch) {
      // Standardize casing for Sagar Barge X / Sagar Tug X
      let rawAsset = assetMatch[1];
      if (/sagar\s+barge\s+\d+/i.test(rawAsset)) {
        const num = rawAsset.match(/\d+/);
        rawAsset = `Sagar Barge ${num ? num[0] : ''}`;
      } else if (/sagar\s+tug\s+\d+/i.test(rawAsset)) {
        const num = rawAsset.match(/\d+/);
        rawAsset = `Sagar Tug ${num ? num[0] : ''}`;
      } else {
        // Upper case KB-XX
        rawAsset = rawAsset.toUpperCase();
      }
      assetReference = rawAsset;
    }

    // Extract dueDate
    let dueDate: Date | null = null;
    const messageLower = trimmedMessage.toLowerCase();
    if (messageLower.includes('tomorrow')) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(12, 0, 0, 0);
      dueDate = d;
    } else if (messageLower.includes('today')) {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      dueDate = d;
    } else {
      const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      for (const day of weekdays) {
        // Match word boundary to avoid partial matches
        const dayRegex = new RegExp(`\\b${day}\\b`, 'i');
        if (dayRegex.test(messageLower)) {
          dueDate = getNextWeekday(day);
          break;
        }
      }
    }

    // Extract priority
    let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
    if (/\b(urgent|high)\b/i.test(trimmedMessage)) {
      priority = 'HIGH';
    } else if (/\b(low)\b/i.test(trimmedMessage)) {
      priority = 'LOW';
    }

    return {
      intent: 'CREATE_TASK',
      assigneeName,
      taskTitle,
      taskDescription: trimmedMessage,
      assetReference,
      dueDate,
      priority,
    };
  }
}
