"  /**
   * Recreates the task and query processing system using a multi-turn LLM Agent loop
   */
  public static async translateMessage(
    messageText: string,
    senderUserId: string,
    senderUserName: string,
    senderUserRole: string
  ): Promise<LlmTranslation> {
    const apiEndpoint = env.AI_CHAT_ENDPOINT || env.LLAMA_API_URL;
    if (!apiEndpoint) {
      console.log('[LlmService] AI_CHAT_ENDPOINT / LLAMA_API_URL is not configured. Skipping LLM agent.');
      return { isERPRelated: true, directResponse: null };
    }

    const modelName = env.AI_MODEL || env.LLAMA_MODEL_NAME;

    // Retrieve sender phone
    const contact = await prisma.userContact.findFirst({
      where: { userId: senderUserId, channel: 'WHATSAPP' }
    });
    const senderPhone = contact?.phoneNumber || undefined;

    const user = {
      id: senderUserId,
      name: senderUserName,
      role: senderUserRole as any,
      phone: senderPhone
    };

    const history = await this.getChatHistory(senderUserId);
    const { buildToolsPrompt } = require('./tool-definitions');
    const toolsPrompt = buildToolsPrompt();
    const today = new Date().toISOString().split('T')[0];

    const systemPrompt = `You are the intelligent AI agent for Arvind Port & Infra Limited (APIL), a maritime company. You operate on WhatsApp.
Today's date: ${today}
User you are chatting with: ${senderUserName} (Role: ${senderUserRole})

You can perform tasks, search fleet assets, find staff details, and manage company documents using the tools provided below.

════════════════════════════════════════════════
AVAILABLE TOOLS
════════════════════════════════════════════════
${toolsPrompt}

════════════════════════════════════════════
<truncated 7644 bytes>