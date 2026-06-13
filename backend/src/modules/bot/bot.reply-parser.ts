export interface ReplyCommand {
  type: 'DONE' | 'UPDATE' | 'STATUS' | 'HELP' | 'DELEGATE';
  targetTaskId?: string;
  message?: string; // For UPDATE/DELEGATE
  assigneeName?: string; // For DELEGATE
}

export class BotReplyParser {
  public static parse(text: string): ReplyCommand | null {
    if (!text) return null;

    // 1. Extract UUID if present (Task ID)
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const uuidMatch = text.match(uuidRegex);
    const targetTaskId = uuidMatch ? uuidMatch[0] : undefined;

    // Remove the UUID from the string to clean the command part
    let cleanedText = text;
    if (targetTaskId) {
      cleanedText = text.replace(targetTaskId, '');
    }
    
    cleanedText = cleanedText.trim();

    // 2. Check for commands
    // DONE or COMPLETE
    if (/^(?:done|complete)\b/i.test(cleanedText)) {
      return { type: 'DONE', targetTaskId };
    }

    // STATUS
    if (/^status\b/i.test(cleanedText)) {
      return { type: 'STATUS', targetTaskId };
    }

    // HELP
    if (/^help\b/i.test(cleanedText)) {
      return { type: 'HELP', targetTaskId };
    }

    // DELEGATE: Assignee - Message
    const delegateMatch = cleanedText.match(/^delegate\b\s*:\s*([^-]+)(?:\s*-\s*([\s\S]+))?/i);
    if (delegateMatch) {
      return {
        type: 'DELEGATE',
        targetTaskId,
        assigneeName: delegateMatch[1].trim(),
        message: delegateMatch[2] ? delegateMatch[2].trim() : undefined,
      };
    }

    // UPDATE: message
    const updateMatch = cleanedText.match(/^update\b\s*:\s*([\s\S]+)/i);
    if (updateMatch) {
      return {
        type: 'UPDATE',
        targetTaskId,
        message: updateMatch[1].trim(),
      };
    }

    return null;
  }
}
