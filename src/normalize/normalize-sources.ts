import type { Confidence, SourceRef, SourcedValue } from "../schemas/common.js";

export type SourceInput = {
  sourceId?: string;
  sourceName: string;
  sourceUrl: string;
  collectedAt: string;
  confidence: Confidence;
  notes?: string;
};

export function sourceRef(input: SourceInput): SourceRef {
  return {
    sourceId: input.sourceId,
    sourceName: input.sourceName,
    sourceUrl: input.sourceUrl,
    collectedAt: input.collectedAt,
    confidence: input.confidence,
    notes: input.notes
  };
}

export function sourced<T>(value: T, source: SourceRef, notes?: string): SourcedValue<T> {
  return notes ? { value, source, notes } : { value, source };
}

export function sourcedIncomplete<T>(value: T, source: SourceRef, notes: string): SourcedValue<T> {
  return { value, source, incomplete: true, notes };
}

export function sourcedEstimated<T>(value: T, source: SourceRef, notes: string): SourcedValue<T> {
  return { value, source, estimated: true, notes };
}
