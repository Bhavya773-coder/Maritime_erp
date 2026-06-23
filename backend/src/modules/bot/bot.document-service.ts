import prisma from '../../config/db';
import { env } from '../../config/env';

export class BotDocumentService {
  private static getBaseUrl(): string {
    return (env as any).SERVER_BASE_URL || 
           (process.env.RENDER_EXTERNAL_HOSTNAME 
             ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` 
             : 'http://localhost:5000');
  }

  /**
   * Find GA Plan document for a vessel by name fragment.
   * Returns formatted WhatsApp reply string.
   */
  public static async getDocumentReply(
    vesselNameQuery: string,
    docType: string = 'GA_PLAN'
  ): Promise<string> {
    const vessels = await prisma.vessel.findMany({
      where: {
        name: { contains: vesselNameQuery, mode: 'insensitive' },
        deletedAt: null,
      },
      include: {
        documents: { where: { docType } },
      },
    });

    if (vessels.length === 0) {
      return `❌ No vessel found matching "${vesselNameQuery}".\nTry: "list GA plans" to see available vessels.`;
    }

    // Best match: exact > starts-with > first result
    const q = vesselNameQuery.toLowerCase();
    const best = vessels.find(v => v.name.toLowerCase() === q)
      || vessels.find(v => v.name.toLowerCase().startsWith(q))
      || vessels[0];

    if (best.documents.length === 0) {
      return `⚠️ Vessel *${best.name}* was found but has no ${docType.replace('_', ' ')} on file.\nContact fleet manager for the document.`;
    }

    const doc = best.documents[0];
    const url = `${this.getBaseUrl()}/${doc.filePath}`;

    return `📄 *GA Plan — ${best.name}*\n📁 File: ${doc.fileName}\n🔗 Download: ${url}`;
  }

  /**
   * List all vessels that have GA plans.
   */
  public static async listAllGaPlans(): Promise<string> {
    const docs = await prisma.vesselDocument.findMany({
      where: { docType: 'GA_PLAN' },
      include: { vessel: { select: { name: true, type: true } } },
      orderBy: { vessel: { name: 'asc' } },
    });

    if (docs.length === 0) {
      return '📋 No GA Plans are currently on file.';
    }

    const barges = docs.filter(d => d.vessel.type === 'BARGE');
    const tugs = docs.filter(d => d.vessel.type === 'TUG');

    let reply = `📋 *GA Plans On File (${docs.length} total)*\n\n`;
    if (barges.length > 0) {
      reply += `*Barges (${barges.length}):*\n`;
      barges.forEach((d, i) => { reply += `${i + 1}. ${d.vessel.name}\n`; });
    }
    if (tugs.length > 0) {
      reply += `\n*Tugs (${tugs.length}):*\n`;
      tugs.forEach((d, i) => { reply += `${i + 1}. ${d.vessel.name}\n`; });
    }
    reply += `\nTo get a specific plan, type: *GA plan for [vessel name]*`;
    return reply;
  }
}
