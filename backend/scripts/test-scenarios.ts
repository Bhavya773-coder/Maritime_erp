import dotenv from 'dotenv';
dotenv.config();

import prisma from '../src/config/db';
import { WhatsAppService } from '../src/modules/bot/whatsapp.service';

async function runScenario(phone: string, text: string, label: string) {
  console.log(`\n========================================`);
  console.log(`[TEST] Scenario: ${label}`);
  console.log(`[TEST] Sender: ${phone}`);
  console.log(`[TEST] Message: "${text}"`);
  console.log(`========================================`);
  
  const providerMessageId = `test-msg-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  try {
    const result = await WhatsAppService.processIncomingMessage(phone, text, providerMessageId);
    console.log(`[TEST] Result Status:`, result.status);
    console.log(`[TEST] Result Message:`, result.message);
    if (result.outgoing && result.outgoing.length > 0) {
      console.log(`[TEST] Outgoing Message(s):`);
      for (const out of result.outgoing) {
        console.log(`   --> To: ${out.toPhone || out.toUserId || 'Unknown'} | Body: ${out.rawText || out.messageType}`);
      }
    }
  } catch (err: any) {
    console.error(`[TEST] Error in scenario:`, err.message, err.stack);
  }
}

async function main() {
  // Scenario 1: "where is the plan?" -> Should go to LLM naturally, not hijack
  await runScenario('919913810000', 'where is the plan?', 'Natural Language Hijack check (where is the plan)');

  // Scenario 2: "list all staff members name and numbers" -> Should list staff, not stability booklets
  await runScenario('919913810000', 'list all staff members name and numbers', 'Staff list check');

  // Scenario 3: "send a new task to hardik k to bring new clients in AW" -> Task creation & response confirmation
  await runScenario('919913810000', 'send a new task to hardik k to bring new clients in AW', 'Create task agent loop confirmation');

  // Scenario 4: "ga plan for kb 26" by a STAFF user (Parag Dungrani: 917600748296) -> Should succeed and send document
  await runScenario('917600748296', 'ga plan for kb 26', 'Staff user requesting GA Plan');
}

main().catch(console.error).finally(() => prisma.$disconnect());
