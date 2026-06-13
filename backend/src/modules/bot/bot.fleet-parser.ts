export interface FleetQuery {
  type: 'SINGLE_VESSEL' | 'LIST_BARGES' | 'LIST_TUGS' | 'LIST_ALL' | 'LIST_IN_PORT' | 'LIST_MAINTENANCE';
  vesselName?: string;
}

export class BotFleetParser {
  public static parse(text: string): FleetQuery | null {
    if (!text) return null;
    const clean = text.trim().toLowerCase();

    // 1. Single vessel status
    // Matches: "where is ARCADIA 1", "status of ARCADIA 1", "ARCADIA 1 status", "where is KB 26", "where is ARCADIA 1?"
    const whereIsMatch = clean.match(/^(?:where is|status of)\s+(.+?)(?:\?|$)/i);
    if (whereIsMatch) {
      return { type: 'SINGLE_VESSEL', vesselName: whereIsMatch[1].trim() };
    }
    
    const statusEndMatch = clean.match(/(.+?)\s+status(?:\?|$)/i);
    if (statusEndMatch) {
      return { type: 'SINGLE_VESSEL', vesselName: statusEndMatch[1].trim() };
    }

    // 2. List barges
    if (/\b(?:show all barges|list barges|show barges)\b/i.test(clean)) {
      return { type: 'LIST_BARGES' };
    }

    // 3. List tugs
    if (/\b(?:show all tugs|list tugs|show tugs)\b/i.test(clean)) {
      return { type: 'LIST_TUGS' };
    }

    // 4. List in port
    if (/\b(?:which vessels are in port|vessels in port|in port)\b/i.test(clean)) {
      return { type: 'LIST_IN_PORT' };
    }

    // 5. List maintenance
    if (/\b(?:show maintenance vessels|vessels in maintenance|maintenance vessels)\b/i.test(clean)) {
      return { type: 'LIST_MAINTENANCE' };
    }

    // 6. List all vessels
    if (/\b(?:list vessels|show all vessels|all vessels|show vessels)\b/i.test(clean)) {
      return { type: 'LIST_ALL' };
    }

    return null;
  }
}
