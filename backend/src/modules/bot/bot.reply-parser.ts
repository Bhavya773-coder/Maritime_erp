export interface ReplyCommand {
  type: 'DONE' | 'UPDATE' | 'STATUS' | 'HELP' | 'DELEGATE' | 'DELAY' | 'APPROVE_DELAY' | 'REJECT_DELAY';
  targetTaskId?: string;
  message?: string; // For UPDATE/DELEGATE/REJECT_DELAY
  assigneeName?: string; // For DELEGATE
  delayDate?: string; // For DELAY
  delayReason?: string; // For DELAY
  delayRequestId?: string; // For APPROVE_DELAY/REJECT_DELAY
}

export class BotReplyParser {
  public static parse(text: string): ReplyCommand | null {
    if (!text) return null;

    // 1. Extract Task ID or Delay Request ID if present (UUID or MongoDB ObjectId)
    const idRegex = /[0-9a-f]{24}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const idMatch = text.match(idRegex);
    const targetTaskId = idMatch ? idMatch[0] : undefined;

    // Remove the ID from the string to clean the command part
    let cleanedText = text;
    if (targetTaskId) {
      cleanedText = text.replace(targetTaskId, '');
    }
    
    cleanedText = cleanedText.trim();
    const lower = cleanedText.toLowerCase();

    // 2. Natural language command detection (no prefixes required)

    // APPROVE DELAY - "approve delay abc123", "approve delay request abc123"
    const approveDelayMatch = text.match(/(?:approve|accept).*(?:delay|extension).*([0-9a-f]{24})/i);
    if (approveDelayMatch) {
      return { type: 'APPROVE_DELAY', delayRequestId: approveDelayMatch[1] };
    }
    // Also check if ID is at the end: "approve delay abc123"
    const approveDelayEndMatch = text.match(/(?:approve|accept).*(?:delay|extension).*([0-9a-f]{24})$/i);
    if (approveDelayEndMatch) {
      return { type: 'APPROVE_DELAY', delayRequestId: approveDelayEndMatch[1] };
    }

    // REJECT DELAY - "reject delay abc123", "reject delay request abc123"
    const rejectDelayMatch = text.match(/(?:reject|deny|decline).*(?:delay|extension).*([0-9a-f]{24})/i);
    if (rejectDelayMatch) {
      return { type: 'REJECT_DELAY', delayRequestId: rejectDelayMatch[1], message: cleanedText };
    }
    
    // DONE or COMPLETE - natural phrases
    if (/\b(?:done|completed|finished|mark as done|it is done|all done|task completed|i have completed|i have finished|i finished)\b/i.test(lower)) {
      return { type: 'DONE', targetTaskId };
    }

    // STATUS
    if (/^(?:status|my tasks|what are my tasks|show my tasks|task status)\b/i.test(lower)) {
      return { type: 'STATUS', targetTaskId };
    }

    // HELP
    if (/^(?:help|commands|what can i do|how to use|assist me)\b/i.test(lower)) {
      return { type: 'HELP', targetTaskId };
    }

    // DELAY - natural phrases: "delay until Monday", "extend to next week", "postpone to tomorrow", "need more time until Friday"
    const delayPatterns = [
      /(?:delay|extend|postpone|push)\s+(?:this\s+)?(?:until|till|to|by)\s+(.+)/i,
      /(?:need|request|ask for)\s+(?:more\s+)?time\s+(?:until|till|to|by)\s+(.+)/i,
      /(?:delay|extend|postpone)\s+(?:this\s+)?(?:by\s+)?(\d+\s+(?:day|days|week|weeks|month|months))/i,
      /(?:can't|cannot|won't|will not)\s+(?:finish|complete|do)\s+(?:it|this|the task)\s+(?:until|till|by)\s+(.+)/i,
    ];
    for (const pattern of delayPatterns) {
      const delayMatch = cleanedText.match(pattern);
      if (delayMatch && delayMatch[1].trim().length > 0) {
        return {
          type: 'DELAY',
          targetTaskId,
          delayDate: delayMatch[1].trim(),
          delayReason: cleanedText,
        };
      }
    }

    // DELEGATE - natural phrases: "delegate to Hardik", "transfer to Hardik", "give this to Hardik", "pass to Hardik"
    const delegatePatterns = [
      /(?:delegate|transfer|pass|give)\s+(?:this\s+)?(?:to\s+)?(.+?)(?:\s+(?:because|since|as|for|with|note)\b|$)/i,
      /(?:delegate|transfer|pass|give)\s+to\s+(.+?)(?:\s+(?:because|since|as|for|with|note)\b|$)/i,
    ];
    for (const pattern of delegatePatterns) {
      const delegateMatch = cleanedText.match(pattern);
      if (delegateMatch && delegateMatch[1].trim().length > 0) {
        return {
          type: 'DELEGATE',
          targetTaskId,
          assigneeName: delegateMatch[1].trim(),
          message: cleanedText,
        };
      }
    }

    // UPDATE - natural phrases: "update: I need more time", "progress: 50% done", "I don't have funds"
    // Also catch general status updates that aren't explicitly commands
    const updatePatterns = [
      /^update\s*[:\-]\s*([\s\S]+)/i,
      /^progress\s*[:\-]\s*([\s\S]+)/i,
      /^(?:i\s+(?:don't|do not|cant|cannot|can not)\s+have|i\s+need|the\s+surveyor|spare\s+part|waiting\s+for|delayed\s+because|need\s+more\s+time)/i,
    ];
    for (const pattern of updatePatterns) {
      const updateMatch = cleanedText.match(pattern);
      if (updateMatch) {
        return {
          type: 'UPDATE',
          targetTaskId,
          message: updateMatch[1] ? updateMatch[1].trim() : cleanedText,
        };
      }
    }

    // If the text looks like a general status update (not a command), still try to capture it
    if (cleanedText.length > 10 && !targetTaskId && 
        /(?:can't|cannot|waiting|delayed|stuck|blocked|need|progress|almost|partially|halfway)/i.test(cleanedText)) {
      return {
        type: 'UPDATE',
        targetTaskId,
        message: cleanedText,
      };
    }

    return null;
  }
}
