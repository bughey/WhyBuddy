export const WEB_SEARCH_API = {
  EXECUTE: "POST /api/web-search/nodes/execute",
} as const;

export type WebSearchMode = "mock" | "hybrid";

export interface WebSearchRequestOptions {
  topK?: number;
  mode?: WebSearchMode;
}

export interface WebSearchRequest {
  query: string;
  options?: WebSearchRequestOptions;
}

export interface WebSearchResultItem {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface WebSearchResponse {
  query: string;
  results: WebSearchResultItem[];
  totalCandidates: number;
  latencyMs: number;
  mode: WebSearchMode;
}
