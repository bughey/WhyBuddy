import type {
  SimilarityMatchBranchSummary,
  SimilarityMatchCandidateInput,
  SimilarityMatchMode,
  SimilarityMatchNodeExecutionRequest,
  SimilarityMatchNodeExecutionResult,
  SimilarityMatchNodeInput,
  SimilarityMatchNodeType,
  SimilarityMatchScoredCandidate,
  SimilarityMatchStrategySummary,
} from "../../../shared/web-aigc-similarity-match.js";

const DEFAULT_VECTOR_DIMENSION = 96;
const DEFAULT_THRESHOLD = 0.72;
const DEFAULT_TOP_K = 3;
const DEFAULT_TEXT_WEIGHT = 0.7;
const DEFAULT_VECTOR_WEIGHT = 0.3;

interface NormalizedCandidate {
  candidateId: string;
  label?: string;
  text?: string;
  vector?: number[];
  metadata: Record<string, unknown>;
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return { ...(value as Record<string, unknown>) };
}

function normalizeNumberArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .filter((item): item is number => typeof item === "number" && Number.isFinite(item))
    .map(item => item);

  return normalized.length > 0 ? normalized : undefined;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}

function normalizeThreshold(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_THRESHOLD;
  }

  return clamp01(value);
}

function normalizeTopK(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_TOP_K;
  }

  return Math.max(1, Math.min(50, Math.floor(value)));
}

function normalizeMode(value: unknown): SimilarityMatchMode {
  if (value === "text" || value === "vector" || value === "hybrid") {
    return value;
  }

  return "hybrid";
}

function normalizeWeight(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, value);
}

function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, item) => sum + item * item, 0));
  if (magnitude === 0) {
    return vector.slice();
  }

  return vector.map(item => item / magnitude);
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[\u4e00-\u9fff]{1,8}|[a-z0-9_]+/g) || []).filter(
    token => token.length >= 2,
  );
}

function uniqueTokens(text: string): string[] {
  return Array.from(new Set(tokenize(text)));
}

function hashToken(token: string): number {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function embedText(text: string, dimension: number = DEFAULT_VECTOR_DIMENSION): number[] {
  const vector = new Array<number>(dimension).fill(0);
  const counts = new Map<string, number>();

  for (const token of tokenize(text)) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  for (const [token, count] of Array.from(counts.entries())) {
    const hash = hashToken(token);
    const index = hash % dimension;
    const sign = hash % 2 === 0 ? 1 : -1;
    vector[index] += count * sign;
  }

  return normalizeVector(vector);
}

function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  if (length === 0) {
    return 0;
  }

  let score = 0;
  for (let index = 0; index < length; index += 1) {
    score += left[index] * right[index];
  }

  return clamp01(score);
}

function computeTextSimilarity(query: string | undefined, candidate: string | undefined): number {
  if (!query || !candidate) {
    return 0;
  }

  if (query === candidate) {
    return 1;
  }

  const queryTokens = uniqueTokens(query);
  const candidateTokens = uniqueTokens(candidate);
  if (queryTokens.length === 0 || candidateTokens.length === 0) {
    return 0;
  }

  const querySet = new Set(queryTokens);
  const candidateSet = new Set(candidateTokens);
  const intersection = queryTokens.filter(token => candidateSet.has(token)).length;
  const union = new Set([...queryTokens, ...candidateTokens]).size || 1;
  const jaccard = intersection / union;
  const containment = intersection / Math.max(1, Math.min(querySet.size, candidateSet.size));
  const substring = query.includes(candidate) || candidate.includes(query) ? 1 : 0;

  return clamp01(jaccard * 0.5 + containment * 0.35 + substring * 0.15);
}

function buildNormalizedCandidates(
  input: SimilarityMatchNodeInput | undefined,
  warnings: string[],
): NormalizedCandidate[] {
  if (!Array.isArray(input?.candidates)) {
    return [];
  }

  const normalized: NormalizedCandidate[] = [];

  input.candidates.forEach((candidate, index) => {
    const normalizedCandidate = normalizeCandidate(candidate, index);
    if (!normalizedCandidate) {
      warnings.push(
        `Candidate at index ${index} was ignored because it did not include text, label, or vector content.`,
      );
      return;
    }

    normalized.push(normalizedCandidate);
  });

  return normalized;
}

