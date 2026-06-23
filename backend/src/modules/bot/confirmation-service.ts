import { ConversationContextService, PendingAction } from './conversation-context';
import { ToolExecutor, ToolCallRequest } from './tool-executor';
import { Role } from '@prisma/client';

export class ConfirmationService {
  /**
   * Check if a message is a confirmation response.
   */
  public static parseConfirmation(text: string): 'CONFIRM' | 'CANCEL' | null {
    const lower = text.trim().toLowerCase();
    if (/^(yes|confirm|ok|proceed|go ahead|approve|accept|do it)\b/i.test(lower)) return 'CONFIRM';
    if (/^(no|cancel|abort|reject|stop|deny|don'?t)\b/i.test(lower)) return 'CANCEL';
    return null;
  }

  /**
   * Handle a pending confirmation action.
   * Returns the result of the confirmed action, or null if cancelled/invalid.
   */
  public static async handleConfirmation(
    userId: string,
    user: { id: string; name: string; role: Role },
    text: string
  ): Promise<{ status: 'CONFIRMED' | 'CANCELLED' | 'NO_PENDING'; result?: any; message?: string } | null> {
    const ctx = await ConversationContextService.getContext(userId);
    if (!ctx.pendingConfirmation) {
      return { status: 'NO_PENDING' };
    }

    const action: PendingAction = ctx.pendingConfirmation;
    const now = new Date();
    const expiresAt = new Date(action.expiresAt);
    if (now > expiresAt) {
      await ConversationContextService.clearPendingConfirmation(userId);
      return { status: 'CANCELLED', message: 'This confirmation has expired. Please try again.' };
    }

    const decision = this.parseConfirmation(text);
    if (decision === 'CANCEL') {
      await ConversationContextService.clearPendingConfirmation(userId);
      return { status: 'CANCELLED', message: 'Action cancelled. No changes were made.' };
    }

    if (decision === 'CONFIRM') {
      await ConversationContextService.clearPendingConfirmation(userId);
      const request: ToolCallRequest = { tool: action.tool, params: action.params };
      const result = await ToolExecutor.execute(request, user);
      return { status: 'CONFIRMED', result, message: result.message };
    }

    // If the text is neither confirm nor cancel, ask again
    return {
      status: 'NO_PENDING',
      message: `You have a pending action: "${action.description}".\nPlease reply "CONFIRM" to proceed or "CANCEL" to abort.`,
    };
  }

  /**
   * Store a pending action requiring confirmation.
   */
  public static async requestConfirmation(
    userId: string,
    tool: string,
    params: Record<string, any>,
    description: string,
    expiresInMinutes: number = 10
  ): Promise<string> {
    await ConversationContextService.setPendingConfirmation(userId, {
      tool,
      params,
      description,
      expiresInMinutes,
    });
    return `This action requires confirmation.\n${description}\n\nPlease reply "CONFIRM" to proceed or "CANCEL" to abort.`;
  }
}
