import { env } from '../../config/env';

export interface LlmTranslation {
  isERPRelated: boolean;
  extractedCommand: string | null;
}

export class LlmService {
  /**
   * Translates natural language message to standard bot command using self-hosted Llama LLM
   */
  public static async translateMessage(messageText: string): Promise<LlmTranslation> {
    if (!env.LLAMA_API_URL) {
      console.log('[LlmService] LLAMA_API_URL is not configured. Skipping LLM translation.');
      return { isERPRelated: true, extractedCommand: messageText };
    }

    const systemPrompt = `You are an intelligent natural language translation engine for the Arvind Port & Infra Limited Maritime ERP bot.
Your job is to translate natural language user messages into standard ERP bot commands, or flag the message if it is not related to ERP operations.

Available standard bot commands:
1. Task Assignment:
   - Format: "Tell/Ask/Remind <Name> to <Action>" (e.g. "Tell Hardik K to check the fuel")
   - Keywords/contexts: "tomorrow", "today", "monday", "urgent", "high", "low"
2. Vessel Queries & Location Updates:
   - Format: "where is <Vessel Name>" (e.g. "where is KB 26")
   - Format: "list barges", "list tugs", "list in port", "list maintenance", "list all"
   - Format: "Update <Vessel Name> location to <Location>" (e.g. "Update KB 26 location to Mumbai")
3. Staff Queries & Updates:
   - Format: "staff list" or "how many members"
   - Format: "ag staff" or "list ag staff"
   - Format: "owners" or "list owners"
   - Format: "Add staff <Name> <Number> <Position>" (e.g. "Add staff Ramesh +919876543210 ag staff")
4. Task Management Replies:
   - Format: "DONE" (optionally with task ID, e.g. "DONE 123e4567-...")
   - Format: "UPDATE: <message>" (e.g. "UPDATE: check complete")
   - Format: "DELEGATE: <Name> - <Note>"
   - Format: "STATUS"
   - Format: "HELP"

Guidelines:
- If the user's message is related to ERP operations (tasks, vessels, locations, staff list, adding staff, updates), set isERPRelated to true, and translate their message into the most appropriate standard command.
- If the user's message is a general question, coding question, writing task, general knowledge, or anything not related to maritime ERP operations, set isERPRelated to false, and leave extractedCommand as null.

You must reply with ONLY a JSON object in this format (no other text, no markdown block formatting):
{
  "isERPRelated": boolean,
  "extractedCommand": string | null
}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (env.LLAMA_API_KEY) {
      headers['Authorization'] = `Bearer ${env.LLAMA_API_KEY}`;
    }

    try {
      const response = await fetch(env.LLAMA_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: env.LLAMA_MODEL_NAME,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: messageText }
          ],
          temperature: 0.1, // low temperature for deterministic commands
          response_format: { type: 'json_object' } // Request JSON output if supported by model
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[LlmService] Llama API error: ${response.status} - ${errText}`);
        return { isERPRelated: true, extractedCommand: messageText };
      }

      const resJson: any = await response.json();
      const rawContent = resJson.choices?.[0]?.message?.content || '';
      
      console.log(`[LlmService] Raw response content: "${rawContent}"`);

      // Clean response to parse JSON reliably (extract text between first '{' and last '}')
      const match = rawContent.match(/\{[\s\S]*\}/);
      if (!match) {
        console.warn('[LlmService] Failed to extract JSON block from LLM response.');
        return { isERPRelated: true, extractedCommand: messageText };
      }

      const parsed = JSON.parse(match[0]) as LlmTranslation;
      return {
        isERPRelated: typeof parsed.isERPRelated === 'boolean' ? parsed.isERPRelated : true,
        extractedCommand: parsed.extractedCommand || null
      };

    } catch (err: any) {
      console.error('[LlmService] Exception during LLM query:', err);
      // Fallback: return original message to let existing regex engines parse it
      return { isERPRelated: true, extractedCommand: messageText };
    }
  }
}
