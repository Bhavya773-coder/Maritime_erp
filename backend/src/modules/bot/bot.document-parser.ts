export interface DocumentQuery {
  type: 'GET_GA_PLAN' | 'LIST_GA_PLANS';
  vesselName?: string;
}

export class BotDocumentParser {
  public static parse(text: string): DocumentQuery | null {
    if (!text) return null;
    const clean = text.trim();

    // LIST queries — must check before GET to avoid "list GA plans for X" being misrouted
    if (/^(?:list|show)(?:\s+all)?\s+(?:ga\s*plans?|general\s+arrangements?)(?:\s*\?)?$/i.test(clean)) {
      return { type: 'LIST_GA_PLANS' };
    }

    // GET queries — all patterns that ask for a specific vessel's GA plan
    // Matches: "GA plan for ARCADIA SUMERU", "get GA plan KB 24", "send me GA plan of KB 23",
    //          "general arrangement ARCADIA 1", "drawing for KB 26", "GA drawing KB 25"
    const getPatterns = [
      /(?:ga\s*plan|general\s+arrangement|ga\s+drawing)\s+(?:for|of)\s+(.+)/i,
      /(?:ga\s*plan|general\s+arrangement|ga\s+drawing)\s+([A-Z0-9][\w\s\-]+)/i,
      /(?:send|get|share|show)(?:\s+me)?\s+(?:the\s+)?(?:ga\s*plan|ga\s+drawing|general\s+arrangement)\s+(?:for|of)?\s*(.+)/i,
      /(?:drawing|plan|arrangement)\s+(?:for|of)\s+(arcadia\s+\S+|kb\s+\d+)/i,
    ];

    for (const pattern of getPatterns) {
      const match = clean.match(pattern);
      if (match && match[1]) {
        const vesselName = match[1].trim().replace(/[?.]$/, '');
        if (vesselName.length > 1) {
          return { type: 'GET_GA_PLAN', vesselName };
        }
      }
    }

    return null;
  }
}