function normalizeCandidate(
  candidate: SimilarityMatchCandidateInput,
  index: number,
): NormalizedCandidate | undefined {
  const label = normalizeString(candidate.label);
  const text = normalizeString(candidate.text) ?? label;
  const vector = normalizeNumberArray(candidate.vector);

  if (!text && !vector) {
    return undefined;
  }

  return {
    candidateId: normalizeString(candidate.candidateId) ?? `candidate-${index + 1}`,
    ...(label ? { label } : {}),
    ...(text ? { text } : {}),
    ...(vector ? { vector: normalizeVector(vector) } : {}),
    metadata: normalizeRecord(candidate.metadata),
  };
}

function buildStrategySummary(input: SimilarityMatchNodeInput | undefined): SimilarityMatchStrategySummary {
  const mode = normalizeMode(input?.options?.mode);
  const threshold = normalizeThreshold(input?.options?.threshold);
  const topK = normalizeTopK(input?.options?.topK);

  if (mode === "text") {
    return {
      mode,
      threshold,
      topK,
      textWeight: 1,
      vectorWeight: 0,
      usedExplicitQueryVector: false,
      usedExplicitCandidateVectors: false,
      usedHashVectorFallback: false,
    };
  }

  if (mode === "vector") {
    return {
      mode,
      threshold,
      topK,
      textWeight: 0,
      vectorWeight: 1,
      usedExplicitQueryVector: false,
      usedExplicitCandidateVectors: false,
      usedHashVectorFallback: false,
    };
  }

  const rawTextWeight = normalizeWeight(input?.options?.textWeight, DEFAULT_TEXT_WEIGHT);
  const rawVectorWeight = normalizeWeight(input?.options?.vectorWeight, DEFAULT_VECTOR_WEIGHT);
  const weightSum = rawTextWeight + rawVectorWeight;
  const textWeight = weightSum > 0 ? rawTextWeight / weightSum : DEFAULT_TEXT_WEIGHT;
  const vectorWeight = weightSum > 0 ? rawVectorWeight / weightSum : DEFAULT_VECTOR_WEIGHT;

  return {
    mode,
    threshold,
    topK,
    textWeight,
    vectorWeight,
    usedExplicitQueryVector: false,
    usedExplicitCandidateVectors: false,
    usedHashVectorFallback: false,
  };
}

function pickVectorSource(
  explicitVector: number[] | undefined,
  fallbackText: string | undefined,
): { vector?: number[]; usedExplicit: boolean; usedFallback: boolean } {
  if (explicitVector) {
    return {
      vector: explicitVector,
      usedExplicit: true,
      usedFallback: false,
    };
  }

  if (fallbackText) {
    return {
      vector: embedText(fallbackText),
      usedExplicit: false,
      usedFallback: true,
    };
  }

  return {
    usedExplicit: false,
    usedFallback: false,
  };
}

function combineScores(
  mode: SimilarityMatchMode,
  strategy: SimilarityMatchStrategySummary,
  textScore: number,
  vectorScore: number,
  textAvailable: boolean,
  vectorAvailable: boolean,
): number {
  if (mode === "text") {
    return textAvailable ? textScore : 0;
  }

  if (mode === "vector") {
    return vectorAvailable ? vectorScore : 0;
  }

  const weightedScores: number[] = [];
  const weights: number[] = [];

  if (textAvailable) {
    weightedScores.push(textScore * strategy.textWeight);
    weights.push(strategy.textWeight);
  }

  if (vectorAvailable) {
    weightedScores.push(vectorScore * strategy.vectorWeight);
    weights.push(strategy.vectorWeight);
  }

  if (weights.length === 0) {
    return 0;
  }

  const score = weightedScores.reduce((sum, item) => sum + item, 0) /
    weights.reduce((sum, item) => sum + item, 0);

  return clamp01(score);
}

function buildBranchSummary(matched: boolean): SimilarityMatchBranchSummary {
  return {
    selected: matched ? "matched" : "not_matched",
    conditions: {
      matched,
      not_matched: !matched,
    },
  };
}

function validationError(message: string): Error {
  return new Error(message);
}

export function isSimilarityMatchNodeType(value: unknown): value is SimilarityMatchNodeType {
  return value === "similarity_match";
}

