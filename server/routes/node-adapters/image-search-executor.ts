/**
 * Real image search executor — dynamic text-similarity based search.
 *
 * Replaces the hardcoded mock by maintaining an in-memory image catalog
 * and scoring candidates dynamically based on query text, tags, and
 * reference image metadata using TF-IDF-style token overlap scoring.
 *
 * Falls back gracefully to the existing mock path when no catalog is loaded
 * or when the executor encounters an error.
 */

import type {
  WebAigcImageAvailability,
  WebAigcImageSearchMode,
  WebAigcImageSearchRequest,
  WebAigcImageSearchResponse,
  WebAigcImageSearchResultItem,
} from "../../../shared/web-aigc-image-search.js";

// ---------------------------------------------------------------------------
// Catalog entry type
// ---------------------------------------------------------------------------

export interface ImageCatalogEntry {
  imageId: string;
  title: string;
  summary: string;
  previewUrl: string;
  sourceUrl: string;
  source: string;
  tags: string[];
  availability: WebAigcImageAvailability;
  /** Optional pre-computed term frequency map for faster scoring */
  _termFrequency?: Map<string, number>;
}

// ---------------------------------------------------------------------------
// Executor configuration
// ---------------------------------------------------------------------------

export interface ImageSearchExecutorConfig {
  /** Initial catalog entries to seed the executor with */
  catalog?: ImageCatalogEntry[];
  /** Weight for query text match (0-1), default 0.55 */
  queryWeight?: number;
  /** Weight for tag match (0-1), default 0.30 */
  tagWeight?: number;
  /** Weight for reference image match (0-1), default 0.25 */
  referenceWeight?: number;
}

// ---------------------------------------------------------------------------
// Default catalog — richer than the old mock, covers more domains
// ---------------------------------------------------------------------------

