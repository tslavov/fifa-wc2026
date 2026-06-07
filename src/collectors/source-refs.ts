import { sourceRef } from "../normalize/normalize-sources.js";

export const COLLECTED_AT = "2026-06-07";

export const FIFA_REGULATIONS_SOURCE = sourceRef({
  sourceId: "fifa-regulations-2026",
  sourceName: "FIFA Regulations for the FIFA World Cup 26",
  sourceUrl: "https://digitalhub.fifa.com/m/636f5c9c6f29771f/original/FWC2026_regulations_EN.pdf",
  collectedAt: COLLECTED_AT,
  confidence: "high",
  notes: "Official FIFA regulations PDF, May 2026."
});

export const FIFA_RULES_EXPLAINER_SOURCE = sourceRef({
  sourceId: "fifa-rules-explainer-2026",
  sourceName: "FIFA World Cup 2026 groups: How teams qualify and tie-breakers",
  sourceUrl: "https://www.fifa.com/en/articles/groups-how-teams-qualify-tie-breakers",
  collectedAt: COLLECTED_AT,
  confidence: "high",
  notes: "Official FIFA explanatory article."
});

export const FIFA_SCHEDULE_SOURCE = sourceRef({
  sourceId: "fifa-match-schedule-2026",
  sourceName: "FIFA World Cup 2026 match schedule",
  sourceUrl: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/match-schedule-fixtures-results-teams-stadiums",
  collectedAt: COLLECTED_AT,
  confidence: "high",
  notes: "Official FIFA match schedule page."
});

export const FIFA_SCHEDULE_PDF_SOURCE = sourceRef({
  sourceId: "fifa-match-schedule-pdf-2026",
  sourceName: "FIFA World Cup 26 Match Schedule PDF",
  sourceUrl: "https://digitalhub.fifa.com/m/1be9ce37eb98fcc5/original/FWC26-Match-Schedule_English.pdf",
  collectedAt: COLLECTED_AT,
  confidence: "high",
  notes: "Official FIFA match schedule PDF, 10 April 2026."
});