export async function executeSimilarityMatchNode(
  request: SimilarityMatchNodeExecutionRequest,
): Promise<SimilarityMatchNodeExecutionResult> {
  if (!isSimilarityMatchNodeType(request.nodeType)) {
    throw new Error("Unsupported similarity_match node type.");
  }

  const input = request.input ?? {};
  const warnings: string[] = [];
  const queryText = normalizeString(input.query);
  const queryVector = normalizeNumberArray(input.queryVector)?.map(item => item);
  const candidates = buildNormalizedCandidates(input, warnings);

  if (!queryText && !queryVector) {
    throw validationError("Similarity match node requires query text or queryVector.");
  }

  if (!Array.isArray(input.candidates) || input.candidates.length === 0) {
    throw validationError("Similarity match node requires candidates.");
  }

  if (candidates.length === 0) {
    throw validationError(
      "Similarity match node must include at least one comparable candidate.",
    );
  }

  const strategy = buildStrategySummary(input);
  const queryVectorSource = pickVectorSource(
    queryVector ? normalizeVector(queryVector) : undefined,
    queryText,
  );

  const scoredCandidates: SimilarityMatchScoredCandidate[] = candidates.map(candidate => {
    const textScore = computeTextSimilarity(queryText, candidate.text);
    const candidateVectorSource = pickVectorSource(candidate.vector, candidate.text);
    const vectorScore =
      queryVectorSource.vector && candidateVectorSource.vector
        ? cosineSimilarity(queryVectorSource.vector, candidateVectorSource.vector)
        : 0;

    strategy.usedExplicitQueryVector =
      strategy.usedExplicitQueryVector || queryVectorSource.usedExplicit;
    strategy.usedExplicitCandidateVectors =
      strategy.usedExplicitCandidateVectors || candidateVectorSource.usedExplicit;
    strategy.usedHashVectorFallback =
      strategy.usedHashVectorFallback ||
      queryVectorSource.usedFallback ||
      candidateVectorSource.usedFallback;

    const score = combineScores(
      strategy.mode,
      strategy,
      textScore,
      vectorScore,
      Boolean(queryText && candidate.text),
      Boolean(queryVectorSource.vector && candidateVectorSource.vector),
    );
    const matched = score >= strategy.threshold;

    return {
      candidateId: candidate.candidateId,
      ...(candidate.label ? { label: candidate.label } : {}),
      ...(candidate.text ? { text: candidate.text } : {}),
      score,
      textScore,
      vectorScore,
      matched,
      thresholdGap: score - strategy.threshold,
      metadata: candidate.metadata,
    };
  });

  scoredCandidates.sort((left, right) =>
    right.score - left.score || left.candidateId.localeCompare(right.candidateId),
  );

  if (strategy.mode !== "text" && strategy.usedHashVectorFallback) {
    warnings.push(
      "Vector comparison reused the lightweight hash-vector strategy because explicit vectors were not supplied for all inputs.",
    );
  }

  const bestMatch = scoredCandidates[0];
  const matches = scoredCandidates.filter(candidate => candidate.matched).slice(0, strategy.topK);
  const summary = {
    matched: Boolean(bestMatch?.matched),
    matchedCount: scoredCandidates.filter(candidate => candidate.matched).length,
    topScore: bestMatch?.score ?? 0,
    threshold: strategy.threshold,
    thresholdGap: (bestMatch?.score ?? 0) - strategy.threshold,
  };
  const branch = buildBranchSummary(summary.matched);

  return {
    ok: true,
    nodeType: "similarity_match",
    output: {
      status: "completed",
      query: {
        ...(queryText ? { text: queryText } : {}),
        vectorProvided: Boolean(queryVector),
        candidateCount: candidates.length,
      },
      strategy,
      result: {
        ...(bestMatch ? { bestMatch } : {}),
        matches,
        summary,
        branch,
      },
      ...(bestMatch ? { bestMatch } : {}),
      matches,
      evaluatedCandidates: scoredCandidates,
      summary,
      branch,
      context: normalizeRecord(input.context),
      warnings,
      observability: {
        eventKey: "external.similarity_match",
        nodeType: "similarity_match",
        mode: strategy.mode,
        threshold: strategy.threshold,
        candidateCount: candidates.length,
        matchedCount: summary.matchedCount,
        topScore: summary.topScore,
      },
    },
  };
}
