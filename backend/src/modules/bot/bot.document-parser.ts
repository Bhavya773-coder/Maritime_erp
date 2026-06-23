export interface DocumentQuery {
  type: 'GET_DOCUMENT' | 'LIST_DOCUMENTS';
  docType?: string; // 'GA_PLAN' | 'REGISTRY' | 'INSURANCE' | 'STABILITY_BOOKLET' | 'SURVEY_CLASS'
  vesselName?: string;
}

export class BotDocumentParser {
  private static mapKeywordToDocType(keyword: string): string | null {
    const kw = keyword.toLowerCase().trim();
    if (/ga\s*plans?|general\s*arrangements?|ga\s*drawings?|drawing|plan/i.test(kw)) return 'GA_PLAN';
    if (/registries|registry\s*certs?|registry\s*certificates?|registry|reg/i.test(kw)) return 'REGISTRY';
    if (/insurances|insurance\s*certs?|insurance\s*certificates?|insurance|ins/i.test(kw)) return 'INSURANCE';
    if (/stability\s*booklets?|stabilities|stability|sta|booklet/i.test(kw)) return 'STABILITY_BOOKLET';
    if (/survey\s*certs?|survey\s*certificates?|surveys?|class\s*certs?|class\s*certificates?|class/i.test(kw)) return 'SURVEY_CLASS';
    return null;
  }

  public static parse(text: string): DocumentQuery | null {
    if (!text) return null;
    const clean = text.trim();

    // 1. Parse LIST queries
    // E.g. "list GA plans", "show registries", "list insurance certificates"
    const listMatch = clean.match(/^(?:list|show)(?:\s+all)?\s+(.+?)(?:\s*\?)?$/i);
    if (listMatch && listMatch[1]) {
      const docType = this.mapKeywordToDocType(listMatch[1]);
      if (docType) {
        return { type: 'LIST_DOCUMENTS', docType };
      }
    }

    // 2. Parse GET queries
    const getPatterns = [
      // Matches "GA plan for ARCADIA SUMERU", "registry certificate of KB 24", etc.
      /^(?:(?:send|get|share|show|give)(?:\s+me)?(?:\s+the)?\s+)?(ga\s*plans?|general\s*arrangements?|ga\s*drawings?|registries|registry\s*certs?|registry\s*certificates?|registry|reg|insurances|insurance\s*certs?|insurance\s*certificates?|insurance|ins|stability\s*booklets?|stabilities|stability|sta|survey\s*certs?|survey\s*certificates?|surveys?|class\s*certs?|class\s*certificates?|class|drawing|plan|booklet)\s+(?:for|of)\s+(.+)$/i,
      
      // Matches "ARCADIA SUMERU GA plan", "KB 24 registry", etc.
      /^(.+?)\s+(ga\s*plans?|general\s*arrangements?|ga\s*drawings?|registries|registry\s*certs?|registry\s*certificates?|registry|reg|insurances|insurance\s*certs?|insurance\s*certificates?|insurance|ins|stability\s*booklets?|stabilities|stability|sta|survey\s*certs?|survey\s*certificates?|surveys?|class\s*certs?|class\s*certificates?|class|drawing|plan|booklet)(?:\s*\?)?$/i,
      
      // Matches "get GA plan KB 24"
      /^(?:(?:send|get|share|show|give)(?:\s+me)?(?:\s+the)?\s+)?(ga\s*plans?|general\s*arrangements?|ga\s*drawings?|registries|registry\s*certs?|registry\s*certificates?|registry|reg|insurances|insurance\s*certs?|insurance\s*certificates?|insurance|ins|stability\s*booklets?|stabilities|stability|sta|survey\s*certs?|survey\s*certificates?|surveys?|class\s*certs?|class\s*certificates?|class|drawing|plan|booklet)\s+(arcadia\s+\S+|kb\s+\d+|[a-z0-9\s\-]+?)(?:\s*\?)?$/i
    ];

    for (let idx = 0; idx < getPatterns.length; idx++) {
      const pattern = getPatterns[idx];
      const match = clean.match(pattern);
      if (match) {
        let keywordCandidate = match[1];
        let vesselCandidate = match[2];
        
        // For pattern 1 (index 1): match[1] is vessel name, match[2] is keyword
        if (idx === 1) {
          keywordCandidate = match[2];
          vesselCandidate = match[1];
        }

        const docType = this.mapKeywordToDocType(keywordCandidate);
        if (docType) {
          const vesselName = vesselCandidate.trim().replace(/[?.]$/, '');
          if (vesselName.length > 1) {
            return { type: 'GET_DOCUMENT', docType, vesselName };
          }
        }
      }
    }

    return null;
  }
}
