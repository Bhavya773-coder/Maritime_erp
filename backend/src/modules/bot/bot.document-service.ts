import prisma from '../../config/db';
import { env } from '../../config/env';
import { generateSignedUrl } from '../../modules/documents/signed-url-controller';

export interface DocumentSearchResult {
  vessel: any;
  doc: any;
  url: string;
}

export class BotDocumentService {
  public static getBaseUrl(): string {
    return (env as any).SERVER_BASE_URL || 
           (process.env.RENDER_EXTERNAL_HOSTNAME 
             ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` 
             : 'http://localhost:5000');
  }

  private static getDocLabels(): Record<string, { singular: string; plural: string }> {
    return {
      'GA_PLAN': { singular: 'GA Plan', plural: 'GA Plans' },
      'REGISTRY': { singular: 'Registry Certificate', plural: 'Registry Certificates' },
      'INSURANCE': { singular: 'Insurance Certificate', plural: 'Insurance Certificates' },
      'STABILITY_BOOKLET': { singular: 'Stability Booklet', plural: 'Stability Booklets' },
      'SURVEY_CLASS': { singular: 'Survey/Class Certificate', plural: 'Survey/Class Certificates' },
    };
  }

  /**
   * Find a specific document for a vessel by name fragment and document type.
   */
  public static async getDocumentRecord(
    vesselNameQuery: string,
    docType: string
  ): Promise<DocumentSearchResult | null> {
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
      return null;
    }

    // Best match: exact > starts-with > first result
    const q = vesselNameQuery.toLowerCase();
    const best = vessels.find(v => v.name.toLowerCase() === q)
      || vessels.find(v => v.name.toLowerCase().startsWith(q))
      || vessels[0];

    if (best.documents.length === 0) {
      return {
        vessel: best,
        doc: null,
        url: '',
      };
    }

    const doc = best.documents[0];
    let url: string;
    try {
      url = generateSignedUrl(doc.filePath, 3600); // 1 hour signed URL
    } catch {
      // Fallback to plain URL if signing secret not configured
      url = encodeURI(`${this.getBaseUrl()}/${doc.filePath}`);
    }

    return {
      vessel: best,
      doc,
      url,
    };
  }

  /**
   * Find document for a vessel and return a formatted text reply description.
   */
  public static async getDocumentReply(
    vesselNameQuery: string,
    docType: string
  ): Promise<string> {
    const labels = this.getDocLabels()[docType] || { singular: docType.replace('_', ' '), plural: docType.replace('_', ' ') };
    const result = await this.getDocumentRecord(vesselNameQuery, docType);

    if (!result) {
      return `❌ No vessel found matching "${vesselNameQuery}".\nTry: "list ${labels.plural}" to see available vessels.`;
    }

    if (!result.doc) {
      return `⚠️ Vessel *${result.vessel.name}* was found but has no ${labels.singular} on file.\nContact fleet manager for the document.`;
    }

    return `📄 *${labels.singular} — ${result.vessel.name}*\n📁 File: ${result.doc.fileName}\n🔗 Download: ${result.url}`;
  }

  /**
   * List all vessels that have documents of a specific type.
   */
  public static async listAllDocuments(docType: string): Promise<string> {
    const labels = this.getDocLabels()[docType] || { singular: docType.replace('_', ' '), plural: docType.replace('_', ' ') };
    
    const docs = await prisma.vesselDocument.findMany({
      where: { docType },
      include: { vessel: { select: { name: true, type: true } } },
      orderBy: { vessel: { name: 'asc' } },
    });

    if (docs.length === 0) {
      return `📋 No ${labels.plural} are currently on file.`;
    }

    const barges = docs.filter(d => d.vessel.type === 'BARGE');
    const tugs = docs.filter(d => d.vessel.type === 'TUG');

    let reply = `📋 *${labels.plural} On File (${docs.length} total)*\n\n`;
    if (barges.length > 0) {
      reply += `*Barges (${barges.length}):*\n`;
      // Deduplicate vessel names in case a vessel has multiple files of same docType
      const uniqueBarges = Array.from(new Set(barges.map(d => d.vessel.name)));
      uniqueBarges.forEach((name, i) => { reply += `${i + 1}. ${name}\n`; });
    }
    if (tugs.length > 0) {
      reply += `\n*Tugs (${tugs.length}):*\n`;
      const uniqueTugs = Array.from(new Set(tugs.map(d => d.vessel.name)));
      uniqueTugs.forEach((name, i) => { reply += `${i + 1}. ${name}\n`; });
    }
    
    reply += `\nTo get a specific document, type: *[document type] for [vessel name]* (e.g. "${labels.singular} for KB 24")`;
    return reply;
  }
}