const DEFAULT_CATALOG: ImageCatalogEntry[] = [
  {
    imageId: "img-cube-office-dashboard",
    title: "Cube Office Dashboard Illustration",
    summary: "Warm-toned product dashboard mockup with charts, pets mascot, and workspace panels.",
    previewUrl: "https://assets.cubepets.test/images/cube-office-dashboard-preview.jpg",
    sourceUrl: "https://assets.cubepets.test/images/cube-office-dashboard",
    source: "cubepets-asset-library",
    tags: ["dashboard", "workspace", "office", "charts", "illustration", "product"],
    availability: "available",
  },
  {
    imageId: "img-pet-avatar-grid",
    title: "Pet Avatar Reference Grid",
    summary: "A grid of colorful pet avatars suitable for onboarding, profile cards, and playful assistant scenes.",
    previewUrl: "https://assets.cubepets.test/images/pet-avatar-grid-preview.jpg",
    sourceUrl: "https://assets.cubepets.test/images/pet-avatar-grid",
    source: "cubepets-asset-library",
    tags: ["avatar", "pets", "characters", "playful", "profile", "onboarding", "colorful"],
    availability: "available",
  },
  {
    imageId: "img-night-operations-room",
    title: "Night Operations Room",
    summary: "Large-screen monitoring room with agents, telemetry walls, and blue ambient lighting.",
    previewUrl: "https://assets.cubepets.test/images/night-operations-room-preview.jpg",
    sourceUrl: "https://assets.cubepets.test/images/night-operations-room",
    source: "cubepets-asset-library",
    tags: ["monitoring", "operations", "agents", "telemetry", "night", "dark", "screens"],
    availability: "available",
  },
  {
    imageId: "img-mobile-chat-handshake",
    title: "Mobile Chat Handoff Scene",
    summary: "Mobile messaging interface with card previews, handoff confirmation, and assistant follow-up.",
    previewUrl: "https://assets.cubepets.test/images/mobile-chat-handoff-preview.jpg",
    sourceUrl: "https://assets.cubepets.test/images/mobile-chat-handoff",
    source: "cubepets-asset-library",
    tags: ["mobile", "chat", "handoff", "cards", "assistant", "messaging", "interface"],
    availability: "available",
  },
  {
    imageId: "img-workflow-pipeline-diagram",
    title: "Workflow Pipeline Diagram",
    summary: "Technical diagram showing a multi-stage workflow pipeline with nodes, edges, and execution states.",
    previewUrl: "https://assets.cubepets.test/images/workflow-pipeline-diagram-preview.jpg",
    sourceUrl: "https://assets.cubepets.test/images/workflow-pipeline-diagram",
    source: "cubepets-asset-library",
    tags: ["workflow", "pipeline", "diagram", "technical", "nodes", "execution", "stages"],
    availability: "available",
  },
  {
    imageId: "img-3d-office-scene",
    title: "3D Office Scene with Cube Pets",
    summary: "Isometric 3D office environment with cube-shaped pet characters working at desks.",
    previewUrl: "https://assets.cubepets.test/images/3d-office-scene-preview.jpg",
    sourceUrl: "https://assets.cubepets.test/images/3d-office-scene",
    source: "cubepets-asset-library",
    tags: ["3d", "office", "isometric", "pets", "characters", "desks", "environment"],
    availability: "available",
  },
  {
    imageId: "img-data-visualization-charts",
    title: "Data Visualization Charts Collection",
    summary: "Collection of bar charts, line graphs, pie charts, and heatmaps for analytics dashboards.",
    previewUrl: "https://assets.cubepets.test/images/data-viz-charts-preview.jpg",
    sourceUrl: "https://assets.cubepets.test/images/data-viz-charts",
    source: "cubepets-asset-library",
    tags: ["data", "visualization", "charts", "analytics", "graphs", "heatmap", "statistics"],
    availability: "available",
  },
  {
    imageId: "img-security-shield-lock",
    title: "Security Shield and Lock Illustration",
    summary: "Flat illustration of a shield with lock icon representing security, authentication, and access control.",
    previewUrl: "https://assets.cubepets.test/images/security-shield-lock-preview.jpg",
    sourceUrl: "https://assets.cubepets.test/images/security-shield-lock",
    source: "cubepets-asset-library",
    tags: ["security", "shield", "lock", "authentication", "access", "protection", "flat"],
    availability: "available",
  },
  {
    imageId: "img-ai-brain-neural-network",
    title: "AI Brain Neural Network",
    summary: "Abstract visualization of a neural network brain with glowing connections and data flow.",
    previewUrl: "https://assets.cubepets.test/images/ai-brain-neural-preview.jpg",
    sourceUrl: "https://assets.cubepets.test/images/ai-brain-neural",
    source: "cubepets-asset-library",
    tags: ["ai", "brain", "neural", "network", "machine-learning", "abstract", "glow"],
    availability: "available",
  },
  {
    imageId: "img-team-collaboration-meeting",
    title: "Team Collaboration Meeting",
    summary: "Illustration of diverse team members collaborating around a table with laptops and whiteboards.",
    previewUrl: "https://assets.cubepets.test/images/team-collaboration-preview.jpg",
    sourceUrl: "https://assets.cubepets.test/images/team-collaboration",
    source: "cubepets-asset-library",
    tags: ["team", "collaboration", "meeting", "people", "whiteboard", "laptops", "diverse"],
    availability: "available",
  },
  {
    imageId: "img-cloud-infrastructure-diagram",
    title: "Cloud Infrastructure Architecture",
    summary: "Technical diagram of cloud infrastructure with servers, containers, load balancers, and databases.",
    previewUrl: "https://assets.cubepets.test/images/cloud-infra-diagram-preview.jpg",
    sourceUrl: "https://assets.cubepets.test/images/cloud-infra-diagram",
    source: "cubepets-asset-library",
    tags: ["cloud", "infrastructure", "servers", "containers", "docker", "kubernetes", "architecture"],
    availability: "preview_only",
  },
  {
    imageId: "img-code-editor-dark-theme",
    title: "Code Editor Dark Theme Screenshot",
    summary: "Screenshot of a code editor with syntax highlighting in dark theme showing TypeScript code.",
    previewUrl: "https://assets.cubepets.test/images/code-editor-dark-preview.jpg",
    sourceUrl: "https://assets.cubepets.test/images/code-editor-dark",
    source: "cubepets-asset-library",
    tags: ["code", "editor", "dark", "typescript", "programming", "syntax", "developer"],
    availability: "available",
  },
  {
    imageId: "img-robot-assistant-friendly",
    title: "Friendly Robot Assistant",
    summary: "Cute robot character with friendly expression, suitable for chatbot and AI assistant interfaces.",
    previewUrl: "https://assets.cubepets.test/images/robot-assistant-preview.jpg",
    sourceUrl: "https://assets.cubepets.test/images/robot-assistant",
    source: "cubepets-asset-library",
    tags: ["robot", "assistant", "chatbot", "ai", "friendly", "character", "cute"],
    availability: "available",
  },
  {
    imageId: "img-document-management-files",
    title: "Document Management System",
    summary: "Illustration of organized file folders, documents, and search functionality for document management.",
    previewUrl: "https://assets.cubepets.test/images/document-management-preview.jpg",
    sourceUrl: "https://assets.cubepets.test/images/document-management",
    source: "cubepets-asset-library",
    tags: ["document", "files", "folders", "management", "search", "organize", "storage"],
    availability: "available",
  },
  {
    imageId: "img-notification-bell-alerts",
    title: "Notification Bell and Alerts",
    summary: "UI illustration showing notification bell with badge count, alert cards, and message previews.",
    previewUrl: "https://assets.cubepets.test/images/notification-alerts-preview.jpg",
    sourceUrl: "https://assets.cubepets.test/images/notification-alerts",
    source: "cubepets-asset-library",
    tags: ["notification", "bell", "alerts", "messages", "badge", "ui", "cards"],
    availability: "available",
  },
  {
    imageId: "img-vector-database-embeddings",
    title: "Vector Database Embeddings Visualization",
    summary: "Abstract visualization of high-dimensional vector embeddings in a database with similarity clusters.",
    previewUrl: "https://assets.cubepets.test/images/vector-db-embeddings-preview.jpg",
    sourceUrl: "https://assets.cubepets.test/images/vector-db-embeddings",
    source: "cubepets-asset-library",
    tags: ["vector", "database", "embeddings", "similarity", "clusters", "abstract", "rag"],
    availability: "preview_only",
  },
];

