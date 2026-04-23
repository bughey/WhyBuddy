export const WEB_AIGC_SIMILARITY_MATCH_API = {
  EXECUTE: "POST /api/similarity-match/nodes/execute",
} as const;

export const WEB_AIGC_SIMILARITY_MATCH_NODE_TYPES = [
  "similarity_match",
] as const;

export type SimilarityMatchNodeType =
  (typeof WEB_AIGC_SIMILARITY_MATCH_NODE_TYPES)[number];

export const WEB_AIGC_SIMILARITY_MATCH_MODES = [
  "text",
  "vector",
  "hybrid",
] as const;

export type SimilarityMatchMode =
  (typeof WEB_AIGC_SIMILARITY_MATCH_MODES)[number];

export const WEB_AIGC_SIMILARITY_MATCH_BRANCHES = [
  "matched",
  "not_matched",
] as const;

export type SimilarityMatchBranchKey =
  (typeof WEB_AIGC_SIMILARITY_MATCH_BRANCHES)[number];

export interface SimilarityMatchCandidateInput {
  candidateId?: string;
  label?: string;
  text?: string;
  vector?: number[];
  metadata?: Record<string, unknown>;
}

export interface SimilarityMatchNodeOptions {
  mode?: SimilarityMatchMode;
  threshold?: number;
  topK?: number;
  textWeight?: number;
  vectorWeight?: number;
}

export interface SimilarityMatchNodeInput {
  query?: string;
  queryVector?: number[];
  candidates?: SimilarityMatchCandidateInput[];
  options?: SimilarityMatchNodeOptions;
  context?: Record<string, unknown>;
}

export interface SimilarityMatchNodeExecutionRequest {
  nodeType: SimilarityMatchNodeType;
  input?: SimilarityMatchNodeInput;
}

export interface SimilarityMatchScoredCandidate {
  candidateId: string;
  label?: string;
  text?: string;
  score: number;
  textScore: number;
  vectorScore: number;
  matched: boolean;
  thresholdGap: number;
  metadata: Record<string, unknown>;
}

export interface SimilarityMatchStrategySummary {
  mode: SimilarityMatchMode;
  threshold: number;
  topK: number;
  textWeight: number;
  vectorWeight: number;
  usedExplicitQueryVector: boolean;
  usedExplicitCandidateVectors: boolean;
  usedHashVectorFallback: boolean;
}

export interface SimilarityMatchResultSummary {
  matched: boolean;
  matchedCount: number;
  topScore: number;
  threshold: number;
  thresholdGap: number;
}

export interface SimilarityMatchBranchSummary {
  selected: SimilarityMatchBranchKey;
  conditions: {
    matched: boolean;
    not_matched: boolean;
  };
}

export interface SimilarityMatchNodeResultPayload {
  bestMatch?: SimilarityMatchScoredCandidate;
  matches: SimilarityMatchScoredCandidate[];
  summary: SimilarityMatchResultSummary;
  branch: SimilarityMatchBranchSummary;
}

export interface SimilarityMatchNodeExecutionResult {
  ok: true;
  nodeType: SimilarityMatchNodeType;
  output: {
    status: "completed";
    query: {
      text?: string;
      vectorProvided: boolean;
      candidateCount: number;
    };
    strategy: SimilarityMatchStrategySummary;
    result: SimilarityMatchNodeResultPayload;
    bestMatch?: SimilarityMatchScoredCandidate;
    matches: SimilarityMatchScoredCandidate[];
    evaluatedCandidates: SimilarityMatchScoredCandidate[];
    summary: SimilarityMatchResultSummary;
    branch: SimilarityMatchBranchSummary;
    context: Record<string, unknown>;
    warnings: string[];
    observability: {
      eventKey: "external.similarity_match";
      nodeType: SimilarityMatchNodeType;
      mode: SimilarityMatchMode;
      threshold: number;
      candidateCount: number;
      matchedCount: number;
      topScore: number;
    };
  };
}
