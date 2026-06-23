import prisma from '../../config/db';

export interface ConversationState {
  recentAssetId?: string;
  recentAssetName?: string;
  recentTaskId?: string;
  recentTaskTitle?: string;
  pendingConfirmation?: PendingAction | null;
  pendingClarification?: string | null;
  clarificationData?: any;
}

export interface PendingAction {
  tool: string;
  params: Record<string, any>;
  requestedAt: string;
  expiresAt: string;
  description: string;
}

export class ConversationContextService {
  /**
   * Load or create conversation context for a user.
   */
  public static async getContext(userId: string): Promise<ConversationState> {
    const ctx = await prisma.conversationContext.findUnique({
      where: { userId },
    });

    if (!ctx) {
      return {
        pendingConfirmation: null,
        pendingClarification: null,
        clarificationData: null,
      };
    }

    return {
      recentAssetId: ctx.recentAssetId || undefined,
      recentAssetName: ctx.clarificationData && (ctx.clarificationData as any)?.recentAssetName
        ? (ctx.clarificationData as any).recentAssetName
        : undefined,
      recentTaskId: ctx.recentTaskId || undefined,
      recentTaskTitle: ctx.clarificationData && (ctx.clarificationData as any)?.recentTaskTitle
        ? (ctx.clarificationData as any).recentTaskTitle
        : undefined,
      pendingConfirmation: ctx.pendingConfirmation ? JSON.parse(ctx.pendingConfirmation) : null,
      pendingClarification: ctx.pendingClarification,
      clarificationData: ctx.clarificationData,
    };
  }

  /**
   * Update conversation context.
   */
  public static async setContext(userId: string, state: Partial<ConversationState>): Promise<void> {
    const existing = await prisma.conversationContext.findUnique({
      where: { userId },
    });

    const data: any = {};
    if (state.recentAssetId !== undefined) data.recentAssetId = state.recentAssetId;
    if (state.recentTaskId !== undefined) data.recentTaskId = state.recentTaskId;
    if (state.pendingConfirmation !== undefined) {
      data.pendingConfirmation = state.pendingConfirmation ? JSON.stringify(state.pendingConfirmation) : null;
    }
    if (state.pendingClarification !== undefined) data.pendingClarification = state.pendingClarification;
    if (state.clarificationData !== undefined) data.clarificationData = state.clarificationData;

    if (existing) {
      await prisma.conversationContext.update({ where: { userId }, data });
    } else {
      await prisma.conversationContext.create({
        data: {
          userId,
          ...data,
        },
      });
    }
  }

  /**
   * Resolve ambiguous references like "it", "this", "its" using context.
   */
  public static async resolvePronouns(
    userId: string,
    text: string
  ): Promise<{ text: string; assetId?: string; taskId?: string }> {
    const ctx = await this.getContext(userId);
    let resolvedText = text;
    let assetId: string | undefined = ctx.recentAssetId;
    let taskId: string | undefined = ctx.recentTaskId;

    const lower = text.toLowerCase().trim();

    // Resolve "its" / "its registry" / "its insurance" → refer to recentAsset
    if (/(\bits\b|this vessel|this barge|this tug|send me (its|the) (registry|insurance|ga plan|document|certificate|stability))/i.test(lower)) {
      if (ctx.recentAssetId) {
        resolvedText = `${ctx.recentAssetName || 'the vessel'} ${resolvedText}`;
      }
    }

    // Resolve "this task" / "it" when referring to a task
    if (/(\bit\b|this task|complete it|delay it|delegate it|update it)/i.test(lower) && ctx.recentTaskId) {
      taskId = ctx.recentTaskId;
    }

    return { text: resolvedText, assetId, taskId };
  }

  /**
   * Set pending confirmation for a risky action.
   */
  public static async setPendingConfirmation(
    userId: string,
    action: { tool: string; params: Record<string, any>; description: string; expiresInMinutes?: number }
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + (action.expiresInMinutes || 10) * 60 * 1000);
    const pending: PendingAction = {
      tool: action.tool,
      params: action.params,
      requestedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      description: action.description,
    };

    await this.setContext(userId, { pendingConfirmation: pending });
  }

  /**
   * Clear pending confirmation.
   */
  public static async clearPendingConfirmation(userId: string): Promise<void> {
    await this.setContext(userId, { pendingConfirmation: null });
  }

  /**
   * Set pending clarification for ambiguous input.
   */
  public static async setPendingClarification(
    userId: string,
    clarificationType: string,
    data: any
  ): Promise<void> {
    await this.setContext(userId, {
      pendingClarification: clarificationType,
      clarificationData: data,
    });
  }

  /**
   * Clear pending clarification.
   */
  public static async clearPendingClarification(userId: string): Promise<void> {
    await this.setContext(userId, {
      pendingClarification: null,
      clarificationData: null,
    });
  }

  /**
   * Update recent asset context after asset-related queries.
   */
  public static async setRecentAsset(userId: string, assetId: string, assetName: string): Promise<void> {
    await this.setContext(userId, {
      recentAssetId: assetId,
      clarificationData: {
        ...(await this.getContext(userId)).clarificationData,
        recentAssetName: assetName,
      },
    });
  }

  /**
   * Update recent task context after task-related queries.
   */
  public static async setRecentTask(userId: string, taskId: string, taskTitle: string): Promise<void> {
    await this.setContext(userId, {
      recentTaskId: taskId,
      clarificationData: {
        ...(await this.getContext(userId)).clarificationData,
        recentTaskTitle: taskTitle,
      },
    });
  }
}