// ---------------------------------------------------------------------------
// Tokenization & TF-IDF helpers
// ---------------------------------------------------------------------------

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/[\s_\-]+/)
    .map(t => t.trim())
    .filter(t => t.length > 1);
}

function buildTermFrequency(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }
  return freq;
}

/**
 * Compute IDF-like weight: tokens that appear in fewer documents are more valuable.
 */
function computeIDF(token: string, documentFrequency: Map<string, number>, totalDocs: number): number {
  const df = documentFrequency.get(token) ?? 0;
  if (df === 0) return 0;
  return Math.log(1 + totalDocs / df);
}

// ---------------------------------------------------------------------------
// ImageSearchExecutor class
// ---------------------------------------------------------------------------

export class ImageSearchExecutor {
  private catalog: ImageCatalogEntry[] = [];
  private documentFrequency: Map<string, number> = new Map();
  private readonly queryWeight: number;
  private readonly tagWeight: number;
  private readonly referenceWeight: number;

  constructor(config: ImageSearchExecutorConfig = {}) {
    this.queryWeight = config.queryWeight ?? 0.55;
    this.tagWeight = config.tagWeight ?? 0.30;
    this.referenceWeight = config.referenceWeight ?? 0.25;

    const entries = config.catalog ?? DEFAULT_CATALOG;
    this.loadCatalog(entries);
  }

  /**
   * Load or replace the image catalog. Recomputes term frequencies and IDF.
   */
  loadCatalog(entries: ImageCatalogEntry[]): void {
    this.catalog = entries.map(entry => ({
      ...entry,
      _termFrequency: buildTermFrequency(this.getEntryTokens(entry)),
    }));
    this.rebuildDocumentFrequency();
  }

  /**
   * Add entries to the existing catalog without replacing.
   */
  addEntries(entries: ImageCatalogEntry[]): void {
    for (const entry of entries) {
      this.catalog.push({
        ...entry,
        _termFrequency: buildTermFrequency(this.getEntryTokens(entry)),
      });
    }
    this.rebuildDocumentFrequency();
  }

  /**
   * Get the current catalog size.
   */
  get catalogSize(): number {
    return this.catalog.length;
  }

  /**
   * Execute image search against the catalog.
   */
  async execute(request: WebAigcImageSearchRequest): Promise<WebAigcImageSearchResponse> {
    const topK = request.options?.topK ?? 4;
    const minScore = request.options?.minScore ?? 0.15;
    const mode: WebAigcImageSearchMode = request.options?.mode === "hybrid" ? "hybrid" : "mock";

    const queryTokens = tokenize(request.query ?? "");
    const tagTokens = (request.tags ?? []).map(t => t.toLowerCase().trim()).filter(Boolean);
    const referenceTokens = [
      ...tokenize(request.referenceImage?.description ?? ""),
      ...(request.referenceImage?.tags ?? []).map(t => t.toLowerCase().trim()).filter(Boolean),
    ];

    const allSearchTokens = [...queryTokens, ...tagTokens, ...referenceTokens];
    if (allSearchTokens.length === 0) {
      return this.buildEmptyResponse(request, mode);
    }

    const scored = this.catalog
      .map(entry => this.scoreEntry(entry, queryTokens, tagTokens, referenceTokens))
      .filter((item): item is WebAigcImageSearchResultItem => item !== null)
      .sort((a, b) => b.score - a.score);

    const filtered = scored.filter(item => item.score >= minScore);
    const selected = filtered.slice(0, topK);

    const warnings: string[] = [];
    let degraded = false;
    let fallbackReason: string | undefined;

    if (selected.length === 0) {
      degraded = true;
      fallbackReason = "No candidates met the minimum score threshold; returning top results by relevance.";
      warnings.push("候选图片与输入相似度不足，已返回最相关的候选集合。");
      // Return top results regardless of minScore
      const fallbackResults = scored.slice(0, topK).map(item => ({
        ...item,
        score: Number(Math.max(item.score, 0.05).toFixed(4)),
      }));
      return this.buildResponse(request, fallbackResults, mode, degraded, fallbackReason, warnings);
    }

    if (selected.some(item => item.availability !== "available")) {
      warnings.push("部分图片仅支持预览或当前源不可用，请根据 availability 字段做下游处理。");
    }

    return this.buildResponse(request, selected, mode, degraded, fallbackReason, warnings);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private getEntryTokens(entry: ImageCatalogEntry): string[] {
    return [
      ...tokenize(entry.title),
      ...tokenize(entry.summary),
      ...entry.tags.map(t => t.toLowerCase()),
      ...tokenize(entry.source),
    ];
  }

  private rebuildDocumentFrequency(): void {
    this.documentFrequency = new Map();
    for (const entry of this.catalog) {
      const uniqueTokens = new Set(
        entry._termFrequency ? [...entry._termFrequency.keys()] : this.getEntryTokens(entry),
      );
      for (const token of uniqueTokens) {
        this.documentFrequency.set(token, (this.documentFrequency.get(token) ?? 0) + 1);
      }
    }
  }

  private scoreEntry(
    entry: ImageCatalogEntry,
    queryTokens: string[],
    tagTokens: string[],
    referenceTokens: string[],
  ): WebAigcImageSearchResultItem | null {
    const termFreq = entry._termFrequency ?? buildTermFrequency(this.getEntryTokens(entry));
    const totalDocs = this.catalog.length;

    const matchedBy: Array<"query" | "tags" | "reference"> = [];
    let score = 0;

    // Query scoring with TF-IDF
    if (queryTokens.length > 0) {
      let queryScore = 0;
      let matchCount = 0;
      for (const token of queryTokens) {
        const tf = termFreq.get(token) ?? 0;
        if (tf > 0) {
          matchCount++;
          const idf = computeIDF(token, this.documentFrequency, totalDocs);
          queryScore += (1 + Math.log(tf)) * idf;
        }
      }
      if (matchCount > 0) {
        matchedBy.push("query");
        // Normalize by number of query tokens
        const normalizedScore = queryScore / queryTokens.length;
        // Scale to 0-1 range (IDF max is ~log(totalDocs))
        const maxPossibleIdf = Math.log(1 + totalDocs);
        score += Math.min(1, normalizedScore / maxPossibleIdf) * this.queryWeight;
      }
    }

    // Tag scoring — exact match on entry tags
    if (tagTokens.length > 0) {
      const entryTagSet = new Set(entry.tags.map(t => t.toLowerCase()));
      const tagHits = tagTokens.filter(t => entryTagSet.has(t)).length;
      if (tagHits > 0) {
        matchedBy.push("tags");
        score += (tagHits / tagTokens.length) * this.tagWeight;
      }
    }

    // Reference scoring with TF-IDF
    if (referenceTokens.length > 0) {
      let refScore = 0;
      let matchCount = 0;
      for (const token of referenceTokens) {
        const tf = termFreq.get(token) ?? 0;
        if (tf > 0) {
          matchCount++;
          const idf = computeIDF(token, this.documentFrequency, totalDocs);
          refScore += (1 + Math.log(tf)) * idf;
        }
      }
      if (matchCount > 0) {
        matchedBy.push("reference");
        const normalizedScore = refScore / referenceTokens.length;
        const maxPossibleIdf = Math.log(1 + totalDocs);
        score += Math.min(1, normalizedScore / maxPossibleIdf) * this.referenceWeight;
      }
    }

    if (matchedBy.length === 0) {
      return null;
    }

    return {
      imageId: entry.imageId,
      title: entry.title,
      summary: entry.summary,
      previewUrl: entry.previewUrl,
      sourceUrl: entry.sourceUrl,
      source: entry.source,
      tags: entry.tags,
      availability: entry.availability,
      score: Number(Math.min(1, score).toFixed(4)),
      matchedBy,
    };
  }

  private buildResponse(
    request: WebAigcImageSearchRequest,
    results: WebAigcImageSearchResultItem[],
    mode: WebAigcImageSearchMode,
    degraded: boolean,
    fallbackReason: string | undefined,
    warnings: string[],
  ): WebAigcImageSearchResponse {
    return {
      query: this.buildSearchQuery(request),
      normalized: {
        ...(request.query ? { textQuery: request.query } : {}),
        tags: request.tags ?? [],
        ...(request.referenceImage?.description
          ? { referenceDescription: request.referenceImage.description }
          : {}),
        referenceTags: request.referenceImage?.tags ?? [],
      },
      results,
      totalCandidates: this.catalog.length,
      degraded,
      ...(fallbackReason ? { fallbackReason } : {}),
      warnings,
      mode,
    };
  }

  private buildEmptyResponse(
    request: WebAigcImageSearchRequest,
    mode: WebAigcImageSearchMode,
  ): WebAigcImageSearchResponse {
    return this.buildResponse(
      request,
      [],
      mode,
      true,
      "No search terms provided.",
      ["搜索条件为空，无法执行图片检索。"],
    );
  }

  private buildSearchQuery(request: WebAigcImageSearchRequest): string {
    const segments = [
      request.query,
      ...(request.tags ?? []),
      request.referenceImage?.description,
      ...(request.referenceImage?.tags ?? []),
    ].filter((segment): segment is string => Boolean(segment));

    return segments.join(" | ");
  }
}

// ---------------------------------------------------------------------------
// Factory function for creating the executor
// ---------------------------------------------------------------------------

let defaultExecutor: ImageSearchExecutor | undefined;

/**
 * Get or create the default ImageSearchExecutor singleton.
 * Uses the built-in catalog. Can be replaced by calling `resetDefaultExecutor()`.
 */
export function getDefaultImageSearchExecutor(): ImageSearchExecutor {
  if (!defaultExecutor) {
    defaultExecutor = new ImageSearchExecutor();
  }
  return defaultExecutor;
}

/**
 * Reset the default executor (useful for testing or reconfiguration).
 */
export function resetDefaultImageSearchExecutor(): void {
  defaultExecutor = undefined;
}

/**
 * Create the `executeImageSearch` function suitable for DI into the adapter.
 * This is the main entry point for wiring.
 */
export function createImageSearchExecuteFn(
  config?: ImageSearchExecutorConfig,
): (request: WebAigcImageSearchRequest) => Promise<WebAigcImageSearchResponse> {
  const executor = config
    ? new ImageSearchExecutor(config)
    : getDefaultImageSearchExecutor();

  return (request) => executor.execute(request);
}
